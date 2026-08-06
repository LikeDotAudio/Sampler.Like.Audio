/**
 * Header: oaDrive.js
 * Purpose: A distortion pedal on every channel — overdrive, tube saturation,
 *   starved fuzz and an octave-up rectifier — sitting in front of the pan and
 *   the effect sends.
 * Description: A real pedal distorts because a circuit runs out of voltage. Push
 *   a tube, a transistor or an op-amp past the rail and the peaks of the wave
 *   physically cannot get any taller, so they flatten. Flattening the peaks is
 *   not a loss of information — a squared-off sine is a sine plus a stack of
 *   harmonics that were not there before, and those added harmonics ARE the
 *   sound of dirt.
 *
 *   In DSP there is no rail to hit, so we squash the numbers on purpose. Every
 *   flavour below is a different shape of squashing:
 *
 *     OVERDRIVE   tanh(x). Rounds the peaks off gradually rather than chopping
 *                 them, which is what an op-amp with diodes in the feedback loop
 *                 does. Symmetric, so it makes ODD harmonics only — the third,
 *                 fifth, seventh. That is the hollow, woody, blues-amp sound.
 *
 *     TUBE        tanh(x + bias). A vacuum tube does not clip its positive and
 *                 negative halves equally, and lopsided clipping makes EVEN
 *                 harmonics — the second above all, which is exactly an octave
 *                 and therefore reads as warmth rather than as distortion. We
 *                 fake it by shoving the wave off-centre before it meets the
 *                 ceiling, so the top squashes first.
 *
 *     FUZZ        A hard clamp at the rail. No rounding at all: the wave goes
 *                 square, the harmonic series runs on forever, and it rips.
 *
 *   Two more tricks sit on top of the clipper:
 *
 *     STARVE      A dying battery in a fuzz box leaves the transistor without
 *                 enough voltage to pass small signals, so the tail of every
 *                 note sputters and gates out. We carve a DEAD ZONE around
 *                 zero: anything smaller than the threshold is silence.
 *
 *     OCTAVE      Full-wave rectification — fold the negative half of the wave
 *                 up into the positive. The wave now repeats twice as often as
 *                 it used to, so the pitch doubles: the Octavia trick.
 *
 *   THE IMPLEMENTATION TRICK: every one of those stages is MEMORYLESS. The
 *   output for a sample depends only on that sample's value — never on the one
 *   before it. So the whole chain collapses into a single function y = f(x),
 *   and a function of one variable can be precomputed into a lookup table. That
 *   is exactly what a WaveShaper node is. We evaluate the pedal once per
 *   parameter change over 4096 points and hand the table to the browser, which
 *   then runs it over the audio for free. See oaDriveSample() — it is the
 *   per-sample pedal, written out longhand, and oaDriveCurve() bakes it.
 *
 *   TRANSPARENT UNTIL ASKED: mix defaults to 0 on every channel and at mix 0
 *   oaDriveNode() builds NO NODES AT ALL and the voice connects to the pan the
 *   way it always did. Not "distortion turned down" — distortion not present.
 */

window.OA_DRIVE_EPSILON = 0.0005;

// How far the dead zone can eat into the signal at STARVE 100%, as a fraction
// of full scale. Past about 0.6 the note stops being a note.
const OA_STARVE_MAX = 0.6;

// The shape of the ceiling. `soft` rounds the peaks off, `hard` chops them flat.
const OA_CLIPS = {
    soft: function (x) { return Math.tanh(x); },
    hard: function (x) { return x < -1 ? -1 : (x > 1 ? 1 : x); },
};

/**
 * The three voicings.
 *
 * `bias` is how far off-centre the wave sits when it meets the ceiling, so the
 * top squashes before the bottom does. Lopsided clipping is what makes EVEN
 * harmonics — the second above all, which is an octave, and an octave reads as
 * warmth rather than as dirt. Symmetric clipping can only make ODD ones.
 *
 * The number is a fraction of the DRIVE, not a fixed offset, and that detail is
 * the whole difference between a tube setting and a decoration. Measured over a
 * 200 Hz sine, a fixed 0.30 offset gives a healthy second harmonic at 1.5x
 * drive and almost nothing by 40x: the wave is swinging ±40 by then and a
 * constant 0.30 barely tilts it, so the warmth evaporates exactly where you
 * reached for it. Tie the offset to the drive and the wave crosses the
 * threshold at the same lopsided place no matter how hard it is being pushed —
 * measured, the second harmonic holds at ~0.12 from 3x all the way to 40x.
 *
 * Physically that is a bias point that tracks the signal instead of sitting at
 * one voltage, which is a liberty; but a real tube stage that hot has other
 * people's problems, and this is the behaviour a player expects from the knob.
 */
window.OA_DRIVE_MODES = [
    {
        key: 'od', label: 'Overdrive', clip: 'soft', bias: 0, color: '#4caf50',
        hint: 'tanh, dead centre — peaks rounded, odd harmonics only. A pushed amp.',
    },
    {
        key: 'tube', label: 'Tube', clip: 'soft', bias: 0.10, color: '#ffb300',
        hint: 'tanh off-centre — the top squashes first, so the even harmonics come up. Warm.',
    },
    {
        key: 'fuzz', label: 'Fuzz', clip: 'hard', bias: 0.05, color: '#e53935',
        hint: 'clamped flat at the rail — square wave, endless harmonics. Rips.',
    },
];

window.oaDriveMode = function (key) {
    return window.OA_DRIVE_MODES.find(function (m) { return m.key === key; })
        || window.OA_DRIVE_MODES[0];
};

const pct = function (v) { return Math.round(v * 100) + '%'; };

// One row of the pedal's faceplate. `log` means the control is swept
// logarithmically — a drive knob that spends half its travel between 20x and
// 40x is useless, because the ear hears ratios, not differences.
window.OA_DRIVE_PARAMS = [
    { key: 'drive',  label: 'Drive',  min: 1,   max: 40,    def: 1,     log: true,  fmt: function (v) { return v.toFixed(1) + 'x'; } },
    { key: 'starve', label: 'Starve', min: 0,   max: 1,     def: 0,     log: false, fmt: pct },
    { key: 'rect',   label: 'Octave', min: 0,   max: 1,     def: 0,     log: false, fmt: pct },
    { key: 'tone',   label: 'Tone',   min: 800, max: 18000, def: 18000, log: true,
      fmt: function (v) { return v >= 17000 ? 'Open' : (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) + ' Hz'); } },
    { key: 'level',  label: 'Level',  min: 0,   max: 2,     def: 1,     log: false, fmt: function (v) { return v.toFixed(2) + 'x'; } },
    { key: 'mix',    label: 'Mix',    min: 0,   max: 1,     def: 0,     log: false, fmt: pct },
];

// Only these four change the SHAPE of the transfer curve — tone, level and mix
// are applied by nodes around it, so moving them must not rebuild the table.
const OA_CURVE_KEYS = ['mode', 'drive', 'starve', 'rect'];

window.OA_DRIVE_PRESETS = {
    edge:    { label: 'Edge of Breakup', mode: 'od',   drive: 3.5,  starve: 0,    rect: 0,    tone: 14000, level: 1,    mix: 0.30 },
    crunch:  { label: 'Crunch',          mode: 'od',   drive: 9,    starve: 0,    rect: 0,    tone: 9000,  level: 0.95, mix: 0.55 },
    warm:    { label: 'Warm Tube',       mode: 'tube', drive: 5,    starve: 0,    rect: 0,    tone: 7500,  level: 1,    mix: 0.45 },
    console: { label: 'Console Push',    mode: 'tube', drive: 2.2,  starve: 0,    rect: 0,    tone: 16000, level: 1,    mix: 0.22 },
    fuzz:    { label: 'Big Fuzz',        mode: 'fuzz', drive: 18,   starve: 0,    rect: 0,    tone: 5200,  level: 0.85, mix: 0.85 },
    starved: { label: 'Dying Battery',   mode: 'fuzz', drive: 26,   starve: 0.55, rect: 0,    tone: 4200,  level: 0.9,  mix: 1 },
    octavia: { label: 'Octavia',         mode: 'fuzz', drive: 20,   starve: 0.12, rect: 0.9,  tone: 6000,  level: 0.85, mix: 0.9 },
    clean:   { label: 'Clean (bypass)',  mode: 'od',   drive: 1,    starve: 0,    rect: 0,    tone: 18000, level: 1,    mix: 0 },
};

// Fill in whatever a saved unit is missing and drop anything out of range, so a
// hand-edited or half-written localStorage entry still comes up playable.
const drvUnit = function (saved) {
    const s = saved || {};
    const out = { mode: window.oaDriveMode(s.mode).key };
    window.OA_DRIVE_PARAMS.forEach(function (p) {
        const v = Number(s[p.key]);
        out[p.key] = isFinite(v) ? Math.max(p.min, Math.min(p.max, v)) : p.def;
    });
    return out;
};

window.OA_DRIVE = (function () {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('oaDrive')); } catch (e) {}
    const units = (saved && Array.isArray(saved.units)) ? saved.units : [];
    // Sized for the LARGEST grid, like every other per-channel array, so
    // shrinking the pad layout and growing it back finds pad 25's pedal intact.
    const out = [];
    for (let i = 0; i < window.OA_PAD_MAX; i++) out.push(drvUnit(units[i]));
    return { units: out };
})();

window.oaDriveUnit = function (idx) {
    return window.OA_DRIVE.units[idx] || window.OA_DRIVE.units[0];
};

window.oaSaveDrive = function () {
    try {
        // Only the fields — the cached curve hanging off each unit is derived
        // data and would triple the size of the entry for nothing.
        window.localStorage.setItem('oaDrive', JSON.stringify({
            units: window.OA_DRIVE.units.map(function (u) {
                const o = { mode: u.mode };
                window.OA_DRIVE_PARAMS.forEach(function (p) { o[p.key] = u[p.key]; });
                return o;
            })
        }));
    } catch (e) {}
};

/** Is this channel doing anything at all? */
window.oaDriveActive = function (idx) {
    return window.oaDriveUnit(idx).mix > window.OA_DRIVE_EPSILON;
};

/**
 * THE PEDAL, one sample at a time.
 *
 * Everything here is memoryless, which is why the whole thing can be frozen
 * into a lookup table by oaDriveCurve() below. Read this as the spec; read the
 * curve builder as the optimisation.
 */
window.oaDriveSample = function (x, u, mode) {
    // 1. INPUT GAIN — slam it into the ceiling. This is the only knob that
    //    decides how much of the wave is squashed; everything downstream just
    //    decides what the squashing looks like.
    let s = x * u.drive;

    // 2. TRANSISTOR STARVING — a DEAD ZONE around silence.
    //
    //    The naive version is a gate: `if (|s| < thr) s = 0`. It works, but it
    //    leaves a step in the transfer function — the output jumps from 0 to
    //    thr the instant the signal crosses — and a step is an edge, which is
    //    infinite harmonics, which is aliasing and a click on every crossing.
    //    Subtracting the threshold from what survives closes that step: below
    //    thr is silence, at thr the output is 0 and climbs from there. Same
    //    sputter, no click. It is also closer to the real fault — a starved
    //    output stage has a dead band, it is not a noise gate.
    //
    //    The threshold scales with drive so the two knobs stay independent: the
    //    playing dynamics decide what sputters, not the gain setting.
    const thr = u.starve * OA_STARVE_MAX * u.drive;
    if (thr > 0) {
        if (s > thr) s -= thr;
        else if (s < -thr) s += thr;
        else s = 0;
    }

    // 3. RECTIFICATION — fold the bottom half up. A full-wave rectifier makes
    //    the wave repeat twice per cycle, which IS the octave above. Blended,
    //    so the knob goes from the untouched wave to the full octave-up.
    if (u.rect > 0) s = s * (1 - u.rect) + Math.abs(s) * u.rect;

    // 4. ASYMMETRY — push the wave off-centre so it reaches the top rail before
    //    the bottom one. Scaled by drive; see OA_DRIVE_MODES for why.
    const clip = OA_CLIPS[mode.clip];
    const bias = mode.bias * u.drive;

    // 5. THE CEILING, and then the offset taken back off.
    //
    //    Note it is clip(bias) that comes off, NOT bias. The clipper has
    //    already bent the offset on its way through, so subtracting the raw
    //    number leaves a residue: with tanh(0.3) = 0.2913, subtracting 0.3
    //    parks the output at -0.0087 for ever — a speaker cone held off-centre
    //    and a thump the moment the wet path is faded in. Subtracting what
    //    actually came out lands on true zero at every mode and every drive.
    return clip(s + bias) - clip(bias);
};

// Resolution of the lookup table. 4096 is plenty for a smooth curve and cheap
// enough to rebuild while a knob is being dragged.
const OA_DRIVE_CURVE_LEN = 4096;

/**
 * Bake the pedal into a WaveShaper table: evaluate oaDriveSample() across the
 * whole input range once, and the browser interpolates it per sample forever
 * after. Cached on the unit and rebuilt only when the SHAPE changes.
 *
 * The result is peak-normalised. Without that, every turn of the drive knob is
 * also a volume change and the pedal is impossible to audition — normalised,
 * drive adds harmonics at a steady loudness and LEVEL is the only volume
 * control, which is how a pedal behaves.
 */
window.oaDriveCurve = function (u) {
    const key = OA_CURVE_KEYS.map(function (k) { return u[k]; }).join('|');
    if (u.__curveKey === key && u.__curve) return u.__curve;

    const mode = window.oaDriveMode(u.mode);
    const curve = new Float32Array(OA_DRIVE_CURVE_LEN);
    let peak = 0;
    for (let i = 0; i < OA_DRIVE_CURVE_LEN; i++) {
        // A WaveShaper's table always spans an input of -1..+1.
        const x = (i / (OA_DRIVE_CURVE_LEN - 1)) * 2 - 1;
        const y = window.oaDriveSample(x, u, mode);
        curve[i] = y;
        const a = y < 0 ? -y : y;
        if (a > peak) peak = a;
    }
    if (peak > 1e-6 && peak !== 1) {
        const norm = 1 / peak;
        for (let i = 0; i < OA_DRIVE_CURVE_LEN; i++) curve[i] *= norm;
    }

    u.__curveKey = key;
    u.__curve = curve;
    return curve;
};

/**
 * Build the pedal for one channel and wire it into `dest`. Returns the node a
 * voice should play into, or NULL when the channel is clean — in which case
 * nothing was built and the caller connects to `dest` exactly as before.
 *
 *   in ─┬─ dry ────────────────────────────────────────┬─ dest
 *       └─ shaper ─ tone ─ dc ─ wet ───────────────────┘
 *
 * Per voice rather than per channel, like the sends above it: a knob move lands
 * on the next hit instead of re-shaping notes that are already ringing.
 */
window.oaDriveNode = function (ctx, idx, dest) {
    const u = window.oaDriveUnit(idx);
    if (!(u.mix > window.OA_DRIVE_EPSILON)) return null;

    const mode = window.oaDriveMode(u.mode);
    const input = ctx.createGain();

    // The clean signal, straight past the pedal. At mix 0 we never get here, so
    // this path is only ever a partial blend.
    const dry = ctx.createGain();
    dry.gain.value = 1 - u.mix;
    input.connect(dry);
    dry.connect(dest);

    const shaper = ctx.createWaveShaper();
    shaper.curve = window.oaDriveCurve(u);
    // Clipping invents harmonics above everything the signal had, and anything
    // it invents past half the sample rate folds back down as inharmonic
    // rubbish that no filter can remove afterwards. Running the shaper at 4x
    // pushes the fold-over point two octaves up, where the harmonics are weak
    // enough not to matter. This one line is most of the difference between
    // "distortion" and "broken".
    shaper.oversample = '4x';
    input.connect(shaper);

    let tail = shaper;

    // Tone: distortion is bright by construction — every harmonic it adds is
    // above what went in. The tone control is what makes it sit in a mix.
    if (u.tone < 17000) {
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = u.tone;
        tone.Q.value = 0.707;
        tail.connect(tone);
        tail = tone;
    }

    // A lopsided or rectified curve pushes the whole wave off-centre by an
    // amount that follows the playing, so no constant can cancel it — it takes
    // a filter. Symmetric and unrectified, the curve generates no DC at all and
    // this is skipped.
    if (mode.bias !== 0 || u.rect > 0) {
        const dc = ctx.createBiquadFilter();
        dc.type = 'highpass';
        dc.frequency.value = 12;
        tail.connect(dc);
        tail = dc;
    }

    const wet = ctx.createGain();
    wet.gain.value = u.mix * u.level;
    tail.connect(wet);
    wet.connect(dest);

    return input;
};

window.oaSetDrive = function (idx, key, value) {
    const u = window.oaDriveUnit(idx);
    if (key === 'mode') {
        u.mode = window.oaDriveMode(value).key;
    } else {
        const p = window.OA_DRIVE_PARAMS.find(function (q) { return q.key === key; });
        if (!p) return;
        u[key] = Math.max(p.min, Math.min(p.max, Number(value) || 0));
    }
    window.oaSaveDrive();
    window.dispatchEvent(new CustomEvent('oa-drive-changed', { detail: { idx: idx, key: key } }));
};

window.oaApplyDrivePreset = function (idx, name) {
    const preset = window.OA_DRIVE_PRESETS[name];
    if (!preset) return;
    const u = window.oaDriveUnit(idx);
    u.mode = window.oaDriveMode(preset.mode).key;
    window.OA_DRIVE_PARAMS.forEach(function (p) {
        if (typeof preset[p.key] === 'number') u[p.key] = Math.max(p.min, Math.min(p.max, preset[p.key]));
    });
    window.oaSaveDrive();
    window.dispatchEvent(new CustomEvent('oa-drive-changed', { detail: { idx: idx, preset: name } }));
};
