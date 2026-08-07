# Effects

One folder per unit. Each holds its DSP (`.js`), its front panel (`.jsx`) and a
README that walks the code in pseudocode and says **why** it works the way it
does.

| Folder | What it is | Files |
|---|---|---|
| [PluginHost](PluginHost/README.PLUGINHOST.MD) | The contract every effect is written against: the binary frame, the pump, the four hooks. **Read this first.** | `oaPlugin.js`, `useOaPlugin.js` |
| [FxBus](FxBus/README.FXBUS.MD) | How a hit reaches the effects, and how its nodes are let go again. **Read this second.** | `oaFxBus.js` |
| [Reverb](Reverb/README.REVERB.MD) | Two convolution machines addressed like a VARC 444 — banks, programs, six sliders a page. | `oaReverb.js`, `VarcRemote.jsx` |
| [TapeDelay](TapeDelay/README.TAPEDELAY.MD) | Four Space Echo buses: a circular buffer as the tape, two playback heads, wow, flutter and saturation in the feedback. | `oaTapeDelay.js`, `TapeDelayEditor.jsx` |
| [Chorus](Chorus/README.CHORUS.MD) | A Dimension-D width box that sits inside each tape return. Five buttons, no knobs. | `oaChorus.js`, `ChorusEditor.jsx` |
| [Drive](Drive/README.DRIVE.MD) | A distortion pedal per channel — overdrive, tube, fuzz, starve and octave, baked into one WaveShaper table. | `oaDrive.js`, `DriveEditor.jsx` |
| [Compressor](Compressor/README.COMPRESSOR.MD) | An APK 4476 FET limiting amplifier per channel, with a real VU needle. | `oaCompressor.js`, `CompressorEditor.jsx` |
| [BussCompressor](BussCompressor/README.BUSSCOMPRESSOR.MD) | **The master bus** — the one node everything sums into — and an SSL-style VCA bus compressor across it. Negative ratios, a two-stage auto release, a side-chain filter and the console fade. | `oaBussComp.js`, `BussCompEditor.jsx` |
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
| Reverb | `oaReverbInput(ctx, u)` | `oaReverbSend`, `oaReverbIsFed`, `oaReverbWarm`, `oaReverbBusCount` |
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
