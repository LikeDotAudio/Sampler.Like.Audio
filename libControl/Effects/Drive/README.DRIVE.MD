# Drive — a distortion pedal on every channel

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaDrive.js` | audio | Voicings, the per-sample pedal, the baked WaveShaper table, per-voice node building, plugin registration. |
| `oaDrivePresets.js` | data | The 28 factory pedals. |
| `DriveEditor.jsx` | display | The pedal faceplate and the transfer-curve plot. |

The pedal sits **in front of** the pan and the effect sends — a pedal is on the
floor before the desk, not in the aux rack — so the reverbs and tapes are fed the
distorted signal. See [`../FxBus/README.FXBUS.MD`](../FxBus/README.FXBUS.MD).

---

## 1. Why squashing a wave makes a sound

A real pedal distorts because a circuit runs out of voltage. Push a tube, a
transistor or an op-amp past the rail and the peaks physically cannot get any
taller, so they flatten.

Flattening peaks is not a *loss* of information: a squared-off sine is a sine
**plus a stack of harmonics that were not there before**, and those added
harmonics are the sound of dirt.

In DSP there is no rail to hit, so we squash the numbers on purpose. Each voicing
is a different shape of squashing:

| Mode | Curve | Symmetry | Sound |
|---|---|---|---|
| **Overdrive** | `tanh(x)` | symmetric → **odd** harmonics only (3rd, 5th, 7th) | hollow, woody, blues amp |
| **Tube** | `tanh(x + 0.35)` | lopsided → **even** harmonics, the 2nd above all | the 2nd *is* an octave, so it reads as warmth |
| **Fuzz** | hard clamp at ±1 | square wave | endless harmonic series; it rips |

Two more tricks sit on top of the clipper:

- **Starve** — a dying battery leaves the transistor without enough voltage to
  pass small signals, so the tail of every note sputters and gates out. Modelled
  as a **dead zone** around silence.
- **Octave** — full-wave rectification folds the negative half up. The wave then
  repeats twice as often, so the pitch doubles: the octave-up trick.

---

## 2. The implementation trick

> **Every stage is memoryless.** The output for a sample depends only on that
> sample's value, never on the one before it.

So the whole chain collapses into a single function `y = f(x)` — and a function of
one variable can be precomputed into a lookup table. That is exactly what a
`WaveShaper` node is. The pedal is evaluated once per parameter change over 4096
points, and the browser runs the table over the audio for free.

`oaDriveSample()` is the spec; `oaDriveCurve()` is the optimisation.

---

## 3. The pedal, one sample at a time

```
FUNCTION oaDriveSample(x, u, mode):

    # 1. INPUT GAIN — slam it into the ceiling
    s = x * u.drive

    # 2. TRANSISTOR STARVING — a dead zone, not a gate
    thr = u.starve * 0.6 * u.drive
    IF s >  thr:  s -= thr
    ELIF s < -thr: s += thr
    ELSE:          s = 0

    # 3. RECTIFICATION — blend toward |s|
    IF u.rect > 0: s = s*(1 - u.rect) + |s|*u.rect

    # 4 & 5. ASYMMETRY, THE CEILING, AND THE OFFSET TAKEN BACK OFF
    RETURN clip(s + mode.bias) - clip(mode.bias)
```

Four decisions in there are load-bearing, and each was arrived at the hard way.

### Why the dead zone subtracts instead of gating

The naive version is `if (|s| < thr) s = 0`. It works, but it leaves a **step** in
the transfer function — the output jumps from 0 to `thr` the instant the signal
crosses. A step is an edge, an edge is infinite harmonics, and that means aliasing
plus a click on every zero crossing.

Subtracting the threshold from what survives closes the step: below `thr` is
silence, at `thr` the output is 0 and climbs from there. Same sputter, no click.
It is also closer to the real fault — a starved output stage has a **dead band**;
it is not a noise gate.

The threshold scales with drive so the two knobs stay independent: playing
dynamics decide what sputters, not the gain setting.

### Why the rectifier is a blend

```
below zero:  s(1-r) + (-s)r  =  s(1 - 2r)
```

So the negative half shrinks to nothing at `r = 0.5` — **half-wave** rectification,
fundamental still present with the octave sitting on top — and turns positive
beyond, reaching **full-wave** at `r = 1` where the original pitch has gone
entirely. Measured on a sine: at 50% the fundamental still leads; by 75% the
octave has overtaken it. One knob walks the whole range.

### Why `bias` is small and fixed

The obvious "improvement" is to scale the offset with drive so the wave always
crosses the rail at the same lopsided place. Do that and **the numbers look
wonderful while the waveform quietly dies**:

```
push bias toward the rail → clip(bias) → 1
                          → subtracting it takes the whole positive half to nothing
at bias × 40x drive, hard clip:   clip(s + 20) − clip(20) = 1 − 1 = 0   (silence)
```

Measured over a 200 Hz sine, the second harmonic is strongest around 1.5×–4× drive
and thins out by 40×. The honest reading is that **the fade is not a defect to
engineer around**: a memoryless clipper driven hard enough tends toward a square
wave, and a square wave is odd harmonics by definition. Real gear does the same.
Keep the offset small, take the warmth where it lives, and let FUZZ be the one
that goes all the way.

### Why it subtracts `clip(bias)`, not `bias`

The clipper has already bent the offset on its way through. With `tanh(0.3) =
0.2913`, subtracting the raw `0.3` parks the output at **−0.0087 for ever** — a
speaker cone held off-centre, and a thump the moment the wet path fades in.
Subtracting what actually came out lands on true zero at every mode and drive.

---

## 4. Baking the table

```
FUNCTION oaDriveCurve(u):
    key = [mode, drive, starve, rect] joined       // ONLY the shape keys
    IF u.__curveKey == key: RETURN u.__curve       // cached on the unit

    FOR i IN 0..4095:
        x = i/4095 * 2 - 1                         // a WaveShaper table spans -1..+1
        curve[i] = oaDriveSample(x, u, mode)
    peak-normalise so max |curve| == 1
    cache and RETURN
```

**`OA_CURVE_KEYS` is only four of the six parameters.** Tone, level and mix are
applied by nodes *around* the shaper, so moving them must not rebuild the table.

**Peak normalisation is what makes the pedal auditionable.** Without it, every
turn of the drive knob is also a volume change and you cannot hear what the
distortion is doing. Normalised, drive adds harmonics at steady loudness and LEVEL
is the only volume control — which is how a pedal behaves.

`oaSaveDrive()` deliberately persists only the fields, never `__curve`: it is
derived data and would triple the size of the localStorage entry for nothing.

---

## 5. Building it for a voice

```
        ┌─ dry (1 − mix) ──────────────────────────────────┐
 in ────┤                                                  ├──▶ dest (the pan)
        └─ shaper(4x) ─ [tone] ─ [dc block] ─ wet(mix×level)┘

FUNCTION oaDriveNode(ctx, idx, dest, chain):
    IF mix <= 0.0005: RETURN NULL            // nothing built at all
    input → dry(1 − mix) → dest
    input → WaveShaper(curve, oversample '4x')
    IF tone < 17000:            → lowpass(tone, Q 0.707)
    IF bias != 0 OR rect > 0:   → highpass(12 Hz)
    → wet(mix × level) → dest
    every node built is pushed onto `chain` for retirement
    RETURN input
```

**Transparent until asked.** `mix` defaults to 0 on every channel, and at mix 0
this builds **no nodes at all** — the voice connects to the pan exactly as before.
That is *distortion not present*, not "distortion turned down".

**`oversample = '4x'` is most of the difference between "distortion" and
"broken".** Clipping invents harmonics above everything the signal had, and
anything past half the sample rate folds back down as inharmonic rubbish that no
filter can remove afterwards. Running the shaper at 4× pushes the fold-over point
two octaves up, where those harmonics are weak enough not to matter.

**The tone control is not optional garnish.** Distortion is bright by
construction — every harmonic it adds is above what went in — so the lowpass is
what lets the result sit in a mix. It is skipped entirely above 17 kHz ("Open").

**The DC blocker is conditional and deliberately so.** A lopsided or rectified
curve pushes the wave off-centre by an amount that follows the playing, so no
constant can cancel it — it takes a filter. Symmetric and unrectified, the curve
generates no DC at all, and the node is skipped.

**Everything joins the caller's retirement `chain`.** A `WaveShaper` at 4×
oversampling carries its own internal buffers, which makes it the most expensive
thing in the app to leave lying around for the collector.

---

## 6. As a plugin

```
id 'drive' · event 'oa-drive-changed' · units = OA_PAD_MAX (one pedal per channel)
slots  = USER + 2
layout MIX  = blend, 0..1
       KNEE = starve × 0.6 × drive — where the curve stops being a straight line.
              A display draws the knee there; below it the pedal is a wire.

read(ctx, i, frame):
    frame[ACTIVE] = mix > EPSILON
    frame[MIX] = u.mix ; frame[KNEE] = the dead-zone threshold
    frame[PEAK_L] = frame[PEAK_R] = 0     // the pedal exists only while a voice
                                          // sounds through it — a steady zero is
                                          // the truth, not a missing value

curve(i) = oaDriveCurve(unit)             // the WaveShaper's OWN table
```

No `dispose`: the drive is per-voice, so nothing persistent is ever built.

The panel used to evaluate the pedal's maths a second time, in JSX, just to plot
it. Now it asks the plugin for curve zero and draws whatever comes back — **the
same array the WaveShaper is running**, so the picture cannot drift from the
sound. This is the case that motivated the whole curve channel; see
[`../PluginHost/README.PLUGINHOST.MD`](../PluginHost/README.PLUGINHOST.MD).

---

## 7. Presets and controls

| Preset | Mode | Drive | Starve | Oct | Tone | Mix |
|---|---|---|---|---|---|---|
| Edge of Breakup | od | 3.5 | — | — | 14 k | 30% |
| Crunch | od | 9 | — | — | 9 k | 55% |
| Warm Tube | tube | 5 | — | — | 7.5 k | 45% |
| Console Push | tube | 2.2 | — | — | 16 k | 22% |
| Big Fuzz | fuzz | 18 | — | — | 5.2 k | 85% |
| Dying Battery | fuzz | 26 | 55% | — | 4.2 k | 100% |
| Octave Fuzz | fuzz | 20 | 12% | 90% | 6 k | 90% |
| Clean (bypass) | od | 1 | — | — | Open | 0% |

`drive` and `tone` are marked `log: true`. A drive knob that spends half its travel
between 20× and 40× is useless — **the ear hears ratios, not differences.**

Per-channel state is sized for `OA_PAD_MAX`, like every other per-channel array,
so shrinking the pad grid and growing it back finds pad 25's pedal intact.

---

## 8. Tests and gotchas

`test/plugins.test.mjs` (`drive` suite) asserts: the curve is normalised and passes
through zero, starve carves a dead zone **without leaving a step**, and every
preset stays inside every declared range. `test/panels.test.mjs` opens the editor.

| Gotcha | Where |
|---|---|
| moving tone/level/mix must not rebuild the table | `OA_CURVE_KEYS` |
| a raw `bias` subtraction leaves permanent DC | step 5 of `oaDriveSample` |
| scaling bias with drive silences the pedal | the long comment on `OA_DRIVE_MODES` |
| no oversampling = aliasing that cannot be filtered later | `shaper.oversample = '4x'` |

---

## 9. The preset library

`oaDrivePresets.js`, 28 pedals, grouped by how hard they push: clean, overdrive,
tube, fuzz, the two faults (starve and octave), and two kit-specific ones.

The classic circuits map onto the three voicings by **where they clip and how
symmetric it is**:

- A **germanium** fuzz has *less* gain than a silicon one and a softer, grainier
  break-up with a smooth top: fuzz voicing, moderate drive, tone well down.
- A **silicon** fuzz has more gain and more high-order harmonics: same voicing,
  much more drive, tone open.
- A **four-stage sustain** fuzz is endless: maximum drive, tone pulled back so it
  does not fizz, mix at 100%.
- The **mid-hump overdrives** (~723 Hz on the green one, ~1 kHz on the grey
  hard-clipper) get their character from a bandpass this pedal does not have —
  it has a single lowpass. So those two are named for what they *do*, and land
  the energy in the same place with voicing plus tone.

---

## 10. Saved with the song

```
save() -> { units: [every channel's pedal] }   // fields only
load() -> mode FIRST, then every parameter, through oaSetDrive()
```

The cached 4096-point curve hanging off each unit is derived data: it would
treble the size of the song file and is rebuilt on load anyway, so only the
fields go. `mode` leads because it decides which clipper the drive figure is
driving — setting it afterwards would bake the table twice for nothing.

## 11. What it keeps resident

**A drive node is built per hit** — it is in the per-voice chain, in front of the
pan — so the one expensive thing here has to already exist by the time a pad is
struck. That is the 4096-point WaveShaper table of §4, cached on the unit under
its shape keys: baked on the first hit after a knob moves, and never again until
one does. The nodes built for a hit are thrown away with the voice; the table they
point at is not.

Cached **on the unit** rather than in a shared budgeted store, because there is
exactly one live setting per channel — the cache can never hold more than one
table per pedal, so it has nothing to evict. Every store in the rack that *can*
grow is budgeted instead; see
[../README.EFFECTS.MD](../README.EFFECTS.MD#what-stays-in-memory) for what each
unit holds, when it is built, and when it is let go.

---

<sub>Part of **[Sampler.Like.Audio](https://Sampler.Like.audio)** · Written by Anthony P. Kuzub · i @ Like . audio ·
Released under the **MIT Licence** — free, for everyone, for ever ([LICENSE](../../../LICENSE)).
Every visual representation in this project is an homage to classic hardware; there is no affiliation with, or
endorsement by, any of the original designers or manufacturers, and their layouts are used only because they are
familiar interfaces.</sub>
