/**
 * Header: oaReverb.js
 * Purpose: Two shared reverb machines for the whole kit, driven from a LARC.
 * Description: Every voice splits into a dry path straight to the output and a
 *   per-channel send into one of two reverbs. The tape delays (oaTapeDelay.js)
 *   feed them too — see `toRv` there.
 *
 *   The two units used to be a pair of dropdowns: pick a "tone" and a "size"
 *   from four fixed choices. They are now a parameter set modelled on the
 *   Lexicon 480L, addressed the way that machine is addressed — banks of
 *   programs loaded by number, and six sliders per page editing whatever the
 *   program loaded. See LarcRemote.jsx for the front panel.
 *
 *   WHY THE PARAMETERS LIVE IN THE IMPULSE RESPONSE. A 480L is a feedback delay
 *   network: a tank of delay lines with the output folded back into the input,
 *   processed sample by sample. This is a CONVOLUTION reverb — the room is
 *   precomputed as an impulse response and the browser convolves the audio
 *   against it. That sounds like a compromise, and for some parameters it is,
 *   but for the two that make a 480L sound like a 480L it is arguably the more
 *   direct route:
 *
 *     SHAPE and SPREAD are envelope controls. On the real machine they shape
 *     how energy BUILDS before it decays — the swell that makes a big hall read
 *     as big rather than merely long. In an FDN that has to be imposed on the
 *     tank from outside. In an impulse response the envelope IS the thing being
 *     drawn, so shape and spread are not approximated here at all: they are the
 *     literal curve of the tail.
 *
 *   What convolution genuinely costs us is that a parameter change means
 *   rebuilding the response rather than turning a knob on a running network,
 *   which takes a few milliseconds of arithmetic. Hence the debounce in
 *   oaRefreshReverb(). The real machine has the same tell for the same reason:
 *   the manual notes that changing SIZE briefly mutes the audio while it
 *   re-allocates its delay memory.
 *
 *   The response is built in oaBuildImpulse() below, in the order sound
 *   actually arrives: pre-delay, then discrete early reflections off the walls,
 *   then the diffuse late tail with its own two-band decay.
 */

// Every parameter the machine has, in LARC page order — six to a page, because
// there are six sliders. `fmt` renders the value the way the red LED readout
// does: 2.065, 120, 30M, 3.40K, 0MS.
const kHz = function (v) {
    return v >= 1000 ? (v / 1000).toFixed(2) + 'K' : Math.round(v) + '';
};

window.OA_REVERB_PARAMS = [
    // ---- PAGE 1: the six on the front of the manual ----
    { key: 'rtMid', short: 'RTM', name: 'Reverb Time', page: 0, min: 0.15, max: 12, step: 0.005,
      fmt: (v) => v.toFixed(3),
      hint: 'How long the tail takes to fall 60dB. The single biggest decision.' },
    { key: 'shape', short: 'SHP', name: 'Shape', page: 0, min: 0, max: 255, step: 1,
      fmt: (v) => String(Math.round(v)),
      hint: 'The CONTOUR of the buildup. Low is an immediate hit that decays; high swells in before it falls.' },
    { key: 'spread', short: 'SPR', name: 'Spread', page: 0, min: 0, max: 255, step: 1,
      fmt: (v) => String(Math.round(v)),
      hint: 'How LONG the buildup lasts. Shape draws the curve, spread stretches it.' },
    { key: 'size', short: 'SIZ', name: 'Size', page: 0, min: 4, max: 39, step: 1,
      fmt: (v) => Math.round(v) + 'M',
      hint: 'Room dimension in metres. Sets the spacing of the early reflections, and scales spread with it.' },
    { key: 'hfCut', short: 'HFC', name: 'HF Cutoff', page: 0, min: 500, max: 20000, step: 10,
      fmt: kHz,
      hint: 'Air and soft walls eat the top end as the tail ages. Lower is a darker, more distant room.' },
    { key: 'preDelay', short: 'PDL', name: 'Pre Delay', page: 0, min: 0, max: 250, step: 1,
      fmt: (v) => Math.round(v) + 'MS',
      hint: 'Silence before the room answers. A few milliseconds keeps the dry hit clear of the tail.' },

    // ---- PAGE 2 ----
    { key: 'diffusion', short: 'DIF', name: 'Diffusion', page: 1, min: 0, max: 255, step: 1,
      fmt: (v) => String(Math.round(v)),
      hint: 'How smeared the early part is. Low leaves discrete slapping echoes; high is a smooth wash.' },
    { key: 'rtLow', short: 'RTL', name: 'Bass Multiply', page: 1, min: 0.2, max: 4, step: 0.05,
      fmt: (v) => v.toFixed(2) + 'X',
      hint: 'Low-frequency decay as a multiple of reverb time. Above 1 the bottom rings on after the top has gone.' },
    { key: 'xover', short: 'XOV', name: 'Crossover', page: 1, min: 80, max: 2000, step: 10,
      fmt: kHz,
      hint: 'Where bass multiply stops applying and reverb time takes over.' },
    { key: 'erLevel', short: 'ERL', name: 'Early Level', page: 1, min: 0, max: 1, step: 0.01,
      fmt: (v) => String(Math.round(v * 100)),
      hint: 'Loudness of the discrete wall bounces against the diffuse tail.' },
    { key: 'erTime', short: 'ERT', name: 'Early Time', page: 1, min: 0.2, max: 3, step: 0.02,
      fmt: (v) => v.toFixed(2) + 'X',
      hint: 'Stretches or compresses the early reflection pattern without moving the room size.' },
    { key: 'ret', short: 'LVL', name: 'Return Level', page: 1, min: 0, max: 1, step: 0.01,
      fmt: (v) => String(Math.round(v * 100)),
      hint: 'How much of this machine comes back into the mix. The return fader on the strip is the same control.' },
];

window.OA_REVERB_PAGES = 2;

window.oaReverbParam = function (key) {
    return window.OA_REVERB_PARAMS.find(function (p) { return p.key === key; });
};
// The six that page `n` puts under the sliders, left to right.
window.oaReverbPageParams = function (page) {
    return window.OA_REVERB_PARAMS.filter(function (p) { return p.page === (page | 0); });
};

// ---------------------------------------------------------------------------
// The programs, in banks of up to ten, the way the machine stores them. A
// program is nothing but a full set of the parameters above — loading one
// overwrites every slider at once.
// ---------------------------------------------------------------------------
const P = function (rtMid, shape, spread, size, hfCut, preDelay, diffusion, rtLow, xover, erLevel, erTime) {
    return { rtMid, shape, spread, size, hfCut, preDelay, diffusion, rtLow, xover, erLevel, erTime };
};

window.OA_REVERB_BANKS = [
    {
        name: 'RANDOM HALLS',
        programs: [
            { name: 'SMALL RAND HALL',  p: P(1.30,  90, 100, 18,  6800,  12, 170, 1.20, 500, 0.34, 1.00) },
            { name: 'MEDIUM RAND HALL', p: P(2.065, 120, 127, 30,  3400,   0, 190, 1.35, 480, 0.30, 1.00) },
            { name: 'LARGE RAND HALL',  p: P(3.40,  150, 170, 38,  4200,  24, 210, 1.50, 420, 0.26, 1.20) },
            { name: 'RICH HALL',        p: P(2.80,  175, 190, 34,  5600,  32, 230, 1.60, 380, 0.22, 1.10) },
            { name: 'GOTHIC HALL',      p: P(5.60,  200, 220, 39,  2600,  40, 240, 1.90, 300, 0.18, 1.40) },
        ],
    },
    {
        name: 'HALLS',
        programs: [
            { name: 'SMALL HALL',       p: P(1.10,  70,  70, 16,  8200,   8, 150, 1.10, 560, 0.40, 0.90) },
            { name: 'MEDIUM HALL',      p: P(1.90, 100, 110, 26,  6400,  18, 175, 1.25, 500, 0.34, 1.00) },
            { name: 'LARGE HALL',       p: P(2.90, 130, 150, 34,  5200,  28, 200, 1.40, 440, 0.28, 1.15) },
            { name: 'CONCERT HALL',     p: P(2.40, 145, 165, 32,  7000,  35, 215, 1.30, 420, 0.24, 1.10) },
            { name: 'CHURCH',           p: P(4.80, 185, 205, 39,  3200,  45, 235, 1.75, 340, 0.20, 1.30) },
            { name: 'VOCAL HALL',       p: P(1.70, 110, 120, 24,  9000,  22, 205, 1.05, 520, 0.26, 0.95) },
        ],
    },
    {
        name: 'ROOMS',
        programs: [
            { name: 'SMALL ROOM',       p: P(0.42,  30,  25,  8, 10000,   4, 120, 0.90, 700, 0.62, 0.70) },
            { name: 'MEDIUM ROOM',      p: P(0.72,  50,  45, 13,  8600,   8, 145, 0.95, 640, 0.54, 0.80) },
            { name: 'LARGE ROOM',       p: P(1.15,  70,  70, 20,  7200,  14, 165, 1.05, 580, 0.46, 0.90) },
            { name: 'BRIGHT ROOM',      p: P(0.80,  45,  40, 14, 16000,   6, 150, 0.75, 700, 0.55, 0.80) },
            { name: 'DARK ROOM',        p: P(0.95,  60,  55, 16,  1800,  10, 160, 1.60, 400, 0.50, 0.85) },
            { name: 'TILED ROOM',       p: P(1.05,  25,  20, 12, 18000,   5,  70, 0.85, 700, 0.85, 0.65) },
        ],
    },
    {
        name: 'PLATES',
        programs: [
            { name: 'SMALL PLATE',      p: P(0.85,  10,   8, 10, 11000,   6, 245, 0.80, 700, 0.10, 0.60) },
            { name: 'MEDIUM PLATE',     p: P(1.60,  14,  12, 14, 10000,  10, 250, 0.85, 640, 0.08, 0.60) },
            { name: 'LARGE PLATE',      p: P(2.60,  18,  16, 18,  9000,  14, 252, 0.90, 600, 0.06, 0.65) },
            { name: 'VOCAL PLATE',      p: P(1.90,  20,  18, 15, 12000,  20, 250, 0.80, 620, 0.06, 0.60) },
            { name: 'DRUM PLATE',       p: P(1.20,   8,   6, 12,  7600,   2, 248, 0.95, 660, 0.14, 0.55) },
        ],
    },
    {
        name: 'WILD SPACES',
        programs: [
            { name: 'CANYON',           p: P(7.50, 210, 240, 39,  4000, 120, 180, 1.80, 320, 0.45, 2.60) },
            { name: 'CAVERN',           p: P(6.20, 230, 250, 39,  1600,  80, 215, 2.40, 260, 0.35, 2.00) },
            { name: 'TUNNEL',           p: P(3.60,  60,  90, 22,  2800,  30,  90, 2.00, 300, 0.72, 1.80) },
            { name: 'INSIDE A PIPE',    p: P(2.20,  20,  30, 10,  3600,   8,  40, 2.80, 280, 0.90, 0.90) },
            { name: 'THE ABYSS',        p: P(11.0, 250, 255, 39,  1200, 200, 250, 3.20, 220, 0.12, 3.00) },
        ],
    },
    {
        name: 'AMBIENCE',
        programs: [
            { name: 'SMALL AMBIENCE',   p: P(0.28,  20,  14,  6, 13000,   2, 175, 0.85, 700, 0.70, 0.60) },
            { name: 'STUDIO',           p: P(0.45,  35,  28, 10, 11000,   5, 190, 0.90, 660, 0.60, 0.70) },
            { name: 'STAGE',            p: P(0.95,  80,  75, 20,  8000,  16, 200, 1.10, 560, 0.48, 1.00) },
            { name: 'DRUM BOOTH',       p: P(0.34,  15,  10,  7,  9500,   1, 140, 1.00, 700, 0.78, 0.55) },
        ],
    },
    {
        name: 'EFFECTS',
        programs: [
            { name: 'GATED',            p: P(0.50, 255, 235, 22,  8500,   6, 240, 1.00, 600, 0.20, 0.90) },
            { name: 'REVERSE',          p: P(0.90, 255, 255, 28,  9500,  10, 250, 1.00, 560, 0.05, 1.00) },
            { name: 'NONLIN',           p: P(0.60, 240, 200, 18,  7000,   4, 230, 1.00, 600, 0.25, 0.80) },
            { name: 'SLAP CHAMBER',     p: P(1.10,  12,  60, 24,  6200,  70,  55, 1.10, 580, 0.95, 1.60) },
        ],
    },
];

window.oaReverbBank = function (b) {
    return window.OA_REVERB_BANKS[Math.max(0, Math.min(window.OA_REVERB_BANKS.length - 1, b | 0))];
};
window.oaReverbProgram = function (b, pr) {
    const bank = window.oaReverbBank(b);
    return bank.programs[Math.max(0, Math.min(bank.programs.length - 1, pr | 0))];
};

// Two machines. A comes up as the general-purpose hall, B as the long dark
// space, so the pair is useful before anyone touches a slider.
window.OA_REVERB_UNITS = [
    { name: 'RV A', color: '#5f9ea0', bank: 0, prog: 1, ret: 0.4 },
    { name: 'RV B', color: '#4a7fb0', bank: 4, prog: 1, ret: 0.4 },
];
window.OA_REVERB_COUNT = window.OA_REVERB_UNITS.length;

// The four sizes and two tones the old dropdowns offered, mapped onto the
// nearest program so a machine that was set up before this existed comes back
// recognisably rather than snapping to a default.
const LEGACY = {
    'short|bright':     [2, 0], 'short|dull':     [2, 4],
    'medium|bright':    [1, 1], 'medium|dull':    [2, 4],
    'long|bright':      [1, 2], 'long|dull':      [1, 4],
    'extralong|bright': [0, 4], 'extralong|dull': [4, 1],
};

const rvUnit = function (saved, i) {
    const d = window.OA_REVERB_UNITS[i];
    const s = saved || {};
    let bank = d.bank, prog = d.prog;

    // A pre-LARC unit stored size/tone as strings. Nothing else did.
    if (typeof s.size === 'string') {
        const hit = LEGACY[s.size + '|' + s.tone] || [d.bank, d.prog];
        bank = hit[0];
        prog = hit[1];
    } else if (typeof s.bank === 'number') {
        bank = s.bank;
        prog = s.prog;
    }
    bank = Math.max(0, Math.min(window.OA_REVERB_BANKS.length - 1, bank | 0));
    prog = Math.max(0, Math.min(window.oaReverbBank(bank).programs.length - 1, prog | 0));

    const unit = {
        sends: window.oaFxSendArray(s.sends),
        bank: bank, prog: prog,
        // Which page the LARC was left on, and whether the program has been
        // edited away from its stored values (the machine shows a dot for this).
        page: Math.max(0, Math.min(window.OA_REVERB_PAGES - 1, Number(s.page) || 0)),
        edited: !!s.edited,
        standby: !!s.standby,
        ret: typeof s.ret === 'number' ? s.ret : d.ret,
    };
    // Start from the program, then let anything explicitly saved override it —
    // so an edited machine reloads edited, and a new parameter added later
    // arrives at its program value rather than undefined.
    const base = window.oaReverbProgram(bank, prog).p;
    window.OA_REVERB_PARAMS.forEach(function (p) {
        if (p.key === 'ret') return;
        const v = Number(s[p.key]);
        unit[p.key] = isFinite(v) && s[p.key] !== undefined
            ? Math.max(p.min, Math.min(p.max, v))
            : base[p.key];
    });
    return unit;
};

window.OA_REVERB = (function () {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('oaReverb')); } catch (e) {}
    const units = (saved && Array.isArray(saved.units)) ? saved.units : [saved];
    return { units: window.OA_REVERB_UNITS.map((d, i) => rvUnit(units[i], i)) };
})();

window.oaReverbUnit = function (u) {
    return window.OA_REVERB.units[u] || window.OA_REVERB.units[0];
};

window.oaSaveReverb = function () {
    try { window.localStorage.setItem('oaReverb', JSON.stringify(window.OA_REVERB)); } catch (e) {}
};

/** The name the LARC shows on its top line, with the edit dot. */
window.oaReverbProgramName = function (u) {
    const unit = window.oaReverbUnit(u);
    return window.oaReverbProgram(unit.bank, unit.prog).name;
};

// ---------------------------------------------------------------------------
// THE ROOM ITSELF
// ---------------------------------------------------------------------------

// How long a response has to be to hold everything the parameters ask for:
// the silence in front, the swell, and the tail's fall to silence. Capped so a
// runaway setting cannot ask for a hundred megabytes of buffer.
const irSeconds = function (unit) {
    const build = (unit.spread / 255) * (0.03 + (unit.size / 39) * 0.5);
    const tail = unit.rtMid * Math.max(1, unit.rtLow) * 1.15;
    return Math.min(14, unit.preDelay / 1000 + build + tail + 0.05);
};

/**
 * Draw the impulse response for one machine.
 *
 * Read top to bottom and it is the life of a single handclap in the room: it
 * leaves the source (pre-delay), it hits the walls a few times and comes back
 * as distinct slaps (early reflections), and those slaps multiply into a wash
 * that swells and then dies (the late tail).
 */
window.oaBuildImpulse = function (ctx, unit) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * irSeconds(unit)));
    const buf = ctx.createBuffer(2, len, rate);

    const preS = Math.floor((unit.preDelay / 1000) * rate);
    const diff = unit.diffusion / 255;
    const shape = unit.shape / 255;
    const buildS = Math.max(1, Math.floor(((unit.spread / 255) * (0.03 + (unit.size / 39) * 0.5)) * rate));

    // Decay as a per-sample multiplier rather than a pow() per sample: a 60dB
    // fall over rtMid seconds is exp(-6.9078 t / rt), and exp(a+b) = exp(a)exp(b),
    // so the whole envelope is one multiply in the inner loop.
    const decMulHi = Math.exp(-6.907755 / Math.max(0.05, unit.rtMid) / rate);
    const decMulLo = Math.exp(-6.907755 / Math.max(0.05, unit.rtMid * unit.rtLow) / rate);

    // The buildup contour. Low shape is a near-instant onset, high shape swells
    // in slowly — this exponent IS the SHAPE slider.
    const shapeExp = 0.12 + shape * 4.0;

    // Air and soft walls take the top off as the tail ages: the response starts
    // at HF CUTOFF and closes toward a third of it by the end.
    const lpAt = function (frac) {
        const hz = unit.hfCut * (1 - 0.66 * frac);
        return Math.exp(-2 * Math.PI * Math.max(200, hz) / rate);
    };
    // The crossover one-pole that splits the tail into the two decay bands.
    const xoCoef = Math.exp(-2 * Math.PI * unit.xover / rate);

    // Early reflections. Spacing follows the room: sound covers `size` metres in
    // size/343 seconds, and each bounce is a little later and a little quieter.
    // Low diffusion leaves them as bare slaps, high diffusion smears each one
    // into a burst so they melt into the tail.
    const baseTap = (unit.size / 343) * unit.erTime;
    const smear = Math.max(1, Math.floor(diff * 0.012 * rate));
    const TAPS = 18;

    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);

        // --- the discrete bounces ---
        // The two sides get their own irrational spacing so the pattern never
        // lines up between them; identical taps would collapse the room to a
        // point between the speakers.
        const skew = ch === 0 ? 1 : 1.037;
        for (let t = 1; t <= TAPS; t++) {
            // Irrational-ish stepping so the taps never fall into a rhythm,
            // which would ring as a pitch rather than read as a room.
            const when = baseTap * skew * (t * 0.61803 + Math.sin(t * 2.4) * 0.17 + 0.25);
            const at = preS + Math.floor(when * rate);
            if (at >= len) break;
            const amp = unit.erLevel * Math.pow(0.82, t) * (ch === 0 ? 1 : 0.93);
            // A bare tap at low diffusion, a short burst of noise at high.
            const n = Math.max(1, Math.floor(smear * (0.4 + 0.6 * Math.random())));
            for (let k = 0; k < n && at + k < len; k++) {
                const w = 1 - k / n;
                d[at + k] += amp * w * (n === 1 ? 1 : (Math.random() * 2 - 1));
            }
        }

        // --- the diffuse tail ---
        let lp = 0, prev = 0, low = 0;
        let decHi = 1, decLo = 1;
        let coef = lpAt(0);
        const lateStart = preS;
        for (let i = lateStart; i < len; i++) {
            const age = (i - lateStart);

            // Refresh the damping every 256 samples. Recomputing an exp() per
            // sample doubles the cost of the whole build for a curve that moves
            // far too slowly to hear the steps.
            if ((age & 255) === 0) coef = lpAt(age / (len - lateStart));

            const white = Math.random() * 2 - 1;
            lp = white * (1 - coef) + lp * coef;

            // Split into two bands so bass multiply can give the bottom its own
            // decay — a real hall's low end always outlasts its top.
            low = lp * (1 - xoCoef) + low * xoCoef;
            const high = lp - low;

            decHi *= decMulHi;
            decLo *= decMulLo;

            // The swell. Below the build length the energy is still arriving,
            // and shapeExp decides how abruptly.
            const build = age < buildS ? Math.pow(age / buildS, shapeExp) : 1;

            const v = (high * decHi + low * decLo) * build;
            // Sparse at low diffusion: only a fraction of samples carry energy,
            // which is what leaves a tail sounding grainy and discrete.
            d[i] += (diff > 0.9 || Math.random() < 0.25 + diff * 0.75) ? v : v * 0.25;
            prev = lp;
        }
    }
    return buf;
};

// Kept under its old name and signature: the offline renderer and anything else
// that only knows "give me a room" still works.
window.oaMakeImpulse = function (ctx, u) {
    return window.oaBuildImpulse(ctx, window.oaReverbUnit(u | 0));
};

// One set of buses per AudioContext — the offline renderer gets its own.
window.oaReverbBus = function (ctx, u) {
    const idx = Math.max(0, Math.min(window.OA_REVERB_COUNT - 1, u | 0));
    const buses = ctx.__oaReverbs || (ctx.__oaReverbs = []);
    if (!buses[idx]) {
        const unit = window.oaReverbUnit(idx);
        const input = ctx.createGain();          // everything sends in here
        const convolver = ctx.createConvolver();
        const ret = ctx.createGain();
        convolver.normalize = true;
        convolver.buffer = window.oaBuildImpulse(ctx, unit);
        ret.gain.value = unit.standby ? 0 : unit.ret;
        input.connect(convolver);
        convolver.connect(ret);
        ret.connect(ctx.destination);

        // Tap the wet output per side so the return strip and the LARC's own
        // meter can show what is actually ringing, rather than guessing from
        // the send levels.
        let analysers = null;
        if (ctx.createAnalyser && ctx.createChannelSplitter) {
            const split = ctx.createChannelSplitter(2);
            ret.connect(split);
            analysers = [0, 1].map((ch) => {
                const a = ctx.createAnalyser();
                a.fftSize = 1024;
                split.connect(a, ch);
                return a;
            });
        }
        buses[idx] = { input: input, convolver: convolver, ret: ret, analysers: analysers, muted: false };
    }
    return buses[idx];
};

// Rebuilding a response is milliseconds of arithmetic, and a slider drag fires
// dozens of changes a second. The level is applied at once because it is just a
// gain; the room is redrawn on a trailing edge once the hand stops.
const pending = {};
window.oaRefreshReverb = function (u, immediate) {
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaReverbs && ctx.__oaReverbs[u];
    if (!bus) return;
    const unit = window.oaReverbUnit(u);
    bus.ret.gain.value = window.oaReverbGain(u, bus);

    if (pending[u]) clearTimeout(pending[u]);
    const build = function () {
        pending[u] = null;
        bus.convolver.buffer = window.oaBuildImpulse(ctx, window.oaReverbUnit(u));
        window.dispatchEvent(new CustomEvent('oa-reverb-rebuilt', { detail: { unit: u } }));
    };
    if (immediate) build();
    else pending[u] = setTimeout(build, 90);
};

window.oaSetReverb = function (u, key, value) {
    const unit = window.oaReverbUnit(u);
    const p = window.oaReverbParam(key);
    if (p) {
        unit[key] = Math.max(p.min, Math.min(p.max, Number(value) || 0));
        // Anything the sliders touch takes the machine off its stored program.
        if (key !== 'ret') unit.edited = true;
    } else {
        // page, and the legacy 'tone'/'size' a very old song file still carries.
        if (key === 'page') unit.page = Math.max(0, Math.min(window.OA_REVERB_PAGES - 1, value | 0));
        else if (key === 'tone' || key === 'size') {
            // A pre-LARC song file sets these two separately, as strings. Note
            // whichever arrived under its own name — `size` is a number now and
            // writing 'medium' over it would break the room — and map the pair
            // onto the nearest program as soon as one lands.
            unit['__' + key] = value;
            const hit = LEGACY[(unit.__size || 'medium') + '|' + (unit.__tone || 'bright')];
            if (hit) window.oaLoadReverbProgram(u, hit[0], hit[1]);
            return;
        } else unit[key] = value;
    }
    window.oaSaveReverb();
    // The return level is a gain, not a geometry change — never rebuild for it.
    if (key === 'ret' || key === 'page') {
        const ctx = window.OA_AUDIO_CTX;
        const bus = ctx && ctx.__oaReverbs && ctx.__oaReverbs[u];
        if (bus && key === 'ret') bus.ret.gain.value = window.oaReverbGain(u, bus);
    } else {
        window.oaRefreshReverb(u);
    }
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, key: key } }));
};

/** Load a stored program: every slider moves at once and the edit dot clears. */
window.oaLoadReverbProgram = function (u, bank, prog) {
    const unit = window.oaReverbUnit(u);
    const b = Math.max(0, Math.min(window.OA_REVERB_BANKS.length - 1, bank | 0));
    const pr = Math.max(0, Math.min(window.oaReverbBank(b).programs.length - 1, prog | 0));
    const src = window.oaReverbProgram(b, pr).p;
    unit.bank = b;
    unit.prog = pr;
    unit.edited = false;
    window.OA_REVERB_PARAMS.forEach(function (p) {
        if (p.key === 'ret') return;                 // the return fader is the user's, not the program's
        if (typeof src[p.key] === 'number') unit[p.key] = Math.max(p.min, Math.min(p.max, src[p.key]));
    });
    window.oaSaveReverb();
    window.oaRefreshReverb(u, true);
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, program: pr, bank: b } }));
};

// Two separate ways for a machine to go quiet, and they must not fight: MUTE is
// momentary and lives on the bus, POWER is a persistent standby and lives on
// the unit so it survives a reload. Either one alone silences the return.
const rvGain = function (u, bus) {
    const unit = window.oaReverbUnit(u);
    return (bus.muted || unit.standby) ? 0 : unit.ret;
};
window.oaReverbGain = rvGain;

/** MUTE on the LARC: drops the return for exactly as long as it is held. */
window.oaMuteReverb = function (u, on) {
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaReverbs && ctx.__oaReverbs[u];
    if (!bus) return;
    bus.muted = !!on;
    bus.ret.gain.setTargetAtTime(rvGain(u, bus), ctx.currentTime, 0.01);
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, mute: !!on } }));
};

/** POWER on the LARC: takes the machine out of circuit until it is pressed again. */
window.oaSetReverbStandby = function (u, on) {
    const unit = window.oaReverbUnit(u);
    unit.standby = !!on;
    window.oaSaveReverb();
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaReverbs && ctx.__oaReverbs[u];
    if (bus) bus.ret.gain.setTargetAtTime(rvGain(u, bus), ctx.currentTime, 0.02);
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, standby: !!on } }));
};

window.oaSetReverbSend = function (u, idx, value) {
    const unit = window.oaReverbUnit(u);
    const sends = unit.sends.slice();
    sends[idx] = Math.max(0, Math.min(1, value));
    unit.sends = sends;
    window.oaSaveReverb();
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, idx: idx } }));
};
