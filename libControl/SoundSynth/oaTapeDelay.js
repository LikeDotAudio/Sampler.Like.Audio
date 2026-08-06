/**
 * Header: oaTapeDelay.js
 * Purpose: Four shared tape-echo buses, modelled on a Space Echo.
 * Description: Each unit is a mechanical tape loop simulated in digital memory.
 *   A circular buffer IS the tape; the write index is the record head, and two
 *   read points trailing behind it are the stereo playback heads. An LFO
 *   modulates the distance between record and playback heads, which is wow and
 *   flutter — the pitch wobble that reads as chorus. The read output is folded
 *   back into the record head through a soft clipper, so every pass through the
 *   loop gets warmer, darker and more compressed, exactly as magnetic tape
 *   saturates.
 *
 *   The DSP runs in an AudioWorklet (per-sample, off the main thread). Where
 *   worklets are unavailable the bus falls back to a native node chain that
 *   reproduces the same topology at coarser resolution.
 *
 *   These are send effects: the node outputs WET ONLY. Dry comes from each
 *   channel's own path in oaFxBus.js. Each unit can also feed the reverb buses,
 *   so a repeat can be thrown into a room.
 */

// The tape parameters, and the ranges the panel draws its faders from. `key`
// doubles as the AudioParam name inside the worklet.
window.OA_DELAY_PARAMS = [
    { key: 'timeL',    label: 'Head L',   min: 0.01, max: 2.0,   step: 0.001, unit: 's',  fmt: (v) => Math.round(v * 1000) + ' ms' },
    { key: 'timeR',    label: 'Head R',   min: 0.01, max: 2.0,   step: 0.001, unit: 's',  fmt: (v) => Math.round(v * 1000) + ' ms' },
    { key: 'feedback', label: 'Intensity',min: 0,    max: 1.1,   step: 0.01,  unit: '',   fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'drive',    label: 'Tape Drive',min: 0.5, max: 6,     step: 0.05,  unit: '',   fmt: (v) => v.toFixed(2) + 'x' },
    { key: 'wowRate',  label: 'Wow Rate', min: 0.05, max: 8,     step: 0.01,  unit: 'Hz', fmt: (v) => v.toFixed(2) + ' Hz' },
    { key: 'wowDepth', label: 'Flutter',  min: 0,    max: 0.02,  step: 0.0002,unit: '',   fmt: (v) => (v * 1000).toFixed(1) + ' ms' },
    { key: 'damp',     label: 'Tape Age', min: 800,  max: 16000, step: 50,    unit: 'Hz', fmt: (v) => Math.round(v) + ' Hz' },
];

// Classic settings, so the four units are four different machines out of the
// box rather than four copies of one.
window.OA_DELAY_PRESETS = {
    slap:    { label: 'Slapback',  timeL: 0.085, timeR: 0.115, feedback: 0.18, drive: 1.6, wowRate: 0.7,  wowDepth: 0.0012, damp: 7000 },
    tape:    { label: 'Tape Echo', timeL: 0.28,  timeR: 0.42,  feedback: 0.45, drive: 1.9, wowRate: 0.9,  wowDepth: 0.0030, damp: 5000 },
    space:   { label: 'Space',     timeL: 0.50,  timeR: 0.75,  feedback: 0.62, drive: 2.3, wowRate: 0.45, wowDepth: 0.0050, damp: 3400 },
    dub:     { label: 'Dub Sink',  timeL: 0.75,  timeR: 1.00,  feedback: 0.82, drive: 3.0, wowRate: 0.30, wowDepth: 0.0080, damp: 2200 },
    warble:  { label: 'Warble',    timeL: 0.20,  timeR: 0.20,  feedback: 0.30, drive: 2.6, wowRate: 3.40, wowDepth: 0.0120, damp: 4200 },
    oscillate:{label: 'Runaway',   timeL: 0.34,  timeR: 0.51,  feedback: 1.02, drive: 2.0, wowRate: 0.6,  wowDepth: 0.0040, damp: 3000 },
};

// A head can be locked to the grid instead of set in milliseconds. The lock is
// stored as a count of 16th notes, so it survives a tempo change: the head time
// is re-derived whenever the BPM moves.
window.OA_DELAY_SIXTEENTH = (bpm) => 15 / Math.max(20, bpm || 120);   // 60 / bpm / 4

const BEAT_NAMES = {
    1: '1/16', 2: '1/8', 3: '1/8.', 4: '1/4', 6: '1/4.', 8: '1/2', 12: '1/2.',
    16: '1 bar', 24: '1.5 bars', 32: '2 bars', 48: '3 bars', 64: '4 bars',
};
window.oaBeatLabel = function (steps) {
    return BEAT_NAMES[steps] || steps + '/16';
};

window.OA_DELAY_UNITS = [
    { name: 'DLY 1', color: '#cbbcff', preset: 'slap' },
    { name: 'DLY 2', color: '#a893ff', preset: 'tape' },
    { name: 'DLY 3', color: '#8a72f0', preset: 'space' },
    { name: 'DLY 4', color: '#6f5ad8', preset: 'dub' },
];
window.OA_DELAY_COUNT = window.OA_DELAY_UNITS.length;

const dlUnit = function (saved, i) {
    const base = window.OA_DELAY_PRESETS[window.OA_DELAY_UNITS[i].preset];
    const s = saved || {};
    const sends = window.oaFxSendArray(s.sends);
    // How much of this delay's return is thrown into each reverb.
    const toRv = Array.isArray(s.toRv) ? s.toRv.slice(0, window.OA_REVERB_COUNT).map((v) => Number(v) || 0) : [];
    while (toRv.length < window.OA_REVERB_COUNT) toRv.push(0);

    const unit = {
        sends: sends, toRv: toRv, ret: typeof s.ret === 'number' ? s.ret : 0.5,
        // 16ths each head is locked to; 0 means it is set free in milliseconds.
        syncL: Math.max(0, Math.min(64, Number(s.syncL) || 0)),
        syncR: Math.max(0, Math.min(64, Number(s.syncR) || 0)),
    };
    window.OA_DELAY_PARAMS.forEach((p) => {
        const v = Number(s[p.key]);
        unit[p.key] = isFinite(v) && s[p.key] !== undefined
            ? Math.max(p.min, Math.min(p.max, v))
            : base[p.key];
    });
    return unit;
};

window.OA_DELAY = (function () {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('oaDelay')); } catch (e) {}
    const units = (saved && Array.isArray(saved.units)) ? saved.units : [];
    return { units: window.OA_DELAY_UNITS.map((d, i) => dlUnit(units[i], i)) };
})();

window.oaDelayUnit = function (u) {
    return window.OA_DELAY.units[u] || window.OA_DELAY.units[0];
};

window.oaSaveDelay = function () {
    try { window.localStorage.setItem('oaDelay', JSON.stringify(window.OA_DELAY)); } catch (e) {}
};

// ---------------------------------------------------------------------------
// The worklet. Shipped as a source string and registered from a Blob URL: the
// whole app is one compiled bundle, and a worklet module has to be a separate
// fetchable file.
// ---------------------------------------------------------------------------
const OA_TAPE_WORKLET_SRC = `
class OaTapeEcho extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'timeL',    defaultValue: 0.28,  minValue: 0.005, maxValue: 2.0,   automationRate: 'k-rate' },
      { name: 'timeR',    defaultValue: 0.42,  minValue: 0.005, maxValue: 2.0,   automationRate: 'k-rate' },
      { name: 'feedback', defaultValue: 0.45,  minValue: 0,     maxValue: 1.1,   automationRate: 'k-rate' },
      { name: 'drive',    defaultValue: 1.9,   minValue: 0.5,   maxValue: 6,     automationRate: 'k-rate' },
      { name: 'wowRate',  defaultValue: 0.9,   minValue: 0.02,  maxValue: 8,     automationRate: 'k-rate' },
      { name: 'wowDepth', defaultValue: 0.003, minValue: 0,     maxValue: 0.02,  automationRate: 'k-rate' },
      { name: 'damp',     defaultValue: 5000,  minValue: 200,   maxValue: 18000, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    // Round the tape length up to a power of two so wrapping the heads is a
    // bitwise AND rather than a modulo, millions of times a second.
    const need = sampleRate * 2.3;
    let n = 1;
    while (n < need) n <<= 1;
    this.tape = new Float32Array(n);
    this.size = n;
    this.mask = n - 1;

    this.write = 0;
    this.phase = 0;
    this.lp = 0;          // tape head roll-off, integrated across passes
    this.hp = 0;          // DC/rumble blocker, so feedback cannot walk away
    this.headL = 0.28 * sampleRate;
    this.headR = 0.42 * sampleRate;
    this.primed = false;
    this.quiet = 1e9;     // samples since anything was heard, in or out
  }

  // True tape does not clip cleanly — the particles saturate and the waveform
  // rounds off. Pade approximation of tanh: same curve, a fraction of the cost.
  softClip(x) {
    if (x < -3) return -1;
    if (x > 3) return 1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
  }

  // Read the tape at a FRACTIONAL distance behind the record head. Interpolating
  // is what makes the wow smooth: stepping whole samples as the head drifts
  // crackles instead of bending pitch.
  read(offset) {
    let pos = this.write - offset;
    while (pos < 0) pos += this.size;
    while (pos >= this.size) pos -= this.size;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = this.tape[i0 & this.mask];
    const b = this.tape[(i0 + 1) & this.mask];
    return a + frac * (b - a);
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;
    const outL = output[0];
    const outR = output[1] || output[0];

    const inL = (input && input.length) ? input[0] : null;
    const inR = (input && input.length > 1) ? input[1] : inL;
    const n = outL.length;

    // Nothing coming in and nothing left on the tape: park the motor. The write
    // head stops where it is, so the head spacing is untouched when it wakes.
    let inPeak = 0;
    if (inL) {
      for (let i = 0; i < n; i++) {
        const a = inL[i] > 0 ? inL[i] : -inL[i];
        if (a > inPeak) inPeak = a;
      }
    }
    if (inPeak < 1e-7 && this.quiet > this.size) {
      outL.fill(0);
      outR.fill(0);
      this.quiet += n;
      return true;
    }

    const timeL = params.timeL[0];
    const timeR = params.timeR[0];
    const feedback = params.feedback[0];
    const drive = params.drive[0];
    const wowRate = params.wowRate[0];
    const wowDepth = params.wowDepth[0] * sampleRate;
    const damp = params.damp[0];

    const tgtL = timeL * sampleRate;
    const tgtR = timeR * sampleRate;
    if (!this.primed) { this.headL = tgtL; this.headR = tgtR; this.primed = true; }

    // A tape motor cannot change speed instantly. Gliding the head distance
    // over ~120ms turns a knob twist into the pitch swoop the real machine
    // makes, and keeps the jump from clicking.
    const glide = 1 - Math.exp(-1 / (0.12 * sampleRate));
    const phaseInc = (wowRate * 2 * Math.PI) / sampleRate;
    const lpCoef = 1 - Math.exp(-2 * Math.PI * damp / sampleRate);
    const hpCoef = 1 - Math.exp(-2 * Math.PI * 55 / sampleRate);
    // Record level, with the playback amp trimmed by the same amount. Quiet
    // material comes back unchanged and loud material squashes, so the knob is
    // purely how hard the tape is hit — and, because the loop gain stays at
    // exactly the feedback setting, Intensity means what it says: it runs away
    // at 100% rather than at some drive-dependent fraction of it.
    const makeup = 1 / drive;
    const limit = this.size - 4;

    let peak = 0;

    for (let i = 0; i < n; i++) {
      this.headL += (tgtL - this.headL) * glide;
      this.headR += (tgtR - this.headR) * glide;

      // Wow (slow) plus flutter (a faster, shallower wobble on top). Inverted
      // on the right head so the two sides drift apart and the repeats widen.
      this.phase += phaseInc;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
      const drift = Math.sin(this.phase) * wowDepth
                  + Math.sin(this.phase * 6.31 + 1.7) * wowDepth * 0.28;

      let dL = this.headL + drift;
      let dR = this.headR - drift;
      if (dL < 2) dL = 2; else if (dL > limit) dL = limit;
      if (dR < 2) dR = 2; else if (dR > limit) dR = limit;

      const echoL = this.read(dL);
      const echoR = this.read(dR);

      const dry = inL ? (inL[i] + (inR ? inR[i] : inL[i])) * 0.5 : 0;
      // Feedback is taken off the LEFT head alone, the way a real machine taps
      // one playback head. Summing both would comb the loop — they drift in
      // opposite directions, so at similar head spacings the two copies arrive
      // out of phase and cancel, and the repeats die however high Intensity is.
      const fb = echoL * feedback;

      // Record head: input and feedback hit the tape together, so the repeats
      // saturate a little more on every lap.
      let rec = this.softClip((dry + fb) * drive) * makeup;
      this.lp += lpCoef * (rec - this.lp);          // heads lose the top end
      this.hp += hpCoef * (this.lp - this.hp);      // and never hold DC
      const tapeSignal = this.lp - this.hp;

      this.tape[this.write] = tapeSignal;
      this.write = (this.write + 1) & this.mask;

      outL[i] = echoL;
      outR[i] = echoR;

      const a = echoL > 0 ? echoL : -echoL;
      if (a > peak) peak = a;
    }

    if (peak > 1e-6 || inPeak > 1e-7) this.quiet = 0;
    else this.quiet += n;
    return true;
  }
}
registerProcessor('oa-tape-echo', OaTapeEcho);
`;

let oaTapeUrl = null;
const tapeModuleUrl = function () {
    if (!oaTapeUrl) {
        oaTapeUrl = URL.createObjectURL(new Blob([OA_TAPE_WORKLET_SRC], { type: 'application/javascript' }));
    }
    return oaTapeUrl;
};

/**
 * Register the tape processor on a context. Resolves to true if the worklet is
 * usable. Cached per context, and `ctx.__oaWorkletOk` is set once it settles so
 * bus construction can go straight to the right engine without waiting — which
 * an OfflineAudioContext needs, since it schedules and renders in one tick.
 */
window.oaPrepareFx = function (ctx) {
    if (!ctx.__oaFxReady) {
        ctx.__oaFxReady = (async function () {
            let ok = false;
            try {
                if (ctx.audioWorklet && window.AudioWorkletNode && window.Blob && window.URL) {
                    await ctx.audioWorklet.addModule(tapeModuleUrl());
                    ok = true;
                }
            } catch (e) {
                console.warn('⚠️ [TapeDelay] worklet unavailable, using native chain:', e && e.message);
            }
            ctx.__oaWorkletOk = ok;
            return ok;
        })();
    }
    return ctx.__oaFxReady;
};

// The same topology built from native nodes: drive → tape → two heads, one
// shared damped feedback path, one LFO wobbling both heads in opposite
// directions. Coarser than the worklet (the saturation sits before the loop
// rather than inside it) but it is a tape echo, not a plain delay.
const nativeEngine = function (ctx, unit) {
    const inGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    // A shaper's domain is fixed at ±1, so the curve carries a 3x drive of its
    // own; `inGain` scales by drive/3 and `tape` trims by 1/drive, which lands
    // on the same unity-for-quiet, squashed-for-loud curve the worklet uses.
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
        curve[i] = Math.tanh(3 * (i / (curve.length - 1) * 2 - 1));
    }
    shaper.curve = curve;
    const tape = ctx.createGain();
    const dL = ctx.createDelay(2.5);
    const dR = ctx.createDelay(2.5);
    const fb = ctx.createGain();
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    const merge = ctx.createChannelMerger(2);
    const lfo = ctx.createOscillator();
    const wowL = ctx.createGain();
    const wowR = ctx.createGain();

    inGain.connect(shaper);
    shaper.connect(tape);
    tape.connect(dL);
    tape.connect(dR);
    dL.connect(merge, 0, 0);
    dR.connect(merge, 0, 1);
    // Left head only, for the same reason the worklet taps one head: summing
    // two oppositely-drifting copies combs the loop.
    dL.connect(damp);
    damp.connect(fb);
    fb.connect(tape);

    lfo.type = 'sine';
    lfo.connect(wowL);
    lfo.connect(wowR);
    wowL.connect(dL.delayTime);
    wowR.connect(dR.delayTime);
    try { lfo.start(); } catch (e) {}

    const apply = function (key, value) {
        const t = ctx.currentTime;
        if (key === 'timeL') dL.delayTime.setTargetAtTime(value, t, 0.12);
        else if (key === 'timeR') dR.delayTime.setTargetAtTime(value, t, 0.12);
        else if (key === 'feedback') fb.gain.setTargetAtTime(Math.min(0.98, value), t, 0.02);
        else if (key === 'drive') {
            inGain.gain.setTargetAtTime(value / 3, t, 0.02);
            tape.gain.setTargetAtTime(1 / value, t, 0.02);
        } else if (key === 'wowRate') lfo.frequency.setTargetAtTime(value, t, 0.05);
        else if (key === 'wowDepth') {
            wowL.gain.setTargetAtTime(value, t, 0.05);
            wowR.gain.setTargetAtTime(-value, t, 0.05);
        } else if (key === 'damp') damp.frequency.setTargetAtTime(value, t, 0.05);
    };
    // Set the starting point outright — gliding up from a node's default would
    // put the feedback gain at 1.0 for the first few milliseconds.
    inGain.gain.value = unit.drive / 3;
    tape.gain.value = 1 / unit.drive;
    dL.delayTime.value = unit.timeL;
    dR.delayTime.value = unit.timeR;
    fb.gain.value = Math.min(0.98, unit.feedback);
    damp.frequency.value = unit.damp;
    lfo.frequency.value = unit.wowRate;
    wowL.gain.value = unit.wowDepth;
    wowR.gain.value = -unit.wowDepth;

    return { input: inGain, output: merge, apply: apply };
};

const workletEngine = function (ctx, unit) {
    const node = new AudioWorkletNode(ctx, 'oa-tape-echo', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
    });
    const apply = function (key, value) {
        const p = node.parameters.get(key);
        if (p) p.setTargetAtTime(value, ctx.currentTime, 0.02);
    };
    window.OA_DELAY_PARAMS.forEach((p) => {
        const param = node.parameters.get(p.key);
        if (param) param.value = unit[p.key];
    });
    return { input: node, output: node, apply: apply };
};

const attachEngine = function (ctx, bus, u) {
    if (bus.engine) return;
    const unit = window.oaDelayUnit(u);
    try {
        bus.engine = ctx.__oaWorkletOk ? workletEngine(ctx, unit) : nativeEngine(ctx, unit);
    } catch (e) {
        console.warn('⚠️ [TapeDelay] worklet node failed, using native chain:', e && e.message);
        bus.engine = nativeEngine(ctx, unit);
    }
    bus.input.connect(bus.engine.input);
    bus.engine.output.connect(bus.ret);
};

// One set of buses per AudioContext, built on first use.
window.oaDelayBus = function (ctx, u) {
    const idx = Math.max(0, Math.min(window.OA_DELAY_COUNT - 1, u | 0));
    const buses = ctx.__oaDelays || (ctx.__oaDelays = []);
    if (!buses[idx]) {
        const unit = window.oaDelayUnit(idx);
        const input = ctx.createGain();
        const ret = ctx.createGain();
        ret.gain.value = unit.ret;
        ret.connect(ctx.destination);

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

        const bus = { input: input, ret: ret, analysers: analysers, engine: null, rvFeeds: [] };
        buses[idx] = bus;

        // Post-fader feed into each reverb: pull the delay down and its wash in
        // the room follows, which is what a console does.
        unit.toRv.forEach((amount, r) => {
            if (amount > 0.001) window.oaDelayToReverb(ctx, idx, r, amount);
        });

        if (ctx.__oaWorkletOk !== undefined) attachEngine(ctx, bus, idx);
        else window.oaPrepareFx(ctx).then(() => attachEngine(ctx, bus, idx));
    }
    return buses[idx];
};

// Create (or re-level) the tap from delay `u` into reverb `r`.
window.oaDelayToReverb = function (ctx, u, r, amount) {
    const bus = ctx.__oaDelays && ctx.__oaDelays[u];
    if (!bus) return;
    let feed = bus.rvFeeds[r];
    if (!feed) {
        if (amount <= 0.001) return;              // do not build a silent path
        feed = ctx.createGain();
        feed.gain.value = 0;
        bus.ret.connect(feed);
        feed.connect(window.oaReverbBus(ctx, r).input);
        bus.rvFeeds[r] = feed;
    }
    feed.gain.setTargetAtTime(amount, ctx.currentTime, 0.02);
};

window.oaSetDelay = function (u, key, value, keepSync) {
    const unit = window.oaDelayUnit(u);
    unit[key] = value;
    // Dialling a head in milliseconds takes it off the grid — including when a
    // preset rewrites the tape, which goes through here one parameter at a time.
    if (!keepSync) {
        if (key === 'timeL') unit.syncL = 0;
        else if (key === 'timeR') unit.syncR = 0;
    }
    window.oaSaveDelay();

    const ctx = window.OA_AUDIO_CTX;
    const bus = ctx && ctx.__oaDelays && ctx.__oaDelays[u];
    if (bus) {
        if (key === 'ret') bus.ret.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
        else if (bus.engine) bus.engine.apply(key, value);
    }
    window.dispatchEvent(new CustomEvent('oa-delay-changed', { detail: { unit: u, key: key } }));
};

window.oaSetDelaySend = function (u, idx, value) {
    const unit = window.oaDelayUnit(u);
    const sends = unit.sends.slice();
    sends[idx] = Math.max(0, Math.min(1, value));
    unit.sends = sends;
    window.oaSaveDelay();
    window.dispatchEvent(new CustomEvent('oa-delay-changed', { detail: { unit: u, idx: idx } }));
};

// How much of delay `u` is thrown into reverb `r`.
window.oaSetDelayToReverb = function (u, r, value) {
    const unit = window.oaDelayUnit(u);
    const toRv = unit.toRv.slice();
    toRv[r] = Math.max(0, Math.min(1, value));
    unit.toRv = toRv;
    window.oaSaveDelay();
    const ctx = window.OA_AUDIO_CTX;
    if (ctx && ctx.__oaDelays && ctx.__oaDelays[u]) window.oaDelayToReverb(ctx, u, r, toRv[r]);
    window.dispatchEvent(new CustomEvent('oa-delay-changed', { detail: { unit: u, rv: r } }));
};

// Lock a head to `steps` 16th notes at the current tempo. `side` is 'L' or 'R'.
window.oaSetDelaySync = function (u, side, steps, bpm) {
    const key = side === 'R' ? 'timeR' : 'timeL';
    const spec = window.OA_DELAY_PARAMS.find((p) => p.key === key);
    const secs = steps * window.OA_DELAY_SIXTEENTH(bpm);
    window.oaDelayUnit(u)['sync' + side] = steps;
    window.oaSetDelay(u, key, Math.max(spec.min, Math.min(spec.max, secs)), true);
};

// Re-derive every locked head after a tempo change, so a delay set to a 1/8 is
// still a 1/8 at the new BPM. A lock that no longer fits the head's range holds
// at the end stop and snaps back when the tempo comes back.
window.oaResyncDelays = function (bpm) {
    if (!bpm) return;
    const step = window.OA_DELAY_SIXTEENTH(bpm);
    window.OA_DELAY.units.forEach((unit, u) => {
        ['L', 'R'].forEach((side) => {
            const steps = unit['sync' + side];
            if (!steps) return;
            const key = side === 'R' ? 'timeR' : 'timeL';
            const spec = window.OA_DELAY_PARAMS.find((p) => p.key === key);
            const secs = Math.max(spec.min, Math.min(spec.max, steps * step));
            if (Math.abs(secs - unit[key]) > 1e-6) window.oaSetDelay(u, key, secs, true);
        });
    });
};

window.oaApplyDelayPreset = function (u, key) {
    const preset = window.OA_DELAY_PRESETS[key];
    if (!preset) return;
    window.OA_DELAY_PARAMS.forEach((p) => window.oaSetDelay(u, p.key, preset[p.key]));
};
