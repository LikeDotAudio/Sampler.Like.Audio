/**
 * Header: oaChorus.js
 * Purpose: A Dimension-D style stereo chorus, sat after each tape echo.
 * Description: The Roland SDD-320 was never really a chorus — it was a width
 *   box. A conventional chorus sweeps a delayed copy hard enough that you hear
 *   the pitch move, which is the warble everyone recognises. This does the
 *   opposite: the sweep is kept so shallow it is almost inaudible on its own,
 *   the two sides are swept in OPPOSITE directions, and the wet copy is added
 *   to the left and SUBTRACTED from the right.
 *
 *   That last part is the whole trick. Out-of-phase across the pair, the wet
 *   signal cancels itself when the mix is folded to mono, so the effect adds
 *   almost nothing you can point at — the ear reads the phase difference
 *   between the sides as space, and the sound simply arrives wider and closer
 *   without a warble sitting on top of it.
 *
 *   Like the original there are no knobs: an OFF button and four modes, mutual
 *   exclusive, going from a gentle shimmer to the deepest setting the box has.
 */

// One entry per front-panel button. `base` is the nominal head distance (the
// BBD delay), `depth` the peak sweep either side of it, `rate` the LFO speed
// and `mix` how much of the swept copy is cross-fed into the output.
window.OA_CHORUS_MODES = [
    { name: 'OFF', label: 'Bypass',   base: 0.0070, rate: 0,    depth: 0,       mix: 0 },
    { name: '1',   label: 'Mode 1',   base: 0.0068, rate: 0.35, depth: 0.00018, mix: 0.32 },
    { name: '2',   label: 'Mode 2',   base: 0.0072, rate: 0.42, depth: 0.00026, mix: 0.44 },
    { name: '3',   label: 'Mode 3',   base: 0.0078, rate: 0.62, depth: 0.00040, mix: 0.58 },
    { name: '4',   label: 'Mode 4',   base: 0.0085, rate: 0.88, depth: 0.00062, mix: 0.72 },
];
window.OA_CHORUS_COUNT = window.OA_CHORUS_MODES.length;

window.oaChorusMode = function (m) {
    const i = Math.max(0, Math.min(window.OA_CHORUS_COUNT - 1, m | 0));
    return window.OA_CHORUS_MODES[i];
};

/**
 * Build one chorus. Returns { input, output, setMode } — an insert, so it
 * passes the dry through untouched and adds the swept pair on top. At mode 0
 * every wet gain is zero and what comes out is bit-for-bit what went in.
 */
window.oaChorusNode = function (ctx, mode) {
    const spec = window.oaChorusMode(mode);

    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    input.connect(dry);
    dry.connect(output);

    // Everything below ~140Hz stays where it was. Low frequencies carry a lot
    // of the level, and cross-fading them out of phase hollows the bottom out
    // the moment anyone folds the mix to mono.
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 140;
    // Forced to two channels ahead of the splitter. A mono source fed into a
    // splitter lands on channel 0 and leaves channel 1 silent, which would put
    // the whole effect on the left and lose the cancellation the design rests
    // on — the tape output is stereo, but nothing else should have to be.
    hp.channelCount = 2;
    hp.channelCountMode = 'explicit';
    hp.channelInterpretation = 'speakers';
    input.connect(hp);

    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    hp.connect(split);

    const dL = ctx.createDelay(0.05);
    const dR = ctx.createDelay(0.05);
    dL.delayTime.value = spec.base;
    dR.delayTime.value = spec.base;
    split.connect(dL, 0);
    split.connect(dR, 1);

    // The out-of-phase cross-mix: the right side's copy is inverted, so the
    // pair cancels in mono and only the width survives.
    const wetL = ctx.createGain();
    const wetR = ctx.createGain();
    wetL.gain.value = spec.mix;
    wetR.gain.value = -spec.mix;
    dL.connect(wetL);
    dR.connect(wetR);
    wetL.connect(merge, 0, 0);
    wetR.connect(merge, 0, 1);
    merge.connect(output);

    // One LFO, wired in opposite polarity to the two heads, so as the left
    // side stretches the right side shortens. Sweeping them together would
    // just be a chorus; sweeping them apart is what opens the stereo field.
    const lfo = ctx.createOscillator();
    const swL = ctx.createGain();
    const swR = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = spec.rate || 0.35;
    swL.gain.value = spec.depth;
    swR.gain.value = -spec.depth;
    lfo.connect(swL);
    lfo.connect(swR);
    swL.connect(dL.delayTime);
    swR.connect(dR.delayTime);
    try { lfo.start(); } catch (e) {}

    const setMode = function (m) {
        const s = window.oaChorusMode(m);
        const t = ctx.currentTime;
        // Long enough that punching a button crossfades rather than clicks,
        // short enough that it still feels like a button.
        dL.delayTime.setTargetAtTime(s.base, t, 0.05);
        dR.delayTime.setTargetAtTime(s.base, t, 0.05);
        wetL.gain.setTargetAtTime(s.mix, t, 0.03);
        wetR.gain.setTargetAtTime(-s.mix, t, 0.03);
        swL.gain.setTargetAtTime(s.depth, t, 0.05);
        swR.gain.setTargetAtTime(-s.depth, t, 0.05);
        // Hold the last speed through a bypass — restarting the sweep from a
        // dead stop makes the next mode land with a lurch.
        if (s.rate) lfo.frequency.setTargetAtTime(s.rate, t, 0.1);
    };

    return { input: input, output: output, setMode: setMode };
};
