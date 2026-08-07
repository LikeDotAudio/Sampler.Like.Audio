# Tape Delay — four Space Echo buses, tape and all

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaTapeDelay.js` | audio | Parameters, presets, the AudioWorklet tape machine, a native fallback, the buses, grid sync, plugin registration. Also `oaPrepareFx()` — the one place worklet modules are registered. |
| `oaTapeDelayPresets.js` | data | The 22 factory tapes. |
| `TapeDelayEditor.jsx` | display | The tape panel: head faders, sync buttons, Dimension row, reverb throws. |

Four shared buses, `DLY 1`–`DLY 4`. These are **send effects: the node outputs wet
only.** Dry comes from each channel's own path in
[`../FxBus/`](../FxBus/README.FXBUS.MD). Each unit can also throw its repeats into
either reverb, and each carries a
[Dimension-D chorus](../Chorus/README.CHORUS.MD) insert after the tape.

---

## 1. The idea

A mechanical tape loop, simulated in digital memory:

```
   ┌──────────────── the tape (a circular Float32Array) ────────────────┐
   │                                                                    │
   │   … ← headR ← headL ←──────────── write (the record head) ←──      │
   └────────────────────────────────────────────────────────────────────┘
        ▲          ▲                          ▲
        │          │                          └── input + feedback, soft-clipped
        └──────────┴── two playback heads, trailing at a FRACTIONAL distance
                       that an LFO wobbles = wow and flutter
```

- The **circular buffer is the tape**. The write index is the record head.
- **Two read points trailing behind it are the stereo playback heads.**
- An **LFO modulates the distance** between record and playback heads. That is wow
  (slow) and flutter (faster, shallower) — the pitch wobble that reads as chorus.
- The read output is **folded back into the record head through a soft clipper**,
  so every lap of the loop gets warmer, darker and more compressed, exactly as
  magnetic tape saturates.

The DSP runs in an **AudioWorklet**, per-sample and off the main thread. Where
worklets are unavailable a native node chain reproduces the same topology at
coarser resolution.

---

## 2. Parameters

| Key | Panel | Range | What it is |
|---|---|---|---|
| `timeL` / `timeR` | Head L / Head R | 10 ms–2 s | Distance of each playback head behind the record head. |
| `feedback` | Intensity | 0–1.1 | Loop gain. **Above 1.0 it runs away on purpose.** |
| `drive` | Tape Drive | 0.5–6× | How hard the tape is hit. |
| `wowRate` | Wow Rate | 0.05–8 Hz | Speed of the head-distance wobble. |
| `wowDepth` | Flutter | 0–20 ms | Depth of it. |
| `damp` | Tape Age | 0.8–16 kHz | Head roll-off — how much top end each pass loses. |

Presets — `slap`, `tape`, `space`, `dub`, `warble`, `oscillate` — exist so the four
units are four *different machines* out of the box rather than four copies of one.
Units 1–4 boot as Slapback, Tape Echo, Space and Dub Sink.

---

## 3. The worklet, line by line

### Setting up the tape

```
CONSTRUCTOR:
    need = sampleRate * 2.3                  // max head time + headroom
    n = the next POWER OF TWO at or above need
    tape = Float32Array(n) ; mask = n - 1
```

Power of two so wrapping a head is a **bitwise AND rather than a modulo**, done
millions of times a second.

`sampleRate` here is the worklet global — the rate of the context this processor
was built on. Since every context in the app is built at the shared rate
(`oaAudioRate.js`), the tape is the same length and the heads sit at the same
spacing in a live session and in an offline bounce. That is what makes a rendered
echo match the one that was monitored.

### Reading a head

```
FUNCTION read(offset):
    pos  = write - offset          // wrapped into range
    i0   = floor(pos) ; frac = pos - i0
    RETURN lerp(tape[i0 & mask], tape[(i0+1) & mask], frac)
```

**Fractional, interpolated reads are what make the wow smooth.** Stepping whole
samples as the head drifts crackles instead of bending pitch.

### Saturation

```
FUNCTION softClip(x):                        // Padé approximation of tanh
    IF |x| > 3: RETURN ±1
    RETURN x * (27 + x²) / (27 + 9x²)
```

True tape does not clip cleanly — the particles saturate and the waveform rounds
off. Same curve as `tanh`, a fraction of the cost, and this runs per sample.

### The process loop

```
FUNCTION process(input, output, params):
    # --- park the motor ---
    IF input is silent AND nothing has been heard for a whole tape length:
        output zeros ; RETURN            // write head STAYS PUT, so head spacing
                                         // is untouched when it wakes

    glide   = one-pole coefficient for ~120 ms
    lpCoef  = one-pole at `damp` Hz          // head roll-off
    hpCoef  = one-pole at 55 Hz              // DC / rumble blocker
    makeup  = 1 / drive

    FOR each sample i:
        headL += (targetL - headL) * glide       // the motor cannot jump
        headR += (targetR - headR) * glide

        drift = sin(phase)*wowDepth + sin(phase*6.31 + 1.7)*wowDepth*0.28
        dL = clamp(headL + drift) ; dR = clamp(headR - drift)   // opposite signs

        echoL = read(dL) ; echoR = read(dR)

        dry = mono sum of the input
        fb  = echoL * feedback                   // LEFT HEAD ONLY — see below

        rec = softClip((dry + fb) * drive) * makeup
        lp += lpCoef * (rec - lp)                // heads lose the top end
        hp += hpCoef * (lp - hp)                 // and never hold DC
        tape[write] = lp - hp
        write = (write + 1) & mask

        outL[i] = echoL ; outR[i] = echoR
```

The decisions that are easy to get wrong:

**Feedback is taken off the left head alone**, the way a real machine taps one
playback head. Summing both would *comb the loop*: the two heads drift in
**opposite** directions, so at similar head spacings the copies arrive out of
phase and cancel — the repeats would die away however high Intensity was set.

**Drive is record level with the playback amp trimmed by the same amount**
(`× drive` in, `× 1/drive` out). Quiet material comes back unchanged, loud
material squashes, so the knob is purely *how hard the tape is hit*. It also keeps
loop gain at exactly the feedback setting, which is why **Intensity means what it
says**: it runs away at 100%, not at some drive-dependent fraction of it.

**Input and feedback hit the tape together**, before the clipper, so the repeats
saturate a little more on every lap. That accumulation is the whole character.

**The DC blocker is not optional.** A feedback loop with any DC offset walks away
— the offset compounds every pass until the tape is pinned.

**Parking the motor** matters because these are four always-on buses. Without it,
four idle tape machines burn per-sample CPU forever. Freezing the write index
rather than resetting it means head spacing survives the nap.

**The head glide (~120 ms)** turns a knob twist into the pitch swoop a real
machine makes, and stops the jump from clicking. A tape motor cannot change speed
instantly.

---

## 4. Two engines, one topology

```
FUNCTION attachEngine(ctx, bus, u):
    bus.engine = ctx.__oaWorkletOk ? workletEngine() : nativeEngine()
    IF the worklet node throws: fall back to nativeEngine()
    bus.input → engine.input
    engine.output → chorus.input → bus.ret        // the chorus is an INSERT
```

The native fallback builds: `drive → shaper → tape gain → two delays → merge`,
with one shared damped feedback path off the left delay and one LFO wobbling both
heads in opposite directions. It is coarser — the saturation sits *before* the
loop rather than inside it, so it does not accumulate per lap — but it is
recognisably a tape echo rather than a plain delay.

A `WaveShaper`'s domain is fixed at ±1, so its curve carries a 3× drive of its own
and `inGain` scales by `drive/3`; the tape gain trims by `1/drive`. That lands on
the same unity-for-quiet, squashed-for-loud curve the worklet uses.

Initial values are **set outright, not glided to**: ramping up from a node's
default would leave the feedback gain at 1.0 for the first few milliseconds — a
burst of runaway on every build.

### `oaPrepareFx` — one answer for every bus

```
FUNCTION oaPrepareFx(ctx):                      // memoised on ctx.__oaFxReady
    TRY:
        await ctx.audioWorklet.addModule(tapeModuleUrl())
        await ctx.audioWorklet.addModule(oaCompModuleUrl())
        ok = true
    CATCH: warn, ok = false
    ctx.__oaWorkletOk = ok                      // set once it SETTLES
    RETURN ok
```

Both worklets register here because they share one answer: a context either has
`AudioWorklet` or it does not, and every bus wants to know *before* it builds.
`ctx.__oaWorkletOk` being a plain boolean once settled is what lets an
`OfflineAudioContext` — which schedules and renders in a single tick — pick the
right engine synchronously.

The worklet source ships as a **string registered from a Blob URL**, because the
whole app compiles to one bundle and a worklet module must be a separately
fetchable file. The test harness exploits this: its fake `URL.createObjectURL`
keeps the text, so `addModule()` can evaluate the real processor and the tests run
the actual `process()` over actual arrays.

---

## 5. The bus, and the one way in

The builder and everything it holds — tape engine, chorus insert, return fader,
reverb throws — are **file-local**. The public audio surface is the port:

```
window.oaDelayInput(ctx, u)   -> the node to send into (builds the bus on first ask)
window.oaDelaySend(u, idx)    -> this channel's send level, 0..1
window.oaDelayIsFed(u)        -> is anything sending to this tape?
window.oaDelayWarm(ctx)       -> build every tape that is
window.oaDelayBusCount(ctx)   -> how many exist, for the voice diagnostic
```

```
FUNCTION delayBus(ctx, u):                       // file-local
    input = Gain() ; ret = Gain(unit.ret) → destination
    ret → ChannelSplitter → [analyserL, analyserR]
    FOR each toRv[r] > 0.001: oaDelayToReverb(ctx, u, r, amount)
    IF ctx.__oaWorkletOk is known: attachEngine now
    ELSE: oaPrepareFx(ctx).then(attachEngine)
```

The reverb feed is taken **post-fader**: pull the delay's return down and its wash
in the room follows, which is what a console does. A feed at zero builds no node
at all, and it is made through the reverb's *own* port:

```
FUNCTION oaDelayToReverb(ctx, u, r, amount):
    feed = Gain(0) ; bus.ret → feed → oaReverbInput(ctx, r)
    feed.gain →(0.02s) amount
```

This file knows there **is** a room to throw into, and nothing else about it —
not its convolver, not its return fader, not the list it lives on. Because each
bus wires its own throws as it is built, the warm-up in
[`../FxBus/`](../FxBus/README.FXBUS.MD) no longer has to know that a delay can feed a
reverb at all.

---

## 6. Clamping, and why it has its own function

`dlUnit()` clamps on the way in from storage. `clampDelay()` covers the *other*
door — a knob, a preset, a song file, a grid-sync recalculation:

```
FUNCTION clampDelay(key, value):
    IF key == 'ret': RETURN clamp(value, 0, 1)
    spec = the parameter's range ; IF none: RETURN value      // syncL/syncR/chorus
    IF value is not finite: RETURN the default                // NaN passes both
    RETURN clamp(value, spec.min, spec.max)                   // bounds, so catch
                                                              // it BEFORE them
```

Both failure modes it prevents are real and were seen:

- A head time past `maxDelayTime` is **silently pinned by the DelayNode**, so the
  panel and the sound disagree from then on, with nothing on screen to say why.
- Feedback above ~1.1 adds energy every pass: it climbs until it clips and stays
  there — the *"it started distorting"* symptom — and it is persisted, so it comes
  back after a reload.

---

## 7. Grid sync

A head can be locked to the grid instead of dialled in milliseconds. The lock is
stored as **a count of 16th notes**, not as seconds, so it survives tempo changes.

```
OA_DELAY_SIXTEENTH(bpm) = 15 / bpm             // 60 / bpm / 4

FUNCTION oaSetDelaySync(u, side, steps, bpm):
    unit['sync' + side] = steps
    oaSetDelay(u, 'time'+side, clamp(steps * sixteenth(bpm)), keepSync = TRUE)

FUNCTION oaResyncDelays(bpm):                  // called when the tempo moves
    FOR each unit, each side WITH a lock:
        secs = clamp(steps * sixteenth(bpm))
        IF it actually changed: oaSetDelay(..., keepSync = TRUE)
```

`keepSync` is the crux. **Dialling a head in milliseconds takes it off the grid** —
including when a preset rewrites the tape, since presets go through `oaSetDelay`
one parameter at a time. Without the flag, re-deriving a locked head from the
tempo would immediately unlock it.

A lock that no longer fits the head's range holds at the end stop and snaps back
when the tempo returns, rather than being quietly forgotten.

---

## 8. As a plugin

```
id 'delay' · event 'oa-delay-changed' · units = 4 · presets = OA_DELAY_PRESETS
slots  = USER + 2
layout REGEN  = unit.feedback, 0..1.1 — how close the loop is to running away.
                Above 1 it IS adding energy every pass; the panel lights that
                up rather than hiding it, because it is a setting, not a fault.
       CHORUS = which Dimension button is lit, 0 = OFF

read(ctx, i, frame):
    frame[ACTIVE] = bus exists AND ret > 0.0005
    frame[REGEN]  = unit.feedback
    frame[CHORUS] = unit.chorus
    oaWritePeak(frame, PEAK_L/R, oaAnalyserPeak(analysers[0/1]))
```

---

## 9. Teardown

```
FUNCTION oaDisposeDelay(ctx):
    FOR each bus:
        bus.chorus.dispose()          // carries a running LFO
        bus.engine.dispose()          // the native engine's LFO, likewise
        disconnect input, ret, analysers, rvFeeds, engine ports
```

Both `dispose` calls are load-bearing. The wow LFO in the native engine and the
chorus's own oscillator were each started once and never stopped — they are
sources with no stop time, so **nothing else will ever release them**. Disconnect
the delay alone and the tape "goes away" with an oscillator still turning behind
it.

---

## 10. Where to change things

| You want to… | Touch |
|---|---|
| more/fewer tape machines | `OA_DELAY_UNITS` (the rest follows from `OA_DELAY_COUNT`) |
| a new tape parameter | `OA_DELAY_PARAMS` + `parameterDescriptors` + the process loop + `nativeEngine.apply` |
| change the saturation character | `softClip()` and where `drive`/`makeup` are applied |
| add a musical division | `BEAT_NAMES` |
| repaint the machine | `PLATE` in `TapeDelayEditor.jsx` |

The faceplate is **not green, it is the theme accent shaded down**: `PLATE` is
built from the `--accent-s*` ladder in `index.html`, so the machine repaints with
the rest of the app whenever Config's colour picker moves. What stays put is
everything that was never paint — the black tolex, the brushed aluminium trim,
the silver knobs, and the lamps (the nixie head readouts and the lit note
division), which have to read against whatever hue the plate lands on. The
silkscreened labels stay white for the same reason.

Covered by `test/plugins.test.mjs` (the real `process()` run over real arrays —
head spacing, runaway feedback, the parked motor) and `test/panels.test.mjs`.

---

## 11. The preset library

`oaTapeDelayPresets.js`, 22 tapes. The head times are not arbitrary: the machine
this models has no delay-time knob at all — it has **three playback heads at
fixed distances** and a twelve-position selector that switches between them and
their combinations. The spacing is roughly 1 : 2 : 3.

This has two heads rather than three, so a combination becomes a *pair* of head
times, and the ratio is the thing worth copying:

| Ratio | Sounds like |
|---|---|
| 1:1 | a single hard slap, mono-centred |
| 1:1.5 | the classic tape-echo spread — the repeats interleave |
| 1:2 | ping-pong: every other repeat lands on the other side |
| 1:3 | the widest the original could do (heads 1 and 3 together) |

Grouped as: the four the units boot with, the head combinations, short
(doubling/slap), mid (the working echoes), long (the ones that become the
arrangement), and two that are broken on purpose.
