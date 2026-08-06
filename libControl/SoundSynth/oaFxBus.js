/**
 * Header: oaFxBus.js
 * Purpose: The one node a voice connects to — pan, dry path, and every send.
 * Description: Sits above oaReverb.js and oaTapeDelay.js and knows about both.
 *   A voice gets a panner (or a plain gain) that goes straight to the output,
 *   plus one send gain per effect bus that this channel feeds. Sends are read
 *   when the voice is built, so a knob move lands on the next hit rather than
 *   re-levelling notes that are already ringing.
 *
 *   The channel's DRIVE pedal (oaDrive.js) goes in FRONT of all of that, so the
 *   reverbs and tapes are fed the distorted signal — a pedal sits on the floor
 *   before the desk, not in the aux rack. On a clean channel it builds nothing.
 *
 *   The channel's COMPRESSOR (oaCompressor.js) goes on the END of the dry path,
 *   after the pan. Unlike everything else here it is built ONCE per channel and
 *   shared by every voice, because a compressor with no memory of the last hit
 *   is not a compressor. That placement also means the sends are tapped ahead of
 *   it: the reverbs and tapes hear the channel's natural dynamics while the
 *   direct sound is squashed, which is the more useful of the two orders — a
 *   compressed send makes the tail swell up behind every hit.
 */

window.OA_FX_SEND_EPSILON = 0.001;

/**
 * The node a voice should connect to. Handles panning, the dry path to the
 * output, and this channel's reverb + delay sends. Returns the input node.
 */
window.oaVoiceOut = function (ctx, idx, pan) {
    let node;
    if (pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        node = p;
    } else {
        node = ctx.createGain();
    }
    // Null on a channel that has never been compressed, and the pan goes
    // straight out the way it always did.
    const comp = window.oaCompStrip ? window.oaCompStrip(ctx, idx) : null;
    node.connect(comp ? comp.input : ctx.destination);

    const tap = function (amount, target) {
        if (!(amount > window.OA_FX_SEND_EPSILON)) return;
        const sg = ctx.createGain();
        sg.gain.value = amount;
        node.connect(sg);
        sg.connect(target);
    };

    const rv = (window.OA_REVERB && window.OA_REVERB.units) || [];
    for (let r = 0; r < rv.length; r++) {
        const amount = (rv[r].sends && rv[r].sends[idx]) || 0;
        if (amount > window.OA_FX_SEND_EPSILON) tap(amount, window.oaReverbBus(ctx, r).input);
    }

    const dl = (window.OA_DELAY && window.OA_DELAY.units) || [];
    for (let d = 0; d < dl.length; d++) {
        const amount = (dl[d].sends && dl[d].sends[idx]) || 0;
        if (amount > window.OA_FX_SEND_EPSILON) tap(amount, window.oaDelayBus(ctx, d).input);
    }

    // Returns null on a clean channel, and the voice connects straight to the
    // pan the way it always did — bit for bit, not "distortion turned down".
    const drive = window.oaDriveNode ? window.oaDriveNode(ctx, idx, node) : null;
    return drive || node;
};

/**
 * Build every bus a channel actually sends to, ahead of time. The live context
 * calls this on the first user gesture so the tape worklet is loaded before the
 * first hit; the offline renderer awaits it so its buses exist synchronously
 * while the pattern is being scheduled.
 */
window.oaWarmFx = async function (ctx) {
    await window.oaPrepareFx(ctx);
    // Every compressed channel, built now that the answer about worklets is in.
    // Left until the first voice, a strip would be built while the module was
    // still registering and would take the native fallback for the whole session.
    if (window.oaCompStrip) {
        for (let i = 0; i < window.OA_PAD_MAX; i++) window.oaCompStrip(ctx, i);
    }
    const used = function (units, idx) {
        const u = units[idx];
        return !!(u && u.sends && u.sends.some((v) => v > window.OA_FX_SEND_EPSILON));
    };
    const rv = (window.OA_REVERB && window.OA_REVERB.units) || [];
    for (let r = 0; r < rv.length; r++) if (used(rv, r)) window.oaReverbBus(ctx, r);
    const dl = (window.OA_DELAY && window.OA_DELAY.units) || [];
    for (let d = 0; d < dl.length; d++) {
        // A delay feeding a reverb needs that reverb built even if no channel
        // sends to it directly.
        if (used(dl, d)) {
            window.oaDelayBus(ctx, d);
            (dl[d].toRv || []).forEach((amount, r) => {
                if (amount > window.OA_FX_SEND_EPSILON) window.oaDelayToReverb(ctx, d, r, amount);
            });
        }
    }
};
