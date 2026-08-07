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

// ---------------------------------------------------------------------------
// RECORD BYPASS
//
// While a take is being recorded, every effect in the rack comes out of the
// path. Not turned down — OUT, so that nothing between the pad and the speaker
// is doing work that costs time:
//
//   the DRIVE pedal      a WaveShaper at 4x oversampling, which resamples up and
//                        back down and carries the filters to do it
//   the CHANNEL STRIP    an AudioWorklet, so at least one 128-frame quantum
//   the SENDS            no latency on the dry path, but a convolver and four
//                        tape worklets running for a monitor nobody is listening
//                        to is CPU that a glitch-free take needs more
//   the BUSS COMPRESSOR  another worklet, on the one path everything shares
//
// What is left is source → pan → master fade → out. The fade and the meters
// stay: they are not effects, and a take with no metering is worse than a take
// with three milliseconds more latency.
//
// It is deliberately a BUILD-TIME decision, read when each voice is built, so
// arming record does not re-plumb voices that are already sounding — the tail
// of the last hit rings out through the rack it was born into, and the next hit
// is dry. The alternative is a click on every arm.
// ---------------------------------------------------------------------------

window.OA_FX_BYPASS = false;

/** Is the rack out of the path right now? */
window.oaFxBypassed = function () { return !!window.OA_FX_BYPASS; };

/**
 * Take the whole rack out of circuit, or put it back. The master is told
 * separately because it owns its own routing — this file does not know what a
 * buss compressor is made of, only that it has a way to stand aside.
 */
window.oaSetFxBypass = function (on) {
    const next = !!on;
    if (next === window.OA_FX_BYPASS) return;
    window.OA_FX_BYPASS = next;
    if (window.oaSetMasterBypass) window.oaSetMasterBypass(next);
    window.dispatchEvent(new CustomEvent('oa-fx-bypass', { detail: { on: next } }));
};

// ---------------------------------------------------------------------------
// Voice retirement
//
// Everything oaVoiceOut() builds is PER HIT: a panner, a send gain for each bus
// this channel feeds, and — on a driven channel — a whole pedal, waveshaper and
// all. At sixteenth notes across a full grid that is a few hundred nodes a
// second being wired into a graph that reaches the destination.
//
// The spec says a node with no references and no live input is collectable, and
// the browser does eventually collect them. "Eventually" is the problem: the
// collector runs when IT decides to, the pause lands wherever it lands, and a
// pause during playback is heard. Cutting each chain loose the moment its voice
// is done turns an unbounded pile of maybe-collectable nodes into a bounded one
// that is definitely gone, and moves the cost off the audio thread's back.
//
// Retirement is swept, not timed. A setTimeout per voice would be one timer per
// hit — the same churn in a different currency.
// ---------------------------------------------------------------------------

/** Disconnect every chain whose voice has finished. Cheap, and runs per hit. */
const sweep = function (ctx) {
    const q = ctx.__oaRetire;
    if (!q || !q.length) return;
    const now = ctx.currentTime;
    let keep = 0;
    for (let i = 0; i < q.length; i++) {
        if (q[i].at > now) {
            q[keep++] = q[i];
            continue;
        }
        const chain = q[i].chain;
        for (let n = 0; n < chain.length; n++) {
            try { chain[n].disconnect(); } catch (e) {}
        }
    }
    q.length = keep;
};

/**
 * Hand a voice's chain back once it has stopped sounding. `at` is the context
 * time the voice goes quiet; the chain is held until then and dropped after.
 */
window.oaRetireVoice = function (ctx, node, at) {
    const chain = node && node.__oaChain;
    if (!chain || !chain.length) return;
    const q = ctx.__oaRetire || (ctx.__oaRetire = []);
    // A tail longer than the voice: the reverb and delay sends are still being
    // fed for as long as the note rings, and cutting them at the note's end
    // would clip the send rather than the sound.
    q.push({ chain: chain, at: (at || ctx.currentTime) + 0.25 });
    node.__oaChain = null;
    sweep(ctx);
};

/** How many chains are waiting to be released. Flat means nothing is leaking. */
window.oaPendingVoices = function (ctx) {
    return (ctx && ctx.__oaRetire) ? ctx.__oaRetire.length : 0;
};

/**
 * Run the sweep without building a voice. Playing normally there is always a
 * next hit to carry it, but the last voice of a session has nothing behind it —
 * so the meter pump calls this, and so do the tests, which is how the queue is
 * observed draining to zero rather than assumed to.
 */
window.oaSweepVoices = function (ctx) { if (ctx) sweep(ctx); };

/**
 * The node a voice should connect to. Handles panning, the dry path to the
 * output, and this channel's reverb + delay sends. Returns the input node.
 *
 * Every node built here is recorded on `__oaChain` so oaRetireVoice() can let
 * go of the whole thing in one move when the voice is done.
 */
window.oaVoiceOut = function (ctx, idx, pan) {
    sweep(ctx);

    const chain = [];
    let node;
    if (pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        node = p;
    } else {
        node = ctx.createGain();
    }
    chain.push(node);

    // Read ONCE, here, so a voice is built entirely in or entirely out of the
    // rack — never half of each because the flag moved mid-construction.
    const bypass = !!window.OA_FX_BYPASS;

    // Null on a channel that has never been compressed, and the pan goes
    // straight on to the master bus. An INPUT PORT, not a strip object: this
    // file no longer knows what a compressor is made of.
    const compIn = (!bypass && window.oaCompInput) ? window.oaCompInput(ctx, idx) : null;
    // …and on to the MASTER BUS, which is where every audible path in the app
    // now ends up. Guarded, because a test that loads a subset of the backend
    // still has to be able to make a sound.
    node.connect(compIn || (window.oaMasterInput ? window.oaMasterInput(ctx) : ctx.destination));

    const tap = function (amount, target) {
        if (!(amount > window.OA_FX_SEND_EPSILON)) return;
        const sg = ctx.createGain();
        sg.gain.value = amount;
        node.connect(sg);
        sg.connect(target);
        chain.push(sg);
    };

    // Each module answers for its own send level and hands back its own input
    // port. This loop used to read OA_REVERB.units[r].sends[idx] and reach into
    // the returned bus object for `.input` — so the router knew the shape of
    // another module's settings AND the shape of its node graph.
    if (!bypass) {
        for (let r = 0; r < window.OA_REVERB_COUNT; r++) {
            const amount = window.oaReverbSend(r, idx);
            if (amount > window.OA_FX_SEND_EPSILON) tap(amount, window.oaReverbInput(ctx, r));
        }

        for (let d = 0; d < window.OA_DELAY_COUNT; d++) {
            const amount = window.oaDelaySend(d, idx);
            if (amount > window.OA_FX_SEND_EPSILON) tap(amount, window.oaDelayInput(ctx, d));
        }
    }

    // Returns null on a clean channel, and the voice connects straight to the
    // pan the way it always did — bit for bit, not "distortion turned down".
    const drive = (!bypass && window.oaDriveNode) ? window.oaDriveNode(ctx, idx, node, chain) : null;
    const head = drive || node;
    head.__oaChain = chain;
    return head;
};

/**
 * Build every bus a channel actually sends to, ahead of time. The live context
 * calls this on the first user gesture so the tape worklet is loaded before the
 * first hit; the offline renderer awaits it so its buses exist synchronously
 * while the pattern is being scheduled.
 */
window.oaWarmFx = async function (ctx) {
    await window.oaPrepareFx(ctx);
    // Each module builds what IT decides is in use, now that the answer about
    // worklets is in. Order still matters and is the only thing left here that
    // is genuinely the router's business: the MASTER BUS first, because
    // everything below connects INTO it and a bus built lazily by the first
    // sender would be a second summing point for anything already wired; then
    // strips (left until the first voice, one would be built while the module
    // was still registering and would take the native fallback for the whole
    // session), then rooms, then tapes — a tape wires its own throw into a room
    // as it is built.
    if (window.oaMasterWarm) window.oaMasterWarm(ctx);
    if (window.oaCompWarm) window.oaCompWarm(ctx);
    if (window.oaReverbWarm) window.oaReverbWarm(ctx);
    if (window.oaDelayWarm) window.oaDelayWarm(ctx);
};

/**
 * Cut every voice loose at once, and take the effects rack down with it. Used
 * when a context is abandoned, and by the leak tests as the last step before
 * asking the graph what is left.
 */
window.oaDisposeVoices = function (ctx) {
    if (!ctx) return;
    // Every sounding source, stopped and disconnected. A looping pad that was
    // never toggled off is exactly the voice this has to catch.
    (window.OA_LIVE_VOICES || []).slice().forEach(function (src) {
        try { src.stop(); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
    });
    if (window.OA_LIVE_VOICES) window.OA_LIVE_VOICES.length = 0;
    Object.keys(window.OA_DRUM_LOOPS || {}).forEach(function (k) { window.OA_DRUM_LOOPS[k] = null; });

    const q = ctx.__oaRetire;
    if (q) {
        q.forEach(function (entry) {
            entry.chain.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        });
        q.length = 0;
    }
};

// ---------------------------------------------------------------------------
// The voice counter, as a plugin.
//
// This one has no panel of its own and no sound. It exists because the failure
// that started all of this — the app getting slower and dirtier the longer it
// ran — was completely invisible while it was happening. Every number that
// would have shown it is published here, in the same binary frame as everything
// else, so a display can put it on screen and the tests can assert on it.
//
// If VOICES or PENDING climbs and does not come back down while nothing is
// playing, something is holding on. That is the whole diagnostic.
// ---------------------------------------------------------------------------

window.oaRegisterPlugin({
    id: 'voices',
    label: 'Voices',
    units: function () { return 1; },
    params: [],

    slots: window.OA_SLOT.USER + 4,
    layout: {
        /** Sources sounding right now. */
        VOICES: window.OA_SLOT.USER,
        /** Voice chains built and waiting to be released. Should stay small. */
        PENDING: window.OA_SLOT.USER + 1,
        /** Megabytes held by the Tone Mode pre-render cache. */
        CACHE_MB: window.OA_SLOT.USER + 2,
        /** Effect buses currently built: reverbs + delays + compressor strips. */
        BUSES: window.OA_SLOT.USER + 3,
    },

    read: function (ctx, i, frame) {
        const S = window.OA_SLOT;
        // The last voice of a run has no next hit to carry the sweep, so the
        // pump does it. One pass over a short queue, once a frame.
        window.oaSweepVoices(ctx);
        const live = (window.OA_LIVE_VOICES || []).length;
        frame[S.ACTIVE] = live > 0 ? 1 : 0;
        frame[S.PEAK_L] = 0;
        frame[S.PEAK_R] = 0;
        frame[S.USER] = live;
        frame[S.USER + 1] = window.oaPendingVoices(ctx);
        frame[S.USER + 2] = window.oaToneCacheBytes
            ? window.oaToneCacheBytes() / (1024 * 1024)
            : 0;
        // Each module counts its own buses. Reading ctx.__oaReverbs /
        // __oaDelays / __oaComps from here meant the one file that is supposed
        // to know nothing about how the effects are built was the file that
        // knew where all three of them keep their nodes.
        const built = function (fn) { return fn ? fn(ctx) : 0; };
        frame[S.USER + 3] = built(window.oaReverbBusCount)
            + built(window.oaDelayBusCount)
            + built(window.oaCompStripCount)
            + built(window.oaMasterBusCount);
    },

    dispose: window.oaDisposeVoices,
});
