# Drum Synth — every kit voice built from scratch

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaDrumSynthEngines.js` | audio | Six synthesis engines, each with its own parameter schema and `render()`. |
| `oaDrumSynthPresets.js` | data | The 76-voice library, and which voice each pad starts on. |
| `oaDrumSynthPatches.js` | audio | Factory patches, live patch storage, the offline preview bounce, plugin registration. |
| `DrumSynthEditor.jsx` | display | The generated faceplate — knobs come from whichever engine the pad runs. |

Not an effect: a **sound source**. It is in `Effects/` because it is a plugin with
a panel like the rest, and a pad runs the synth whenever no sample is loaded on
it.

Both `.js` files are plain JS, not JSX, so they load before the component scripts.

---

## 1. The model

Acoustic percussion stripped to its physics:

```
   an IMPACT            a VIBRATING BODY          RATTLE / AIR FRICTION
   (the transient)      (the tonal component)     (the noise component)
```

Six engines cover a kit between them, and **each declares its own parameter
schema**, so the editor UI is generated rather than hand-written.

| Engine | Voices it makes | How |
|---|---|---|
| `membrane` | kick, toms, conga, bongo | sine/triangle body with a fast pitch drop for the beater thump |
| `snare` | snares, rimshots | two detuned tone oscillators for the shell + filtered noise for the wires |
| `metal` | hats, cymbals, ride, cowbell, triangle | six inharmonic square waves through a resonant filter — the 808 paradigm |
| `clap` | claps | several noise bursts slightly out of sync, then one decaying tail |
| `shaker` | shakers | band-passed noise with a **ramped** attack |
| `click` | clave, rim, woodblock | a resonant body struck by a sharp pulse |
| `fm` | perc blips, laser sweeps | a modulator bends the carrier — complex sidebands from two oscillators |

Every `render(ctx, p, time, vol, out)` returns **the voice's total duration in
seconds**, which is what the caller uses to schedule retirement.

---

## 2. Shared helpers, and why each exists

```
FUNCTION oaNoiseBuffer(ctx, seconds = 2):
    IF no cached buffer OR the sample rate changed:
        fill a mono buffer with white noise, cache it on window
    RETURN the cache
```

**Allocating a noise buffer per hit is the single most expensive thing a drum
synth can do.** One buffer, made once, looped by every voice that wants noise.

```
FUNCTION makeNoise(ctx, time, dur):
    src = BufferSource(the shared noise buffer), loop = true
    src.start(time) ; src.stop(time + dur + 0.05)
```

Every source gets an explicit stop time — an unstopped source holds its whole
chain alive for the life of the context.

```
FUNCTION decayTo0(param, time, dur):
    param.setValueAtTime(max(0.0001, param.value), time)
    param.exponentialRampToValueAtTime(0.0001, time + dur)
```

**Exponential ramps can never reach zero**, so everything decays to a floor of
0.0001 instead. Ramping to a literal 0 throws.

---

## 3. The engines in pseudocode

### membrane — the pitch envelope *is* the thump

```
render(ctx, p, time, vol, out):
    osc.frequency: p.pitchStart → p.pitchEnd over p.pitchDecay ms   (exponential)
    gain:          vol → 0.0001 over p.decay ms
    IF p.drive > 0.01:
        osc → gain → WaveShaper(drumDriveCurve(p.drive)) → trim(1/(1 + drive*1.6)) → out
        # trim so turning drive up changes the TONE, not the level
    IF p.click > 0.01:
        a noise blip through a 1200 Hz highpass, decaying over clickDecay ms
    RETURN decay
```

### snare — shell and wires decay separately

```
FOR each of [tone1, tone2]:
    sine at f·(1 + pitchDrop) → f over half the shell decay, gain vol·(1−mix)·0.5
noise → filter(filterType, filterFreq, Q) → gain vol·mix, decaying over noiseDecay
RETURN max(shell, wires)          # the wires rattle on after the shell stops
```

### metal — the 808 paradigm

```
RATIOS = [1, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637]      # NON-INTEGER on purpose:
                                                          # integers = a musical note
vol *= 1.95                       # summing N oscs at 1/N then filtering costs level
FOR i IN 0..voices-1:
    square at base · (1 + (RATIOS[i] − 1)·spread), gain 1/voices → filter
optional noise "sizzle" → filter                          # fills the gaps between
filter → gain: vol → 0 over decay                         # the metallic grains
```

`spread` interpolates the ratios toward 1 — at spread 0 every oscillator is the
same pitch (a cowbell-ish two-tone at low voice counts), at 2 they are pulled far
apart (a crash).

### clap — the trick is the sync error

```
vol *= 4                          # a narrow band-pass throws most of the noise away
FOR i IN 0..bursts-1:
    a noise burst at time + i·spacing, decaying over burstDecay      # the "hands"
then ONE longer burst at time + bursts·spacing over tailDecay        # the body
all through one bandpass(filterFreq, Q)
```

### shaker — ramp, do not snap

```
gain: 0.0001 →(LINEAR ramp)→ vol over attack ms →(exponential)→ 0 over decay ms
```

That linear ramp up is the whole engine: **seeds sliding, not striking.** Snap the
attack and it stops being a shaker.

### click and fm

```
click:  osc(wave, freq) decaying over `decay`
        + optional noise through bandpass(freq, Q) — the wooden crack

fm:     carrier: freq·(1 + pitchDrop·2) → freq over 40% of the decay
        mod at carrier·ratio → modGain(index → 0.01 over indexDecay) → carrier.frequency
        the depth envelope is what turns a buzz into a percussive blip
```

---

## 4. `drumDriveCurve` — two bugs frozen into one helper

```
const drumDriveCurve = memoised(amount => {
    n = 1025                                  // ODD
    k = amount * 60
    curve[i] = ((1 + k)·x) / (1 + k·|x|)      // x spans -1..+1
})
```

**The point count is odd so the middle sample lands exactly on x = 0 and maps to
0.** With an even count the curve is sampled either side of zero, and silence
comes out as a constant DC offset that never decays.

**It is file-local on purpose.** This used to be `window.oaDriveCurve` — which is
also the name the [DRIVE pedal](../Drive/README.DRIVE.MD) uses for its own curve baker.
That file loads later, so it silently replaced this one. The two take different
arguments (this wants a 0..1 knob amount, the pedal's wants a whole unit object),
so every membrane hit with drive above 0.01 called the pedal's version with a
number and threw. `build.mjs` gives each source its own IIFE scope, so keeping it
local here means the collision cannot come back.

---

## 5. Patches, and clamping on both doors

```
FUNCTION oaSynthDefaults(engine): every param's `def`, plus engine name

FUNCTION oaSynthPatch(patch):                        # THE LOAD PATH
    engine = a known engine, else 'membrane'
    out = defaults(engine) overlaid with the saved patch
    FOR each param the engine declares:
        options → snap off-list values to def
        numeric → NaN to def, otherwise clamp to [min, max]
    RETURN out
```

```
FUNCTION clampSynth(engine, key, value):             # THE SETTER PATH
    same rules, one key
```

Both doors matter, and the comments in the source are emphatic about why:

> These numbers do not stop at the patch — they are handed to `engine.render()`,
> which puts them on **AudioParams**. A decay of −1 becomes an exponential ramp to
> a negative target and the browser throws mid-voice; a pitch of 1e6 is a param
> above Nyquist. And the patch is **persisted**, so a bad value written once comes
> back on every reload until the pad is reset.

Out-of-range values arrive from hand-edited localStorage, older song files, or a
MIDI CC mapped to a range the engine never had. Clamping only in the setter does
not help a value that was never *set* — hence the load path clamps too.

```
FUNCTION oaSetSynthParam(idx, key, value):
    IF key == 'engine': START FROM THAT ENGINE'S DEFAULTS
                        # carrying parameters across would keep values that mean
                        # nothing to the new engine
    ELSE: patch = {...patch, [key]: clampSynth(...)}
    save ; dispatch 'oa-synth-changed'

FUNCTION oaSetSynthPatch(idx, patch):    # whole patch at once
```

`oaSetSynthPatch` exists because `oaSetSynthParam` *cannot* do it: feeding it
`'engine'` throws the other parameters away, so restoring a snapshot key by key
would lose everything the moment the engine differed.

---

## 6. The bounced preview

A synth voice is rendered offline to a real `AudioBuffer` so it can be drawn on
the pad exactly like a loaded sample.

```
FUNCTION synthRenderSeconds(patch):
    longest = max(decay, noiseDecay, tailDecay, attack + decay) / 1000
    RETURN clamp(longest·1.15 + 0.05, 0.25, 6)

ASYNC FUNCTION oaRenderSynthVoice(idx):
    key = JSON of the patch ; IF cached under this key: RETURN it
    off = oaOfflineContext(1, seconds)      # the APP's rate, sized in seconds
    engine.render(off, patch, 0, 0.9, off.destination)
    raw = await off.startRendering()

    # TRIM TRAILING SILENCE
    walk back from the end while |sample| < 0.0015
    copy the surviving head into a shorter buffer
    cache ; dispatch 'oa-synth-rendered'
```

**The trim is a display decision with teeth.** Without it a 30 ms rimshot is drawn
into the first eighth of the pad with the rest blank, while a long cymbal fills
it — the shapes would not be comparable at a glance.

**The bounce runs at the app's rate**, via `oaOfflineContext` rather than a local
`new OfflineAudioContext(1, ceil(rate·seconds), rate)` with its own `|| 44100`
fallback. A preview bounced at 44.1k and drawn beside a voice mixed at 48k is a
waveform whose length does not match the sound it stands for. Same reason the
shared noise buffer is keyed on `oaSampleRate(ctx)` — with one rate everywhere it
really is built once for the session, live context and offline renders alike.

Previews are re-bounced on every `oa-synth-changed` (the cache entry is deleted
first), and `oaRenderAllSynthVoices()` warms them at startup so pads show their
waveforms without being touched.

---

## 7. As a plugin

This is **the plugin that forced `paramsFor` into the contract.** Every other
effect has one fixed faceplate; a drum voice's knobs depend on which of the six
engines the pad is running, so the schema must be generated per unit.

```
id 'drumsynth' · event 'oa-synth-changed' · units = OA_PAD_MAX

paramsFor(i):
    engine = the patch's engine
    FOR each param it declares:
        options → { key, label, def, options, min: 0, max: n-1, step: 1 }
        numeric → { key, label, min, max, step, def, unit, fmt }
    # both kinds come back in the ONE form a panel knows how to draw

presets = the six engines — picking one swaps the whole faceplate, which is
          exactly what changing engine means

slots  = USER + 2
layout RENDERED = 1 while a bounced preview exists
       SECONDS  = its length, the width a display draws

read(ctx, i, frame):
    sampled = this pad has a sample buffer loaded
    frame[ACTIVE] = sampled ? 0 : 1      # the Mixer hides the SYNTH panel on
                                         # exactly this condition
    frame[RENDERED] / frame[SECONDS] from the render cache
    frame[PEAK_L] = frame[PEAK_R] = 0    # metered by the compressor strip it feeds

curve(i) = the bounced voice as a 256-point peak envelope, normalised,
           cached against the render's own key
```

The curve comes from **the same offline render the pad already shows**, so the
waveform under a synth voice and the waveform under a loaded sample are produced
by one path instead of two.

No `dispose`: nothing persistent is built here. Voices are per-hit and retire with
the rest of the chain via [`../FxBus/`](../FxBus/README.FXBUS.MD).

---

## 8. Factory patches

`OA_SYNTH_FACTORY` is 25 entries — the 16 of a 4×4 grid, then the 9 a 5×5 adds
(Kick 2, Snare 2, Open Hat, Tom Fl, Crash, Splash, Block, Triangle, Bongo).
`oaFactoryPatch(idx)` wraps modulo the list, the same way the kit's names do, and
`oaResetSynthPatch(idx)` returns a pad to its factory entry.

---

## 9. Where to change things

| You want to… | Touch |
|---|---|
| add an engine | one entry in `OA_SYNTH_ENGINES` — the schema, the editor UI, `paramsFor` and the preset list all follow |
| add a knob to an engine | its `params` block; `oaSynthDefaults` fills it into patches that predate it |
| change a factory voice | `OA_SYNTH_FACTORY` (a user's saved edits win until they Reset) |
| change how previews are drawn | `synthRenderSeconds` and the trim loop |

Covered by `test/plugins.test.mjs` (`drum synth` suite): every engine renders at
its defaults, every engine survives every knob at both extremes, a volume of zero
does not blow up an exponential envelope, a stored patch is held to what the
engine can do, an unknown engine falls back, and the noise buffer is made once and
shared.

---

## 10. The voice library

`oaDrumSynthPresets.js` exports two things:

- **`OA_SYNTH_LIBRARY`** — 76 ready-made voices, keyed, named and grouped (Kick,
  Snare, Hat, Cymbal, Tom, Percussion, FX). This is what the editor's **Voice**
  menu offers.
- **`OA_SYNTH_FACTORY_KEYS`** — which library voice each of the 25 pads comes up
  on. Just keys; `oaDrumSynthPatches.js` resolves them into `OA_SYNTH_FACTORY`,
  the array of patches everything downstream already expected.

The factory used to *be* the patches, so tuning a kick meant editing the kit, and
there was no way to offer a second kick without also assigning it to a pad.

The panel puts **Voice above Engine** deliberately: picking a voice sets the
engine *and* every parameter at once, while picking a bare engine leaves you at
its defaults with every knob still to set. `oaSetSynthVoice()` goes through
`oaSetSynthPatch()`, so a library entry is clamped on the way in like any other
data — it gets no special trust.
