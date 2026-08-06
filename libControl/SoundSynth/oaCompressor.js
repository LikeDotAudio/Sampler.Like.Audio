/**
 * Header: oaCompressor.js
 * Purpose: A FET limiting amplifier on every channel — an automatic volume
 *   control that pulls the peaks down so the whole channel can come up.
 * Description: A compressor is a volume fader that rides itself. Below a
 *   threshold it does nothing at all; above it, it turns the signal down by a
 *   fraction of however far over the line the signal went. That fraction is the
 *   RATIO: at 4:1, four decibels over the threshold are allowed out as one, so
 *   the loud parts stop running away from the quiet parts. Squash the peaks and
 *   the average level can be raised — which is the OUTPUT knob's whole job — so
 *   the channel ends up louder and steadier without ever clipping.
 *
 *   The classic this is modelled on has no threshold knob. The threshold is
 *   fixed inside the box and INPUT drives the signal into it: turn the input up
 *   and more of the waveform crosses the line, so the unit works harder. That
 *   is why the input and output knobs are always turned in opposite directions
 *   — one decides how much squashing happens, the other puts back the level the
 *   squashing took away.
 *
 *   The two time knobs are where the character lives:
 *
 *     ATTACK    How long the gain takes to come down once the signal crosses.
 *               Fast (20µs) catches the very front of a stick hit and softens
 *               it. Slow (800µs) lets the transient punch through untouched and
 *               only clamps the body behind it — which is how you make a drum
 *               hit HARDER with a compressor instead of duller.
 *
 *     RELEASE   How long the gain takes to come back after the signal drops.
 *               Too fast and the noise floor breathes up and down between hits
 *               (pumping). Too slow and one loud hit holds the channel down
 *               through everything after it.
 *
 *               Both knobs run BACKWARDS, like the original: fully clockwise is
 *               the FASTEST setting, not the slowest.
 *
 *     ALL       Every ratio button pushed in at once. On the real unit that was
 *               a fault condition people fell in love with: the threshold
 *               collapses, the knee smears, the attack lags behind itself and
 *               the whole thing pumps and distorts. Modelled here as ratio 20
 *               with the threshold dropped ~12dB, a very wide knee and a lagged
 *               attack.
 *
 *   WHERE THE SMOOTHING GOES. The textbook version smooths the detected LEVEL
 *   and derives a gain from it. This smooths the GAIN REDUCTION instead: the
 *   static curve is evaluated instantly on the rectified peak, and the attack
 *   and release constants are applied to the number of decibels of reduction on
 *   its way to that target. It costs the same and it is better behaved — the
 *   knobs then mean exactly what the panel says they mean ("time for the gain
 *   to come down"), and the ratio stays honest at every point of the envelope
 *   rather than drifting while the level detector catches up.
 *
 *   STEREO IS LINKED. One detector reads the louder of the two channels and
 *   both are turned down together. Compressing the sides independently makes a
 *   hard-panned hit shove the image sideways every time it lands.
 *
 *   The DSP runs in an AudioWorklet, per sample, off the main thread; where
 *   worklets are unavailable it falls back to the browser's own compressor node
 *   wired into the same topology. See oaFxBus.js for where it sits in the
 *   channel: after the DRIVE pedal and after the pan, as an insert on the dry
 *   path. The effect sends are tapped ahead of it, so the reverbs and the tapes
 *   are fed the channel's natural dynamics while the direct sound is squashed.
 *
 *   TRANSPARENT UNTIL ASKED: a channel that has never been compressed builds no
 *   nodes at all and connects to the output exactly as it did before.
 */

window.OA_COMP_COLOR = '#ff8c1a';

// How far apart the two ends of each time knob are. Straight off the original's
// spec sheet: 20-800 microseconds of attack, 50-1100 milliseconds of release.
const OA_COMP_ATK_SLOW = 0.0008;
const OA_COMP_ATK_FAST = 0.00002;
const OA_COMP_REL_SLOW = 1.1;
const OA_COMP_REL_FAST = 0.05;

// Both time knobs are swept exponentially and BACKWARDS — 0 is the slow end
// (fully counter-clockwise) and 1 is the fast end (fully clockwise). Linear
// travel would spend most of the knob between 600 and 800 microseconds, where
// nothing audible happens; the ear hears time constants as ratios.
window.oaCompAttackTime = function (n) {
    return OA_COMP_ATK_SLOW * Math.pow(OA_COMP_ATK_FAST / OA_COMP_ATK_SLOW, Math.max(0, Math.min(1, n)));
};
window.oaCompReleaseTime = function (n) {
    return OA_COMP_REL_SLOW * Math.pow(OA_COMP_REL_FAST / OA_COMP_REL_SLOW, Math.max(0, Math.min(1, n)));
};

const dbFmt = function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB'; };

/**
 * The front panel. `ticks` are the numbers engraved around the knob's collar —
 * evenly spaced across the travel, low end first.
 */
window.OA_COMP_PARAMS = [
    {
        key: 'input', label: 'Input', min: -12, max: 36, def: 0, fmt: dbFmt,
        ticks: ['-12', '-6', '0', '6', '12', '18', '24', '30', '36'],
        hint: 'How hard the signal is driven into a fixed threshold. This IS the threshold control.',
    },
    {
        key: 'output', label: 'Output', min: -24, max: 24, def: 0, fmt: dbFmt,
        ticks: ['-24', '-18', '-12', '-6', '0', '6', '12', '18', '24'],
        hint: 'Makeup gain — put back the level the compression took away.',
    },
    {
        key: 'attack', label: 'Attack', min: 0, max: 1, def: 0.45,
        ticks: ['1', '2', '3', '4', '5', '6', '7'],
        fmt: function (v) {
            const us = window.oaCompAttackTime(v) * 1e6;
            return us >= 1000 ? (us / 1000).toFixed(2) + ' ms' : Math.round(us) + ' µs';
        },
        hint: 'Time to clamp down. Clockwise is FASTER. Slow lets the transient through first.',
    },
    {
        key: 'release', label: 'Release', min: 0, max: 1, def: 0.5,
        ticks: ['1', '2', '3', '4', '5', '6', '7'],
        fmt: function (v) {
            const ms = window.oaCompReleaseTime(v) * 1000;
            return ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : Math.round(ms) + ' ms';
        },
        hint: 'Time to let go again. Clockwise is FASTER. Too fast and the channel breathes.',
    },
    {
        key: 'mix', label: 'Blend', min: 0, max: 1, def: 1,
        ticks: ['0', '25', '50', '75', '100'],
        fmt: function (v) { return Math.round(v * 100) + '%'; },
        hint: 'Wet against the untouched channel. Below 100% is parallel compression: the peaks are controlled but the transients survive underneath.',
    },
];

/**
 * The ratio buttons. The threshold is the same for all four numbered settings —
 * it has to be, or the buttons stop meaning what they say: give 8:1 a higher
 * threshold than 20:1 and there are input levels where pressing the HARDER
 * ratio compresses LESS, which is indefensible on a panel with no threshold
 * knob to explain it with. What does change with the ratio is the KNEE: a
 * gentle setting eases in over a wide bend, a limiter snaps to its ceiling.
 *
 * `lag` multiplies the attack constant and is 1 everywhere except ALL.
 */
window.OA_COMP_RATIOS = [
    { key: '4',  label: '4',  ratio: 4,  thresh: -24, knee: 9,  lag: 1,
      hint: '4:1 — gentle. Levels a part without announcing itself.' },
    { key: '8',  label: '8',  ratio: 8,  thresh: -24, knee: 7,  lag: 1,
      hint: '8:1 — firm. You can hear it working, and that is the point.' },
    { key: '12', label: '12', ratio: 12, thresh: -24, knee: 5,  lag: 1,
      hint: '12:1 — heavy. Peaks are held down hard.' },
    { key: '20', label: '20', ratio: 20, thresh: -24, knee: 3,  lag: 1,
      hint: '20:1 — a limiter. Effectively a ceiling the signal cannot cross.' },
    { key: 'all', label: 'ALL', ratio: 20, thresh: -36, knee: 16, lag: 3.5,
      hint: 'Every button in at once. Threshold collapses, the knee smears and the attack lags — it pumps, it distorts, it is enormous.' },
];

window.oaCompRatio = function (key) {
    return window.OA_COMP_RATIOS.find(function (r) { return r.key === key; })
        || window.OA_COMP_RATIOS[0];
};

// Where the meter needle is pointing. GR is the one that matters; the two OUT
// positions are a level meter on the compressor's output, calibrated so 0VU
// sits at -18 or -14 dBFS respectively.
window.OA_COMP_METERS = [
    { key: 'gr',  label: 'GR',  hint: 'Gain reduction — how many dB are being taken off, right to left.' },
    { key: '+8',  label: '+8',  ref: -14, hint: 'Output level, 0VU at -14 dBFS.' },
    { key: '+4',  label: '+4',  ref: -18, hint: 'Output level, 0VU at -18 dBFS.' },
    { key: 'off', label: 'OFF', hint: 'Needle parked.' },
];

window.OA_COMP_PRESETS = {
    glue:    { label: 'Glue',            on: true, ratio: '4',   input: 6,  output: -3, attack: 0.25, release: 0.55, mix: 1 },
    punch:   { label: 'Drum Punch',      on: true, ratio: '4',   input: 10, output: -5, attack: 0.10, release: 0.80, mix: 1 },
    snap:    { label: 'Snap (fast atk)', on: true, ratio: '8',   input: 12, output: -6, attack: 0.95, release: 0.70, mix: 1 },
    vocal:   { label: 'Vocal 4:1',       on: true, ratio: '4',   input: 8,  output: -4, attack: 0.45, release: 0.50, mix: 1 },
    parallel:{ label: 'Parallel Crush',  on: true, ratio: '20',  input: 22, output: -8, attack: 0.85, release: 0.90, mix: 0.45 },
    limit:   { label: 'Peak Limit',      on: true, ratio: '20',  input: 4,  output: 0,  attack: 1.00, release: 0.85, mix: 1 },
    smash:   { label: 'All Buttons In',  on: true, ratio: 'all', input: 16, output: -9, attack: 0.75, release: 0.95, mix: 1 },
    bypass:  { label: 'Bypass',          on: false,ratio: '4',   input: 0,  output: 0,  attack: 0.45, release: 0.5,  mix: 1 },
};

// Fill in whatever a saved unit is missing and drop anything out of range, so a
// hand-edited or half-written localStorage entry still comes up playable.
const cmpUnit = function (saved) {
    const s = saved || {};
    const out = { on: !!s.on, ratio: window.oaCompRatio(s.ratio).key, meter: 'gr' };
    if (window.OA_COMP_METERS.some(function (m) { return m.key === s.meter; })) out.meter = s.meter;
    window.OA_COMP_PARAMS.forEach(function (p) {
        const v = Number(s[p.key]);
        out[p.key] = isFinite(v) ? Math.max(p.min, Math.min(p.max, v)) : p.def;
    });
    return out;
};

window.OA_COMP = (function () {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('oaComp')); } catch (e) {}
    const units = (saved && Array.isArray(saved.units)) ? saved.units : [];
    // Sized for the LARGEST grid, like every other per-channel array, so
    // shrinking the pad layout and growing it back finds pad 25's settings.
    const out = [];
    for (let i = 0; i < window.OA_PAD_MAX; i++) out.push(cmpUnit(units[i]));
    return { units: out };
})();

window.oaCompUnit = function (idx) {
    return window.OA_COMP.units[idx] || window.OA_COMP.units[0];
};

window.oaSaveComp = function () {
    try {
        window.localStorage.setItem('oaComp', JSON.stringify({
            units: window.OA_COMP.units.map(function (u) {
                const o = { on: u.on, ratio: u.ratio, meter: u.meter };
                window.OA_COMP_PARAMS.forEach(function (p) { o[p.key] = u[p.key]; });
                return o;
            })
        }));
    } catch (e) {}
};

/** Is this channel's compressor doing anything at all? */
window.oaCompActive = function (idx) {
    const u = window.oaCompUnit(idx);
    return !!u.on && u.mix > 0.0005;
};

// ---------------------------------------------------------------------------
// The worklet. Shipped as a source string and registered from a Blob URL: the
// whole app is one compiled bundle, and a worklet module has to be a separate
// fetchable file. Registered alongside the tape echo by oaPrepareFx().
// ---------------------------------------------------------------------------
const OA_COMP_WORKLET_SRC = `
class OaLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'inGain',  defaultValue: 1,      minValue: 0,       maxValue: 64,  automationRate: 'k-rate' },
      { name: 'outGain', defaultValue: 1,      minValue: 0,       maxValue: 32,  automationRate: 'k-rate' },
      { name: 'attack',  defaultValue: 0.0002, minValue: 0.00001, maxValue: 0.01, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.25,   minValue: 0.01,    maxValue: 2,   automationRate: 'k-rate' },
      { name: 'ratio',   defaultValue: 4,      minValue: 1,       maxValue: 20,  automationRate: 'k-rate' },
      { name: 'thresh',  defaultValue: -24,    minValue: -60,     maxValue: 0,   automationRate: 'k-rate' },
      { name: 'knee',    defaultValue: 9,      minValue: 0,       maxValue: 24,  automationRate: 'k-rate' },
      { name: 'mix',     defaultValue: 1,      minValue: 0,       maxValue: 1,   automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.gr = 0;        // gain reduction currently applied, in dB (never negative)
    this.grPeak = 0;    // worst reduction since the last report
    this.blocks = 0;
    this.lastSent = -1;
    this.quiet = 1e9;
  }

  // The output stage cannot pass an arbitrarily large number, and neither could
  // the transformer this is standing in for. Dead linear below 0.7 so ordinary
  // material is untouched, then bent asymptotically into a ceiling at 1.0 — so
  // a heavy makeup setting saturates instead of clipping into a square edge.
  sat(x) {
    const a = x < 0 ? -x : x;
    if (a <= 0.7) return x;
    const over = (a - 0.7) / 0.3;
    const y = 0.7 + 0.3 * (over < 3 ? Math.tanh(over) : 1);
    return x < 0 ? -y : y;
  }

  // Report the needle position back to the panel. Throttled to roughly every
  // 20ms, and silent once the channel has settled at zero — sixteen channels
  // posting a message per 128 samples would be a message every 0.36ms.
  report() {
    const v = Math.round(this.grPeak * 100) / 100;
    if (v === 0 && this.lastSent === 0) return;
    this.lastSent = v;
    this.port.postMessage(v);
  }

  process(inputs, outputs, params) {
    const output = outputs[0];
    if (!output || !output.length) return true;
    const outL = output[0];
    const outR = output[1] || output[0];
    const n = outL.length;

    const input = inputs[0];
    const inL = (input && input.length) ? input[0] : null;
    const inR = (input && input.length > 1) ? input[1] : inL;

    if (!inL) {
      outL.fill(0);
      if (outR !== outL) outR.fill(0);
      this.gr = 0;
      this.grPeak = 0;
      this.report();
      return true;
    }

    const mix = params.mix[0];

    // Blend at zero is a wire. Copy it through rather than running a detector
    // over silence-adjacent arithmetic sixteen times a buffer.
    if (mix <= 1e-6) {
      outL.set(inL);
      if (outR !== outL) outR.set(inR || inL);
      this.gr = 0;
      this.grPeak = 0;
      this.report();
      return true;
    }

    let inPeak = 0;
    for (let i = 0; i < n; i++) {
      const a = inL[i] > 0 ? inL[i] : -inL[i];
      if (a > inPeak) inPeak = a;
    }
    // Nothing coming in and the gain already back up: there is no work to do.
    if (inPeak < 1e-7 && this.gr < 1e-3) {
      outL.fill(0);
      if (outR !== outL) outR.fill(0);
      this.gr = 0;
      this.grPeak = 0;
      this.quiet += n;
      this.blocks++;
      if (this.blocks >= 4) { this.blocks = 0; this.report(); }
      return true;
    }
    this.quiet = 0;

    const inGain = params.inGain[0];
    const outGain = params.outGain[0];
    const ratio = params.ratio[0];
    const thresh = params.thresh[0];
    const knee = params.knee[0];
    const slope = 1 - 1 / ratio;        // fraction of every dB over the line that gets removed
    const half = knee * 0.5;

    // One-pole coefficients. A time constant of t seconds reaches ~63% of the
    // way to its target in t; that is the standard definition and it is what
    // the numbers on the panel mean.
    const aCoef = 1 - Math.exp(-1 / Math.max(1, params.attack[0] * sampleRate));
    const rCoef = 1 - Math.exp(-1 / Math.max(1, params.release[0] * sampleRate));

    const dry = 1 - mix;
    let gr = this.gr;
    let peak = this.grPeak;

    for (let i = 0; i < n; i++) {
      const l = inL[i];
      const r = inR ? inR[i] : l;

      // STEREO-LINKED PEAK DETECTION. The louder side decides for both, so a
      // hard-panned hit turns the pair down together instead of walking the
      // image across the room.
      const al = l > 0 ? l : -l;
      const ar = r > 0 ? r : -r;
      const det = (al > ar ? al : ar) * inGain;

      // Rectified peak straight into the static curve — no smoothing here. The
      // ballistics go on the gain, two lines further down.
      const db = det > 1e-9 ? 8.6858896 * Math.log(det) : -180;   // 20*log10(x)
      const over = db - thresh;

      // The knee. Below it nothing happens, above it the full ratio applies,
      // and across the knee width the two are joined by a parabola so the
      // compressor eases in rather than switching on at a corner. A corner is
      // a discontinuity in the gain, and a discontinuity is a click.
      let target;
      if (over <= -half) target = 0;
      else if (over >= half) target = over * slope;
      else {
        const t = over + half;
        target = slope * t * t / (2 * knee);
      }

      // ATTACK when the reduction is deepening, RELEASE when it is letting go.
      gr += (target - gr) * (target > gr ? aCoef : rCoef);
      if (gr > peak) peak = gr;

      // dB of reduction back to a linear multiplier: 10^(-gr/20).
      const g = Math.exp(-0.11512925 * gr) * inGain * outGain;

      const wetL = this.sat(l * g);
      const wetR = this.sat(r * g);
      outL[i] = wetL * mix + l * dry;
      if (outR !== outL) outR[i] = wetR * mix + r * dry;
    }

    this.gr = gr;
    this.grPeak = peak;
    this.blocks++;
    if (this.blocks >= 4) {
      this.blocks = 0;
      this.report();
      // Decay the reported peak rather than resetting it, so the needle falls
      // smoothly between reports instead of flickering to zero and back.
      this.grPeak = gr;
    }
    return true;
  }
}
registerProcessor('oa-limiter', OaLimiter);
`;

let oaCompUrl = null;
// Read by oaPrepareFx() in oaTapeDelay.js, which registers every worklet module
// the effects need in one pass on first use of a context.
window.oaCompModuleUrl = function () {
    if (!oaCompUrl) {
        oaCompUrl = URL.createObjectURL(new Blob([OA_COMP_WORKLET_SRC], { type: 'application/javascript' }));
    }
    return oaCompUrl;
};

// The live values behind the panel, resolved through the ratio button and the
// on/off switch. One place, so the worklet and the native chain cannot drift.
const compSettings = function (unit) {
    const r = window.oaCompRatio(unit.ratio);
    const on = !!unit.on;
    return {
        inGain: on ? Math.pow(10, unit.input / 20) : 1,
        outGain: on ? Math.pow(10, unit.output / 20) : 1,
        attack: window.oaCompAttackTime(unit.attack) * r.lag,
        release: window.oaCompReleaseTime(unit.release),
        ratio: r.ratio,
        thresh: r.thresh,
        knee: r.knee,
        // The switch and the blend knob are the same lever as far as the DSP is
        // concerned: at 0 the wet path contributes nothing and the output is
        // the input, sample for sample.
        mix: on ? unit.mix : 0,
    };
};

const workletEngine = function (ctx, unit, bus) {
    const node = new AudioWorkletNode(ctx, 'oa-limiter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
    });
    const s = compSettings(unit);
    Object.keys(s).forEach(function (k) {
        const p = node.parameters.get(k);
        if (p) p.value = s[k];
    });
    node.port.onmessage = function (e) { bus.gr = e.data; };

    return {
        input: node,
        output: node,
        apply: function (u) {
            const next = compSettings(u);
            const t = ctx.currentTime;
            Object.keys(next).forEach(function (k) {
                const p = node.parameters.get(k);
                // Short enough to feel immediate, long enough that dragging a
                // knob is a slide rather than a staircase of zipper noise.
                if (p) p.setTargetAtTime(next[k], t, 0.02);
            });
        },
        gr: null,
    };
};

/**
 * The same topology from native nodes, for browsers without AudioWorklet. The
 * browser's own compressor is a feed-forward peak design with a soft knee, so
 * the shape is right; what it will not do is the ALL-buttons lag, and it adds
 * a few milliseconds of its own latency that the worklet does not.
 */
const nativeEngine = function (ctx, unit) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const pre = ctx.createGain();
    const post = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();

    input.connect(dry);
    dry.connect(output);
    input.connect(pre);
    pre.connect(comp);
    comp.connect(post);
    post.connect(wet);
    wet.connect(output);

    const apply = function (u) {
        const s = compSettings(u);
        const t = ctx.currentTime;
        pre.gain.setTargetAtTime(s.inGain, t, 0.02);
        post.gain.setTargetAtTime(s.outGain, t, 0.02);
        wet.gain.setTargetAtTime(s.mix, t, 0.02);
        dry.gain.setTargetAtTime(1 - s.mix, t, 0.02);
        comp.threshold.setTargetAtTime(s.thresh, t, 0.02);
        comp.knee.setTargetAtTime(s.knee, t, 0.02);
        comp.ratio.setTargetAtTime(s.ratio, t, 0.02);
        // The native node's attack and release cannot go below 0 or above 1s.
        comp.attack.setTargetAtTime(Math.max(0, Math.min(1, s.attack)), t, 0.02);
        comp.release.setTargetAtTime(Math.max(0.01, Math.min(1, s.release)), t, 0.02);
    };
    apply(unit);

    return {
        input: input, output: output, apply: apply,
        // No message port here — the meter reads the node's own reduction,
        // which the spec reports as a NEGATIVE number of dB.
        gr: function () { return -comp.reduction; },
    };
};

/**
 * The channel's compressor, built once per AudioContext and shared by every
 * voice on that channel — which is the point. A compressor built per hit would
 * start with its gain wide open every time, so a fast run of hits would never
 * duck each other and the release knob would have nothing to act on.
 *
 * Returns null for a channel that has never been switched on, and the caller
 * connects to the output exactly as it did before. Once built the strip stays:
 * switching the unit off sets its blend to zero, which passes the input through
 * untouched rather than tearing a live node out of a running graph.
 */
window.oaCompStrip = function (ctx, idx) {
    const strips = ctx.__oaComps || (ctx.__oaComps = []);
    if (strips[idx]) return strips[idx];
    if (!window.oaCompActive(idx)) return null;

    const unit = window.oaCompUnit(idx);
    const input = ctx.createGain();
    const output = ctx.createGain();
    output.connect(ctx.destination);

    const bus = { input: input, output: output, engine: null, gr: 0, analyser: null };

    try {
        // A voice may be built before the module has finished registering. The
        // native chain is synchronous and always available, so an unresolved
        // worklet falls back rather than leaving the channel silent while it
        // waits — which on an OfflineAudioContext would be the whole render.
        bus.engine = ctx.__oaWorkletOk ? workletEngine(ctx, unit, bus) : nativeEngine(ctx, unit);
    } catch (e) {
        console.warn('⚠️ [Compressor] worklet node failed, using native chain:', e && e.message);
        bus.engine = nativeEngine(ctx, unit);
    }
    input.connect(bus.engine.input);
    bus.engine.output.connect(output);

    if (ctx.createAnalyser) {
        const a = ctx.createAnalyser();
        a.fftSize = 1024;
        output.connect(a);
        bus.analyser = a;
    }

    strips[idx] = bus;
    return bus;
};

/** Gain reduction on this channel right now, in dB. 0 when nothing is running. */
window.oaCompGR = function (idx) {
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaComps && ctx.__oaComps[idx];
    if (!bus) return 0;
    if (bus.engine && bus.engine.gr) return Math.max(0, bus.engine.gr());
    return Math.max(0, bus.gr || 0);
};

const pushToBus = function (idx) {
    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaComps && ctx.__oaComps[idx];
    if (bus && bus.engine) bus.engine.apply(window.oaCompUnit(idx));
};

window.oaSetComp = function (idx, key, value) {
    const u = window.oaCompUnit(idx);
    if (key === 'on') u.on = !!value;
    else if (key === 'ratio') u.ratio = window.oaCompRatio(value).key;
    else if (key === 'meter') u.meter = value;
    else {
        const p = window.OA_COMP_PARAMS.find(function (q) { return q.key === key; });
        if (!p) return;
        u[key] = Math.max(p.min, Math.min(p.max, Number(value) || 0));
    }
    window.oaSaveComp();
    // The meter switch is a panel decoration — it changes nothing in the audio.
    if (key !== 'meter') pushToBus(idx);
    window.dispatchEvent(new CustomEvent('oa-comp-changed', { detail: { idx: idx, key: key } }));
};

window.oaApplyCompPreset = function (idx, name) {
    const preset = window.OA_COMP_PRESETS[name];
    if (!preset) return;
    const u = window.oaCompUnit(idx);
    u.on = !!preset.on;
    u.ratio = window.oaCompRatio(preset.ratio).key;
    window.OA_COMP_PARAMS.forEach(function (p) {
        if (typeof preset[p.key] === 'number') u[p.key] = Math.max(p.min, Math.min(p.max, preset[p.key]));
    });
    window.oaSaveComp();
    pushToBus(idx);
    window.dispatchEvent(new CustomEvent('oa-comp-changed', { detail: { idx: idx, preset: name } }));
};
