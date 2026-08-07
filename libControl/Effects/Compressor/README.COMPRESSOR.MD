# Compressor — an APK 4476 FET limiting amplifier per channel

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaCompressor.js` | audio | Knob laws, ratio buttons, the AudioWorklet limiter, a native fallback, the per-channel strip, plugin registration. |
| `oaCompressorPresets.js` | data | The 27 factory settings. |
| `CompressorEditor.jsx` | display | The 1U faceplate: knobs, ratio and meter buttons, and a real VU needle. |

Sits **after the DRIVE pedal and after the pan, as an insert on the dry path**.
The effect sends are tapped ahead of it — see
[`../FxBus/README.FXBUS.MD`](../FxBus/README.FXBUS.MD).

---

## 1. What a compressor is

A compressor is a volume fader that rides itself. Below a threshold it does
nothing at all; above it, it turns the signal down by a fraction of however far
over the line the signal went. That fraction is the **ratio**: at 4:1, four
decibels over the threshold are allowed out as one, so the loud parts stop running
away from the quiet parts.

Squash the peaks and the *average* level can be raised — which is the OUTPUT
knob's whole job — so the channel ends up louder and steadier without ever
clipping.

**The classic this models has no threshold knob.** The threshold is fixed inside
the box, and INPUT drives the signal into it: turn the input up and more of the
waveform crosses the line, so the unit works harder. That is why input and output
are always turned in opposite directions — one decides how much squashing happens,
the other puts back the level it took away.

---

## 2. The controls

| Knob | Range | What it does |
|---|---|---|
| **Input** | −12…+36 dB | Drives a fixed threshold. **This is the threshold control.** |
| **Output** | −24…+24 dB | Makeup gain. |
| **Attack** | 800 µs → 20 µs | Time to clamp down. |
| **Release** | 1.1 s → 50 ms | Time to let go. |
| **Blend** | 0–100% | Wet against the untouched channel. Below 100% is parallel compression. |

**Both time knobs run backwards, like the original: fully clockwise is the
FASTEST setting.** Both are swept exponentially:

```
attackTime(n)  = 800µs · (20µs/800µs)^n
releaseTime(n) = 1.1s  · (50ms/1.1s)^n
```

Linear travel would spend most of the knob between 600 and 800 µs, where nothing
audible happens. **The ear hears time constants as ratios, not differences.**

### What the time knobs are *for*

- **Attack.** Fast (20 µs) catches the very front of a stick hit and softens it.
  Slow (800 µs) lets the transient punch through untouched and only clamps the
  body behind it — which is how you make a drum hit *harder* with a compressor
  instead of duller.
- **Release.** Too fast and the noise floor breathes up and down between hits
  (pumping). Too slow and one loud hit holds the channel down through everything
  after it.

### The ratio buttons

| Button | ratio | thresh | knee | lag |
|---|---|---|---|---|
| 4 | 4:1 | −24 dB | 9 dB | 1 |
| 8 | 8:1 | −24 dB | 7 dB | 1 |
| 12 | 12:1 | −24 dB | 5 dB | 1 |
| 20 | 20:1 | −24 dB | 3 dB | 1 |
| **ALL** | 20:1 | **−36 dB** | **16 dB** | **3.5** |

**The threshold is identical for all four numbered settings, and it has to be.**
Give 8:1 a higher threshold than 20:1 and there are input levels where pressing
the *harder* ratio compresses *less* — indefensible on a panel with no threshold
knob to explain it with. What changes with ratio is the **knee**: a gentle setting
eases in over a wide bend, a limiter snaps to its ceiling.

**ALL** is every button pushed in at once. On the real unit that was a fault
condition people fell in love with: the threshold collapses, the knee smears, the
attack lags behind itself, and the whole thing pumps and distorts. Modelled as
ratio 20, threshold dropped ~12 dB, a very wide knee, and an attack multiplied by
`lag = 3.5`.

---

## 3. The worklet, line by line

```
FUNCTION process(input, output, params):

    IF no input:            output silence, gr = 0, report, RETURN
    IF mix <= 1e-6:         COPY input straight through, report, RETURN
    IF silent AND gr ≈ 0:   output silence, report every 4th block, RETURN

    slope = 1 − 1/ratio                       // fraction of each dB over the line
    half  = knee / 2
    aCoef = 1 − exp(−1 / (attack  · sampleRate))
    rCoef = 1 − exp(−1 / (release · sampleRate))

    FOR each sample i:
        # STEREO-LINKED DETECTION — the louder side decides for both
        det = max(|L|, |R|) * inGain
        db  = 20·log10(det)
        over = db − thresh

        # THE KNEE
        IF over <= −half: target = 0
        ELIF over >= half: target = over * slope
        ELSE:              target = slope · (over + half)² / (2·knee)     // parabola

        # BALLISTICS ON THE GAIN, not on the level
        gr += (target − gr) * (target > gr ? aCoef : rCoef)

        g = 10^(−gr/20) * inGain * outGain
        outL[i] = sat(L·g)·mix + L·(1−mix)
        outR[i] = sat(R·g)·mix + R·(1−mix)
```

### Where the smoothing goes — the one real design decision

The textbook version smooths the detected **level** and derives a gain from it.
This smooths the **gain reduction** instead: the static curve is evaluated
instantly on the rectified peak, and the attack/release constants are applied to
the *number of decibels of reduction* on its way to that target.

It costs the same and it is better behaved:

- the knobs mean exactly what the panel says they mean — *"time for the gain to
  come down"*;
- the ratio stays honest at every point of the envelope, instead of drifting while
  a level detector catches up.

### Why the knee is a parabola

Below the knee nothing happens; above it the full ratio applies; across the knee
width the two are joined by a parabola. A **corner** would be a discontinuity in
the gain, and a discontinuity is a click.

### Stereo is linked

One detector reads the louder of the two channels and both are turned down
together. Compressing the sides independently makes a hard-panned hit shove the
image sideways every time it lands.

### The output saturator

```
FUNCTION sat(x):
    IF |x| <= 0.7: RETURN x                          // dead linear
    over = (|x| − 0.7)/0.3
    RETURN sign(x) · (0.7 + 0.3·tanh(over))          // asymptotic ceiling at 1.0
```

The output stage cannot pass an arbitrarily large number, and neither could the
transformer it stands in for. Ordinary material is untouched; a heavy makeup
setting **saturates instead of clipping into a square edge**.

### Reporting the needle

```
FUNCTION report():
    v = grPeak rounded to 2 decimals
    IF v == 0 AND last sent was 0: RETURN            // say nothing while idle
    port.postMessage(v)

… every 4th block: report(), then grPeak = gr       // DECAY, do not reset
```

Throttled to roughly 20 ms because **sixteen channels posting per 128-sample block
is a message every 0.36 ms**. Decaying `grPeak` to the current `gr` rather than
zeroing it is what makes the needle fall smoothly between reports instead of
flickering to zero and back.

---

## 4. One settings resolver, two engines

```
FUNCTION compSettings(unit):
    r = the ratio button
    RETURN { inGain:  on ? 10^(input/20)  : 1,
             outGain: on ? 10^(output/20) : 1,
             attack:  attackTime(unit.attack) * r.lag,
             release: releaseTime(unit.release),
             ratio: r.ratio, thresh: r.thresh, knee: r.knee,
             mix: on ? unit.mix : 0 }
```

One place, so the worklet and the native chain cannot drift apart. Note the last
line: **the on/off switch and the blend knob are the same lever** as far as the
DSP is concerned. At mix 0 the wet path contributes nothing and the output is the
input, sample for sample — no node is torn out of a running graph.

The native fallback wires `input → pre → DynamicsCompressor → post → wet → output`
with a parallel dry path. The browser's compressor is a feed-forward peak design
with a soft knee, so the shape is right; what it will not do is the ALL-buttons
lag, and it adds a few milliseconds of its own latency the worklet does not.

Every parameter change is a `setTargetAtTime` over 0.02 s — short enough to feel
immediate, long enough that dragging a knob is a slide rather than a staircase of
zipper noise.

---

## 5. The strip, and the one way in

The builder and the strip object are **file-local**. A channel gets back a node
to play into, or `null`:

```
window.oaCompInput(ctx, idx)     -> the node to play into, or NULL if this channel
                                    has never been switched on
window.oaCompWarm(ctx)           -> build every switched-on strip
window.oaCompStripCount(ctx)     -> how many exist, for the voice diagnostic
```

**Null is a real answer, not a failure.** It is what keeps an uncompressed
channel's graph exactly as it was before this file existed — and it is the same
answer the [DRIVE pedal](../Drive/README.DRIVE.MD) gives, so the router treats every
optional insert identically: *if there is a node, use it; otherwise carry on to
where you were going.*

```
FUNCTION compStrip(ctx, idx):                                   // file-local
    IF already built: RETURN it
    IF this channel has never been switched on: RETURN NULL     // build nothing
    input → engine → output → destination
    output → analyser (fftSize 1024)
    engine = ctx.__oaWorkletOk ? workletEngine : nativeEngine   // fall back on throw
```

`oaCompWarm` exists because the loop that builds every strip up front used to sit
in `oaWarmFx` — where it had to know both that a strip exists per *pad* and that
building one early is what keeps it off the native fallback. Neither is the
router's business; both are this file's.

**Built once per channel and shared by every voice — that is the whole point.** A
compressor built per hit would start with its gain wide open every time, so a fast
run of hits would never duck each other and the release knob would have nothing to
act on.

**Once built, the strip stays.** Switching the unit off sets its blend to zero,
which passes the input through untouched rather than tearing a live node out of a
running graph.

The fallback-on-unresolved-worklet is deliberate: a voice may be built before the
module has finished registering, and the native chain is synchronous and always
available. Leaving the channel silent while it waits would, on an
`OfflineAudioContext`, mean the whole render.

---

## 6. As a plugin

```
id 'comp' · event 'oa-comp-changed' · units = OA_PAD_MAX
slots  = USER + 1
layout GR = gain reduction in dB, right now

read(ctx, i, frame):
    frame[ACTIVE] = on AND mix > 0.0005
    peak = oaAnalyserPeak(bus.analyser)
    oaWritePeak(frame, PEAK_L, peak) ; oaWritePeak(frame, PEAK_R, peak)   // SAME
    frame[GR] = oaCompGR(i)
```

**GR is the only measurement this unit has that the shared four do not already
cover.** The ratio and meter-mode switches are *settings* and come back through
`state()` — a frame carries what is **measured**, not what is **set**.

**One analyser, both peak slots.** The DSP is stereo-linked, so a split meter here
would be showing a difference the compressor deliberately does not create.

`oaCompGR` reads whichever engine is running: the worklet posts its value into
`bus.gr` over the message port, while the native node exposes `.reduction` — which
the spec reports as a **negative** number of dB, hence the sign flip.

---

## 7. Teardown

```
FUNCTION oaDisposeComp(ctx):
    FOR each strip:
        bus.engine.input.port.onmessage = null        // ← the important line
        disconnect input, output, analyser, engine ports
```

The worklet's message port keeps a reference to `bus` through the `onmessage`
closure. **Cutting it is what actually lets the strip go** — disconnecting the
nodes alone leaves the whole strip reachable. A channel strip is one of only two
things in this file that outlive a voice, so if anything here holds on, this is
where it shows. `test/leaks.test.mjs` is what catches it.

---

## 8. The panel (`CompressorEditor.jsx`)

The needle is the reason the panel exists. Every other control is a number you
could have typed; the meter is the only way to see that a 4:1 at this input
setting is pulling 6 dB off the peaks and nothing off the tails.

- `VU_MARKS` is one table driving **both** the drawing of the scale and the
  pointing of the needle — a real VU scale is squashed at the quiet end and
  stretched around 0, and the needle must land on the engraved marks.
- The meter switch (`GR` / `+8` / `+4` / `OFF`) is a **panel decoration**: it
  changes nothing in the audio, which is why `oaSetComp` skips `pushToBus` for it.
  `+8` and `+4` put 0 VU at −14 and −18 dBFS respectively.
- The badge reads **APK 4476 · LIMITING AMPLIFIER**.
- **The plate is painted in the theme accent, not in a colour.** `PLATE`, `PAINT`,
  `INK` and `INK_LIT` at the top of the file are the only finishes on the panel,
  and every one of them is a shade of `--accent` from the ladder in `index.html`
  — so the box, the rack ears, the engraving, the IN lamp and `OA_COMP_COLOR`
  all follow Config's colour picker together. Anything that is *not* paint keeps
  its own colour: black knobs, aluminium caps, steel screws, and the amber VU
  face with its red over-0 arc, which is a lamp behind glass and has to stay
  legible whatever hue the plate ends up.

---

## 9. Tests and gotchas

`test/plugins.test.mjs` runs the **real** `process()` over real arrays through the
harness's fake `AudioWorkletProcessor` — the ballistics are tested, not asserted
about. `test/leaks.test.mjs` covers the port-closure teardown;
`test/panels.test.mjs` opens the editor.

| Gotcha | Where |
|---|---|
| ratios must share one threshold | `OA_COMP_RATIOS` |
| smoothing belongs on the gain, not the level | the ballistics line in `process()` |
| the message port keeps the strip alive | `oaDisposeComp` |
| a per-hit compressor has no memory | `oaCompStrip` is per channel |
| the meter switch must not touch audio | `oaSetComp`'s `key !== 'meter'` guard |

---

## 10. The preset library

`oaCompressorPresets.js`, 27 settings, grouped: gentle levelling, transient work,
firm, limiting, parallel, and all-buttons-in.

Two fields do not mean what they look like, and the presets are built around it:

- **`input` is the threshold.** The box has no threshold knob — the threshold is
  fixed at −24 dB and input drives the signal into it. A preset with `input: 20`
  compresses hard whatever else it says.
- **Both time knobs run backwards.** 0 is fully counter-clockwise and *slowest*
  (800 µs / 1.1 s); 1 is fully clockwise and *fastest* (20 µs / 50 ms). `attack:
  0.1` lets the whole transient through; `attack: 0.95` catches the stick itself.

The classic vocal setting — 4:1 with the attack about a quarter of its travel and
the release around 60% — is `vocaltex`. It flatters almost anything, which is why
it is famous.
