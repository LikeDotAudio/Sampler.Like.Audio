# Effects

One folder per unit. Each holds its DSP (`.js`), its front panel (`.jsx`) and a
README that walks the code in pseudocode and says **why** it works the way it
does.

| Folder | What it is | Files |
|---|---|---|
| [PluginHost](PluginHost/README.PLUGINHOST.MD) | The contract every effect is written against: the binary frame, the pump, the four hooks. **Read this first.** | `oaPlugin.js`, `useOaPlugin.js` |
| [FxBus](FxBus/README.FXBUS.MD) | How a hit reaches the effects, and how its nodes are let go again. **Read this second.** | `oaFxBus.js` |
| [Reverb](Reverb/README.REVERB.MD) | Two convolution machines addressed like a VARC 444 — banks, programs, six sliders a page. | `oaReverb.js`, `VarcRemote.jsx` |
| [TapeDelay](TapeDelay/README.TAPEDELAY.MD) | Four tape-echo buses: a circular buffer as the tape, two playback heads, wow, flutter and saturation in the feedback. | `oaTapeDelay.js`, `TapeDelayEditor.jsx` |
| [Chorus](Chorus/README.CHORUS.MD) | A dimensional width box that sits inside each tape return. Five buttons, no knobs. | `oaChorus.js`, `ChorusEditor.jsx` |
| [Drive](Drive/README.DRIVE.MD) | A distortion pedal per channel — overdrive, tube, fuzz, starve and octave, baked into one WaveShaper table. | `oaDrive.js`, `DriveEditor.jsx` |
| [Compressor](Compressor/README.COMPRESSOR.MD) | An APK 4476 FET limiting amplifier per channel, with a real VU needle. | `oaCompressor.js`, `CompressorEditor.jsx` |
| [BussCompressor](BussCompressor/README.BUSSCOMPRESSOR.MD) | **The master bus** — the one node everything sums into — and a 44K-style VCA bus compressor across it. Negative ratios, a two-stage auto release, a side-chain filter and the console fade. | `oaBussComp.js`, `BussCompEditor.jsx` |
| [DrumSynth](DrumSynth/README.DRUMSYNTH.MD) | Six synthesis engines building every kit voice from scratch. A source, not an effect, but a plugin like the rest. | `oaDrumSynthEngines.js`, `oaDrumSynthPatches.js`, `DrumSynthEditor.jsx` |

## The signal path

```
                     ┌──────────────────────── per voice ────────────────────────┐
  pad / sequencer                                       ┌─▶ send ─▶ REVERB A ─┐
        │                                               │                     │
        ▼                                               ├─▶ send ─▶ REVERB B ─┤
   sample or ──▶ [DRIVE] ──▶ [pan] ──┬────────────────  ┤                     ├──┐
   DRUM SYNTH    (per hit)           │                  └─▶ send ─▶ TAPE 1..4 ─┘  │
                                     │                                │   │       │
                                     │                                │   └─▶ CHORUS ─▶ return
                                     │                                └─▶ into a reverb
                                     └─▶ [COMPRESSOR] ─────────────────────────┐  │
                                          (per channel)                        │  │
                                                                               ▼  ▼
                                                          ┌─────────────────────────┐
                                                          │  MASTER BUS             │
                                                          │  [BUSS COMPRESSOR]      │
                                                          │  [fade] ─▶ L/R meters   │
                                                          └───────────┬─────────────┘
                                                                      ▼
                                                                     out
```

- **DRIVE** is in front of everything, so the sends carry the distorted signal.
- **The COMPRESSOR** is the only per-channel node on the dry path; sends are
  tapped ahead of it.
- **Reverbs and tape delays are shared buses**, not per-channel inserts.
- **CHORUS** is an insert inside each tape return, not a bus of its own.
- **THE MASTER BUS is where all four of those paths meet** — dry channels,
  channel strips, reverb returns and tape returns. Nothing reaches the output any
  other way, which is what makes a bus compressor possible at all.

## Every module's audio surface

A module keeps its nodes to itself. The bus objects, the engines, the analysers
and the `ctx.__oa*` lists they live on are file-local; what crosses a folder
boundary is **one node to connect to**.

| Module | Way in | Also exported |
|---|---|---|
| Reverb | `oaReverbInput(ctx, u)` | `oaReverbSend`, `oaReverbIsFed`, `oaReverbWarm`, `oaReverbBusCount`, `oaClearImpulseCache` |
| TapeDelay | `oaDelayInput(ctx, u)` | `oaDelaySend`, `oaDelayIsFed`, `oaDelayWarm`, `oaDelayBusCount` |
| Compressor | `oaCompInput(ctx, idx)` → node or **null** | `oaCompWarm`, `oaCompStripCount`, `oaCompGR` |
| BussCompressor | `oaMasterInput(ctx)` → node, **never null** | `oaMasterWarm`, `oaMasterBusCount`, `oaBussGR`, `oaBussFade`, `oaBussFullDsp` |
| Drive | `oaDriveNode(ctx, idx, dest, chain)` → node or **null** | `oaDriveActive`, `oaDriveCurve` |
| Chorus | `oaChorusNode(ctx, mode)` → `{ input, output, setMode, dispose }` | it is an insert, so it publishes both ends |
| DrumSynth | `engine.render(ctx, patch, time, vol, out)` | per-hit, so it takes its destination rather than owning one |

Null is a real answer from both optional inserts, which is why the router can
treat the pedal and the compressor identically: if there is a node, use it;
otherwise carry on to where you were going.

**The master bus is the one exception, deliberately.** There is only ever one of
it, everything has to sum somewhere, and its meters and its fade are needed
whether or not the compressor is switched in — so "carry on to where you were
going" has no meaning for it. What is optional there is the *compression*: out of
circuit, the unit copies its input to its output sample for sample.

## One sample rate

Every module here turns seconds into samples — decay multipliers, tape length,
attack coefficients, bounced previews. They all count against one clock, owned by
[`../SoundSynth/oaAudioRate.js`](../SoundSynth/oaAudioRate.js):

```
window.OA_SAMPLE_RATE                       the app's rate, reconciled to the
                                            live device the first time one exists
window.oaSampleRate(ctx)                    ask, never read ctx.sampleRate
window.oaOfflineContext(channels, seconds)  build, never `new OfflineAudioContext`
window.oaNewAudioContext()                  the live context, pinned to the rate
```

Three files used to carry their own fallback — 44100 in two, 48000 in a third —
so a preview bounced at one rate could be drawn against a tail computed at
another. The one deliberate exception is re-rendering an already decoded sample
(`../SoundSynth/oaDrumkitSynth.js`), which runs at the source buffer's own rate so
that trimming 20 ms off a 44.1k sample does not resample the whole thing.

## What stays in memory

A sampler is judged on the gap between the hit and the sound, so **nothing here is
built at the moment it is played.** Every table, tape, strip and impulse response
is computed ahead of the hit and then kept. The store, the budgets and the
warm-up live in [`../SoundSynth/oaResident.js`](../SoundSynth/oaResident.js):

```
window.oaBufferCache(name, budgetOf)  a keyed AudioBuffer store, LRU, budgeted
window.oaWarmMemory()                 build everything the next hit could need
window.oaResidentReport()             what is held, by class, in bytes
window.oaResidentLine()               the same thing as one line, for a readout
```

| Unit | What it keeps resident | Built when | Let go when |
|---|---|---|---|
| Reverb | the impulse response, keyed on the settings and the rate that drew it; one bus per context | first time those settings are asked for; both live machines at warm-up | LRU, past `OA_IR_CACHE_BUDGET` (96MB) |
| TapeDelay | the tape — a power-of-two `Float32Array` per line, ~2.3 s, plus the saturation table | with the bus, if anything sends to it | with the context |
| Chorus | its insert nodes, inside the tape return | with that return | with it |
| Drive | the baked WaveShaper table (4096 floats), cached **on the unit** | first use after a shape change | when the shape changes |
| Compressor | one worklet strip per switched-on channel | warm-up | with the context |
| BussCompressor | the single master strip | warm-up, before everything else | with the context |
| DrumSynth | every patch, and every voice's bounced preview | patches at load; previews for **all** pads at warm-up | a preview, when its patch changes |

Samples are not an effect but obey the same rule, and the same file counts them:
decoded once into `OA_DRUM_SAMPLES`, kept pitched per pad, and kept **in the
browser** between sessions so a reload does not mean a folder prompt and a decode
per pad ([`../SoundSynth/oaDrumkitStorage.js`](../SoundSynth/oaDrumkitStorage.js)).

### The warm-up

```
ASYNC FUNCTION oaWarmMemory():           # on idle after load, and after a kit change
    ctx = oaAudioCtx()
    AWAIT oaRehydrateKit()               # the kit this browser was left holding
    AWAIT oaWarmFx(ctx)                   # worklets, master, strips, rooms, tapes
    FOR each reverb machine: oaBuildImpulse(ctx, unit)
    oaRenderAllSynthVoices()              # every pad, not just the ones looked at
    FOR each loaded pad without a pitched copy: oaPrecachePad(entry)
    dispatch 'oa-memory-warm'
```

It runs on idle rather than immediately, because the first paint is a user
staring at a blank page and the audio context has until the first gesture — which
is the earliest a hit can arrive — to be ready. `oaWarmFx` is still called on that
first gesture too; both paths are idempotent.

### Two rules every store here obeys

**A CACHE WITH NO CEILING IS A LEAK.** Every store is byte-budgeted with
least-recently-used eviction. "Hold everything" and "hold what fits, drop the
coldest" behave identically right up until the machine starts swapping, and only
the second one keeps working after that. This is not hypothetical: the Tone Mode
pitch cache in `../SoundSynth/oaDrumkitSynth.js` was written without a ceiling,
and a full 5 × 5 grid of pre-rendered pitches came to over half a gigabyte of
`AudioBuffer` — heard as dropouts, because the collector pressure alone stalled
the main thread.

**WHAT IS RESIDENT MUST BE COUNTABLE.** `oaResidentReport()` adds every class up,
so *"is it all in memory?"* has an answer with a number in it. It also reports
`samples.missing` — pads the app knows about but has no audio for, which is the
number that actually answers the question.

### What is deliberately *not* pre-built

**Every reverb program.** There are eleven banks of ten; each response is several
megabytes and about 11 ms of arithmetic on the main thread. Pre-building all 110
would cost roughly half a gigabyte and a visible stall to hold 108 rooms nobody
asked for. The two machines that exist are warmed, and every other program becomes
resident the first time it is loaded and stays — so the first recall of a room is
no slower than it ever was, and every one after it is a map lookup.

**Every pitch of every pad.** Tone Mode renders 61 semitones of a pad, which is
about seventy times the sample's own size, so it is built per pad on demand and
evicted against its own budget.

The principle both share: *warm what is in use, keep what has been used, and never
let either grow without a ceiling.*

## Saved with the song

An effect declares how it is saved next to the state it owns, and the song file
asks all of them at once without naming one:

```
oaRegisterPlugin({ …, save: () => plainJSON, load: (data, opts) => {} })

window.oaSavePlugins()           -> { reverb: {...}, delay: {...}, drive: {...}, … }
window.oaLoadPlugins(data, opts) -> the ids that actually loaded
window.oaSaveablePlugins()       -> which plugins have settings at all
```

`oaSongFile.js` writes that whole object into the export under `effects` (song
format v3) and restores it the same way.

**This closed a real hole.** The drive pedal and the channel compressors were
added after the exporter's hard-coded list of three, nothing in it named them,
and so every exported song came back with those channels clean — no error,
nothing missing on screen, the settings simply were not in the file. An effect
added tomorrow is in the export the moment it registers.

`opts` carries what a plugin cannot know for itself — the song's tempo, so a tape
head locked to a 1/8 is re-derived at the tempo of the song it *lands in* rather
than the one it was cut at. A plugin whose `load` throws is skipped and reported
rather than taking the import down with it: a song that restores five effects out
of six is worth more than an import that fails on the first.

## The rule the layout enforces

Each folder mixes audio and display files, so the front/back boundary is **the
file extension**:

- `*.js` is the audio layer. It may not mention `React.`
- `*.jsx` draws. It may not name an audio node, an analyser, `ctx.__oa*`, or
  construct an `AudioWorkletNode`.
- `PluginHost/useOaPlugin.js` is the one declared crossing.

`test/boundary.test.mjs` reads the sources and fails the build if any of that
stops being true. It also checks that every plugin id a panel asks for is one that
something registers, that no module names another module's node list, that the
input ports are still exported, and that nothing hard-codes a sample rate or
builds an offline context by hand.

## Adding an effect

See the checklist at the end of [PluginHost/README.PLUGINHOST.MD](PluginHost/README.PLUGINHOST.MD#10-writing-a-new-effect).
In short: a folder, an engine that calls `oaRegisterPlugin`, a panel that uses
only the four hooks, entries in `sources.json` / `test/harness.mjs` /
`test/panels.test.mjs`, and a README beside the code.

---

<sub>Part of **[Sampler.Like.Audio](https://Sampler.Like.audio)** · Written by Anthony P. Kuzub · i @ Like . audio ·
Released under the **MIT Licence** — free, for everyone, for ever ([LICENSE](../../LICENSE)).
Every visual representation in this project is an homage to classic hardware; there is no affiliation with, or
endorsement by, any of the original designers or manufacturers, and their layouts are used only because they are
familiar interfaces.</sub>
