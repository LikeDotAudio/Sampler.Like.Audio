/**
 * Header: oaReverb.js
 * Purpose: Two shared reverb buses for the whole kit.
 * Description: Every voice splits into a dry path straight to the output and a
 *   per-channel send into one of two convolvers. Each unit has its own tone
 *   (bright/dull), size (short → extra long) and return level, so one can be a
 *   tight room while the other is a long tail. The impulse responses are
 *   generated at runtime, so no external IR file is needed.
 *
 *   The tape delays (oaTapeDelay.js) feed these buses too — see `toRv` there.
 */

window.OA_REVERB_SIZES = {
    // A steeper exponent buries the tail under the dry hit, so keep these gentle
    // enough that even the short setting is audibly a room.
    short:     { label: 'Short',      seconds: 0.55, decay: 2.0 },
    medium:    { label: 'Medium',     seconds: 1.40, decay: 1.9 },
    long:      { label: 'Long',       seconds: 2.90, decay: 1.7 },
    extralong: { label: 'Extra Long', seconds: 6.00, decay: 1.4 },
};

window.OA_REVERB_TONES = {
    bright: { label: 'Bright', lowpass: 16000, highpass: 260 },
    dull:   { label: 'Dull',   lowpass: 2200,  highpass: 90 },
};

// Two units. A starts as the general-purpose room, B as the long dark tail so
// the pair is useful before anyone touches a control.
window.OA_REVERB_UNITS = [
    { name: 'RV A', color: '#5f9ea0', tone: 'bright', size: 'medium',    ret: 0.4 },
    { name: 'RV B', color: '#4a7fb0', tone: 'dull',   size: 'extralong', ret: 0.4 },
];
window.OA_REVERB_COUNT = window.OA_REVERB_UNITS.length;

// Fill in whatever a saved (or hand-edited) unit is missing, and drop anything
// that no longer names a real tone/size.
const rvUnit = function (saved, i) {
    const d = window.OA_REVERB_UNITS[i];
    const s = saved || {};
    const sends = Array.isArray(s.sends) ? s.sends.slice(0, 16).map((v) => Number(v) || 0) : [];
    while (sends.length < 16) sends.push(0);
    return {
        sends: sends,
        tone: window.OA_REVERB_TONES[s.tone] ? s.tone : d.tone,
        size: window.OA_REVERB_SIZES[s.size] ? s.size : d.size,
        ret: typeof s.ret === 'number' ? s.ret : d.ret,
    };
};

window.OA_REVERB = (function () {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('oaReverb')); } catch (e) {}
    // The first version stored a single flat unit — it becomes RV A, and B
    // comes up on its defaults.
    const units = (saved && Array.isArray(saved.units)) ? saved.units : [saved];
    return { units: window.OA_REVERB_UNITS.map((d, i) => rvUnit(units[i], i)) };
})();

window.oaReverbUnit = function (u) {
    return window.OA_REVERB.units[u] || window.OA_REVERB.units[0];
};

window.oaSaveReverb = function () {
    try { window.localStorage.setItem('oaReverb', JSON.stringify(window.OA_REVERB)); } catch (e) {}
};

// Noise shaped by an exponential decay — the standard way to fake a room when
// you have no recorded impulse. Stereo, with the channels decorrelated so the
// tail spreads rather than sitting dead centre.
window.oaMakeImpulse = function (ctx, sizeKey, toneKey) {
    const size = window.OA_REVERB_SIZES[sizeKey] || window.OA_REVERB_SIZES.medium;
    const tone = window.OA_REVERB_TONES[toneKey] || window.OA_REVERB_TONES.bright;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * size.seconds));
    const buf = ctx.createBuffer(2, len, rate);

    // One-pole filters applied per sample: cheaper than running a filter node
    // over the tail, and it bakes the tone into the IR itself.
    const lpCoef = Math.exp(-2 * Math.PI * tone.lowpass / rate);
    const hpCoef = Math.exp(-2 * Math.PI * tone.highpass / rate);

    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0, hp = 0, prev = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            lp = white * (1 - lpCoef) + lp * lpCoef;        // tame the top
            hp = (hp + lp - prev) * hpCoef;                 // clear the mud
            prev = lp;
            // Early samples build fast, then the whole thing decays away.
            const env = Math.pow(1 - i / len, size.decay);
            d[i] = hp * env;
        }
    }
    return buf;
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
        convolver.buffer = window.oaMakeImpulse(ctx, unit.size, unit.tone);
        ret.gain.value = unit.ret;
        input.connect(convolver);
        convolver.connect(ret);
        ret.connect(ctx.destination);

        // Tap the wet output per side so the return strip can meter what is
        // actually ringing, rather than guessing from the send levels.
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
        buses[idx] = { input: input, convolver: convolver, ret: ret, analysers: analysers };
    }
    return buses[idx];
};

// Rebuild a tail for the live context after a tone/size change.
window.oaRefreshReverb = function (u) {
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaReverbs && ctx.__oaReverbs[u];
    if (!bus) return;
    const unit = window.oaReverbUnit(u);
    bus.convolver.buffer = window.oaMakeImpulse(ctx, unit.size, unit.tone);
    bus.ret.gain.value = unit.ret;
};

window.oaSetReverb = function (u, key, value) {
    window.oaReverbUnit(u)[key] = value;
    window.oaSaveReverb();
    window.oaRefreshReverb(u);
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, key: key } }));
};

window.oaSetReverbSend = function (u, idx, value) {
    const unit = window.oaReverbUnit(u);
    const sends = unit.sends.slice();
    sends[idx] = Math.max(0, Math.min(1, value));
    unit.sends = sends;
    window.oaSaveReverb();
    window.dispatchEvent(new CustomEvent('oa-reverb-changed', { detail: { unit: u, idx: idx } }));
};
