/**
 * Header: oaDrumSynthPatches.js
 * Purpose: The factory patch for each kit voice.
 * Description: Which engine each voice uses and how it is tuned out of the box.
 *   A user's edits are stored per index in OA_DRUM_SYNTH and persisted to
 *   localStorage; these are the values a "Reset" returns to.
 */

window.OA_SYNTH_FACTORY = [
    // 0 Kick — deep pitch drop, short beater click
    { engine: 'membrane', wave: 'sine', pitchStart: 190, pitchEnd: 48, pitchDecay: 22, decay: 340, click: 0.3, clickDecay: 7, drive: 0.2 },
    // 1 Snare — shell plus wires
    { engine: 'snare', tone1: 175, tone2: 235, pitchDrop: 0.3, toneDecay: 80, filterType: 'highpass', filterFreq: 1800, q: 1.2, noiseDecay: 260, mix: 0.6 },
    // 2 Hi-Hat — closed: bright and fast
    { engine: 'metal', base: 245, spread: 1, voices: 6, filterType: 'highpass', filterFreq: 8000, q: 2, noise: 0.12, decay: 75 },
    // 3 Perc — short FM blip
    { engine: 'fm', carrier: 420, ratio: 3.1, index: 700, indexDecay: 45, pitchDrop: 0.2, decay: 160 },
    // 4 Clap — three hands
    { engine: 'clap', bursts: 3, spacing: 11, filterFreq: 1200, q: 3, burstDecay: 9, tailDecay: 220 },
    // 5 Rim — resonant wooden crack, noise-led
    { engine: 'click', freq: 1700, q: 16, decay: 30, noise: 0.6, wave: 'triangle' },
    // 6 Tom Lo
    { engine: 'membrane', wave: 'sine', pitchStart: 220, pitchEnd: 90, pitchDecay: 40, decay: 520, click: 0.18, clickDecay: 8, drive: 0.1 },
    // 7 Tom Mid
    { engine: 'membrane', wave: 'sine', pitchStart: 300, pitchEnd: 140, pitchDecay: 36, decay: 440, click: 0.18, clickDecay: 8, drive: 0.1 },
    // 8 Tom Hi
    { engine: 'membrane', wave: 'sine', pitchStart: 420, pitchEnd: 210, pitchDecay: 32, decay: 380, click: 0.2, clickDecay: 7, drive: 0.1 },
    // 9 Cymbal — long, dense, sizzling
    { engine: 'metal', base: 300, spread: 1.25, voices: 6, filterType: 'highpass', filterFreq: 5500, q: 1.4, noise: 0.35, decay: 1600 },
    // 10 Ride — pingier than the crash, mid-length
    { engine: 'metal', base: 420, spread: 0.9, voices: 6, filterType: 'bandpass', filterFreq: 6000, q: 2.5, noise: 0.2, decay: 900 },
    // 11 Cowbell — two-tone metallic, short
    { engine: 'metal', base: 540, spread: 0.35, voices: 2, filterType: 'bandpass', filterFreq: 2600, q: 3.5, noise: 0.02, decay: 210 },
    // 12 Conga — membrane, rings longer than a tom
    { engine: 'membrane', wave: 'sine', pitchStart: 360, pitchEnd: 195, pitchDecay: 28, decay: 480, click: 0.22, clickDecay: 6, drive: 0.05 },
    // 13 Clave — pure brief resonance
    { engine: 'click', freq: 2450, q: 12, decay: 40, noise: 0.15, wave: 'sine' },
    // 14 Shaker — ramped attack
    { engine: 'shaker', filterFreq: 7200, q: 2.5, attack: 20, decay: 130 },
    // 15 FX — laser-ish FM sweep
    { engine: 'fm', carrier: 220, ratio: 5.5, index: 1400, indexDecay: 220, pitchDrop: 0.6, decay: 600 },
    // --- the voices a 5 x 5 grid adds ------------------------------------
    // 16 Kick 2 — tighter and clickier than voice 0, for doubles
    { engine: 'membrane', wave: 'sine', pitchStart: 150, pitchEnd: 42, pitchDecay: 28, decay: 260, click: 0.45, clickDecay: 9, drive: 0.35 },
    // 17 Snare 2 — higher tuned, shorter wires
    { engine: 'snare', tone1: 220, tone2: 300, pitchDrop: 0.25, toneDecay: 55, filterType: 'highpass', filterFreq: 2400, q: 1.1, noiseDecay: 170, mix: 0.55 },
    // 18 Open Hat — the closed hat left ringing
    { engine: 'metal', base: 245, spread: 1, voices: 6, filterType: 'highpass', filterFreq: 7000, q: 1.8, noise: 0.18, decay: 620 },
    // 19 Tom Fl — floor tom, below Tom Lo
    { engine: 'membrane', wave: 'sine', pitchStart: 160, pitchEnd: 62, pitchDecay: 46, decay: 620, click: 0.16, clickDecay: 8, drive: 0.1 },
    // 20 Crash — bigger and darker than the Cymbal voice
    { engine: 'metal', base: 260, spread: 1.4, voices: 6, filterType: 'highpass', filterFreq: 4200, q: 1.2, noise: 0.4, decay: 2200 },
    // 21 Splash — bright and gone
    { engine: 'metal', base: 380, spread: 1.5, voices: 6, filterType: 'highpass', filterFreq: 7500, q: 1.3, noise: 0.3, decay: 420 },
    // 22 Block — woodblock, drier than the Clave
    { engine: 'click', freq: 1150, q: 20, decay: 26, noise: 0.08, wave: 'square' },
    // 23 Triangle — thin and long
    { engine: 'metal', base: 1100, spread: 0.18, voices: 3, filterType: 'bandpass', filterFreq: 5200, q: 6, noise: 0.01, decay: 1400 },
    // 24 Bongo — small, high, hand-struck
    { engine: 'membrane', wave: 'sine', pitchStart: 520, pitchEnd: 300, pitchDecay: 26, decay: 260, click: 0.24, clickDecay: 6, drive: 0.05 },
];

// The factory patch for a pad. Past the authored voices the list repeats, the
// same way the kit's names do.
window.oaFactoryPatch = function (idx) {
    return window.OA_SYNTH_FACTORY[idx % window.OA_SYNTH_FACTORY.length];
};

// idx -> live patch. Seeded from the factory, overlaid with anything saved.
window.OA_DRUM_SYNTH = window.OA_DRUM_SYNTH || {};

window.oaLoadSynthPatches = function () {
    let saved = {};
    try { saved = JSON.parse(window.localStorage.getItem('oaDrumSynth')) || {}; } catch (e) {}
    for (let i = 0; i < window.OA_PAD_COUNT; i++) {
        window.OA_DRUM_SYNTH[i] = window.oaSynthPatch(saved[i] || window.oaFactoryPatch(i));
    }
};

window.oaSaveSynthPatches = function () {
    try { window.localStorage.setItem('oaDrumSynth', JSON.stringify(window.OA_DRUM_SYNTH)); } catch (e) {}
};

/**
 * Hold a value to what its engine says the knob can do.
 *
 * This used to write whatever it was handed straight into the patch, and every
 * other plugin in the rack clamps. It matters more here than anywhere else,
 * because these numbers do not stop at the patch: they are handed to
 * engine.render(), which puts them on AudioParams. A decay of -1 becomes an
 * exponential ramp to a negative target and the browser throws mid-voice; a
 * pitch of 1e6 is a param above Nyquist. And the patch is PERSISTED, so a bad
 * value written once comes back on every reload until the pad is reset.
 *
 * An out-of-range value gets here from a hand-edited localStorage entry, an
 * older song file, or a MIDI CC mapped to a range the engine never had.
 */
const clampSynth = function (engineName, key, value) {
    const eng = window.OA_SYNTH_ENGINES[engineName];
    const spec = eng && eng.params[key];
    if (!spec) return value;                      // not a knob this engine has
    if (spec.options) {
        // A list, not a range. Anything off the list falls back to the default
        // rather than becoming an oscillator type the browser rejects.
        return spec.options.indexOf(value) >= 0 ? value : spec.def;
    }
    const v = Number(value);
    if (!isFinite(v)) return spec.def;            // NaN passes every comparison
    return Math.max(spec.min, Math.min(spec.max, v));
};

window.oaSetSynthParam = function (idx, key, value) {
    const patch = window.OA_DRUM_SYNTH[idx] || window.oaSynthPatch(window.oaFactoryPatch(idx));
    // Switching engine starts from that engine's defaults rather than carrying
    // over parameters that mean nothing to it.
    window.OA_DRUM_SYNTH[idx] = key === 'engine'
        ? window.oaSynthPatch({ engine: window.OA_SYNTH_ENGINES[value] ? value : patch.engine })
        : Object.assign({}, patch, { [key]: clampSynth(patch.engine, key, value) });
    window.oaSaveSynthPatches();
    window.dispatchEvent(new CustomEvent('oa-synth-changed', { detail: { idx } }));
};

// Replace a whole patch at once. oaSetSynthParam can't do this: feeding it
// 'engine' throws the other parameters away, so restoring a snapshot key by key
// would lose everything the moment the engine differed.
window.oaSetSynthPatch = function (idx, patch) {
    window.OA_DRUM_SYNTH[idx] = window.oaSynthPatch(patch);
    window.oaSaveSynthPatches();
    window.dispatchEvent(new CustomEvent('oa-synth-changed', { detail: { idx } }));
};

window.oaResetSynthPatch = function (idx) {
    window.OA_DRUM_SYNTH[idx] = window.oaSynthPatch(window.oaFactoryPatch(idx));
    window.oaSaveSynthPatches();
    window.dispatchEvent(new CustomEvent('oa-synth-changed', { detail: { idx } }));
};

window.oaLoadSynthPatches();

// ---------------------------------------------------------------------------
// Rendered preview: a synth voice bounced to a real AudioBuffer, so it can be
// drawn on the pad exactly like a loaded sample. Cached per voice and thrown
// away whenever that voice's patch changes.
// ---------------------------------------------------------------------------
window.OA_SYNTH_RENDER = window.OA_SYNTH_RENDER || {};

// How long to bounce. Long enough to catch the whole tail of the slowest patch
// without rendering seconds of silence for a clave.
const synthRenderSeconds = (patch) => {
    const p = patch || {};
    const longest = Math.max(
        p.decay || 0,
        p.noiseDecay || 0,
        p.tailDecay || 0,
        (p.attack || 0) + (p.decay || 0)
    ) / 1000;
    return Math.min(6, Math.max(0.25, longest * 1.15 + 0.05));
};

window.oaRenderSynthVoice = async function (idx) {
    const patch = window.oaSynthPatch(window.OA_DRUM_SYNTH[idx]);
    const key = JSON.stringify(patch);
    const cached = window.OA_SYNTH_RENDER[idx];
    if (cached && cached.key === key) return cached.buffer;

    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const engine = window.OA_SYNTH_ENGINES[patch.engine];
    if (!OfflineCtx || !engine) return null;

    const rate = (window.OA_AUDIO_CTX && window.OA_AUDIO_CTX.sampleRate) || 44100;
    const seconds = synthRenderSeconds(patch);
    try {
        const off = new OfflineCtx(1, Math.ceil(rate * seconds), rate);
        engine.render(off, patch, 0, 0.9, off.destination);
        const raw = await off.startRendering();

        // Trim the trailing silence. Without this a 30ms rimshot is drawn into
        // the first eighth of the pad with the rest blank, while a long cymbal
        // fills it — the shapes would not be comparable.
        const src = raw.getChannelData(0);
        let last = src.length - 1;
        while (last > 0 && Math.abs(src[last]) < 0.0015) last--;
        const len = Math.max(64, last + 1);
        let buffer = raw;
        if (len < src.length) {
            buffer = new (window.AudioBuffer || Object)({ length: len, sampleRate: rate, numberOfChannels: 1 });
            buffer.copyToChannel(src.subarray(0, len), 0);
        }
        window.OA_SYNTH_RENDER[idx] = { key: key, buffer: buffer };
        window.dispatchEvent(new CustomEvent('oa-synth-rendered', { detail: { idx: idx } }));
        return buffer;
    } catch (e) {
        return null;
    }
};

// Keep every voice's preview current: re-bounce on edit, and once at startup so
// the pads show their waveforms without waiting to be touched.
window.addEventListener('oa-synth-changed', (e) => {
    const idx = e.detail && e.detail.idx;
    if (idx != null) {
        delete window.OA_SYNTH_RENDER[idx];
        window.oaRenderSynthVoice(idx);
    }
});

window.oaRenderAllSynthVoices = function () {
    for (let i = 0; i < window.OA_PAD_COUNT; i++) window.oaRenderSynthVoice(i);
};

// ---------------------------------------------------------------------------
// The back end, as the synth editor sees it.
//
// This is the plugin that forced `paramsFor` into the contract. Every other
// effect has one fixed faceplate; a drum voice's knobs depend on which of the
// six engines the pad is running, so the schema has to be generated per unit.
// The editor asks oaPluginParams('drumsynth', pad) and renders what it is
// handed — which is how it already worked, except it used to reach into
// OA_SYNTH_ENGINES itself to find out.
// ---------------------------------------------------------------------------

// Downsampled preview envelopes, one per pad, rebuilt only when the bounce is.
const SYNTH_CURVE_LEN = 256;
const synthCurves = {};
const synthCurveKey = {};

window.oaRegisterPlugin({
    id: 'drumsynth',
    label: 'Drum Synth',
    event: 'oa-synth-changed',
    units: function () { return window.OA_PAD_MAX; },

    /**
     * The running engine's schema, translated into the shared param shape. An
     * engine declares either a numeric range or a list of options; both come
     * back here in the one form a panel knows how to draw.
     */
    paramsFor: function (i) {
        const patch = window.oaSynthPatch(window.OA_DRUM_SYNTH[i] || window.oaFactoryPatch(i));
        const engine = window.OA_SYNTH_ENGINES[patch.engine];
        if (!engine) return [];
        return Object.keys(engine.params).map(function (key) {
            const p = engine.params[key];
            if (p.options) {
                return {
                    key: key, label: p.label, def: p.def, options: p.options,
                    min: 0, max: p.options.length - 1, step: 1,
                    fmt: function (v) { return String(v); },
                };
            }
            return {
                key: key, label: p.label, min: p.min, max: p.max,
                step: p.step, def: p.def, unit: p.unit || '',
                fmt: function (v) {
                    return p.unit ? Math.round(v) + ' ' + p.unit : String(Math.round(v * 1000) / 1000);
                },
            };
        });
    },

    // The six engines, offered the way a preset list is offered — picking one
    // swaps the whole faceplate, which is what changing engine means.
    presets: (function () {
        const out = {};
        Object.keys(window.OA_SYNTH_ENGINES).forEach(function (name) {
            out[name] = { label: window.OA_SYNTH_ENGINES[name].label, engine: name };
        });
        return out;
    })(),

    state: function (i) {
        return window.oaSynthPatch(window.OA_DRUM_SYNTH[i] || window.oaFactoryPatch(i));
    },
    set: function (i, key, value) { window.oaSetSynthParam(i, key, value); },
    preset: function (i, name) {
        if (window.OA_SYNTH_ENGINES[name]) window.oaSetSynthParam(i, 'engine', name);
    },

    slots: window.OA_SLOT.USER + 2,
    layout: {
        /** 1 while a bounced preview exists for this pad. */
        RENDERED: window.OA_SLOT.USER,
        /** Length of that preview in seconds — the width a display draws. */
        SECONDS: window.OA_SLOT.USER + 1,
    },

    read: function (ctx, i, frame) {
        const S = window.OA_SLOT;
        // A pad with a sample loaded is not running the synth at all; the Mixer
        // hides the SYNTH panel on exactly this condition.
        const sampled = !!(window.OA_DRUM_SAMPLES && window.OA_DRUM_SAMPLES[i] && window.OA_DRUM_SAMPLES[i].buffer);
        frame[S.ACTIVE] = sampled ? 0 : 1;
        const render = window.OA_SYNTH_RENDER[i];
        frame[S.USER] = render && render.buffer ? 1 : 0;
        frame[S.USER + 1] = render && render.buffer ? render.buffer.duration : 0;
        // Metered per channel by the compressor strip it feeds, not here.
        frame[S.PEAK_L] = 0;
        frame[S.PEAK_R] = 0;
    },

    /**
     * The bounced voice as a 256-point envelope, 0..1 — the shape drawn on the
     * pad. Comes from the same offline render the pad already shows, so the
     * waveform under a synth voice and the waveform under a loaded sample are
     * produced by one path instead of two.
     */
    curve: function (i) {
        const render = window.OA_SYNTH_RENDER[i];
        if (!render || !render.buffer) return null;
        if (synthCurveKey[i] === render.key && synthCurves[i]) return synthCurves[i];

        const d = render.buffer.getChannelData(0);
        const out = synthCurves[i] || (synthCurves[i] = new Float32Array(SYNTH_CURVE_LEN));
        const per = Math.max(1, Math.floor(d.length / SYNTH_CURVE_LEN));
        let top = 1e-9;
        for (let k = 0; k < SYNTH_CURVE_LEN; k++) {
            let peak = 0;
            const start = k * per;
            for (let j = 0; j < per && start + j < d.length; j++) {
                const a = d[start + j] < 0 ? -d[start + j] : d[start + j];
                if (a > peak) peak = a;
            }
            out[k] = peak;
            if (peak > top) top = peak;
        }
        for (let k = 0; k < SYNTH_CURVE_LEN; k++) out[k] /= top;
        synthCurveKey[i] = render.key;
        return out;
    },
});
