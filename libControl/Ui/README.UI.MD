# Ui — the materials every panel is built out of

**Status: foundation only.** These files exist and are written, but **nothing
imports them yet and they are not in `sources.json`**, so they are not in the
bundle and none of the panels have been converted. Read this as the plan plus
what is already written, not as a description of the running app.

| File | What it is | Wired up? |
|---|---|---|
| `oaUiTokens.js` | The materials: paint, ink, glass, LED, keycap plastic, type, panel shell. Plus `oaUiPolar()` / `oaUiRad()` / `oaUiId()`. | ❌ |
| `UiPanel.jsx` | `UiPanel` — the floating shell every editor opens inside. `UiPlate` — the faceplate finishes (paint, brushed, glass). | ❌ |
| `UiKeyCap.jsx` | `UiKeyCap` (four tones), `UiLampButton`, `UiLamp`. | ❌ |
| `UiLed.jsx` | `UiLed` (segments + bloom), `UiScreen` (backlit character window), `UiEngraved` (cut letters). | ❌ |
| `UiKnob.jsx` | `UiKnob` — one gesture, two skins so far (`rack`, `arc`). `UiKnobCell`, `useOaKnobGesture`. | ❌ |

---

## Why this exists

The rack is **drawn, not photographed**, and what makes a drawn panel read as
hardware is consistency of material: the same paint catching light from the same
direction, the same ink cut to the same depth, the same glass over every lamp.

Six editors were each carrying their own copy of that vocabulary, and they had
drifted — three different "engraved" greys, two different glass gradients, a
keycap that was ivory on one box and bone on another, two different z-indexes on
the panel shell, three corner radii. **None of that is visible one panel at a
time. All of it is visible when you open two.**

Worse, the *behaviour* had drifted with it. Four knobs were drawn four ways and
each re-implemented the same gesture by hand: drag 150 px for the full range,
wheel to nudge a fiftieth, alt-click to reset, capture the pointer so a fast drag
does not fall off the control. That gesture set is the part the hands learn, so
it must not vary between panels — and it was varying.

So the split is:

> **Behaviour is shared. Appearance is a skin. Materials are a token.**
>
> A panel picks components; a component picks materials; nothing picks a raw
> colour twice.

`UiKnob` is the worked example: one `useKnobGesture`, and a `skin` prop choosing
the drawing. Adding a look means adding a drawing function, not another copy of
the pointer maths.

---

## What is left to do

The other half of the ask — decoupling **the shapes and positions** from **the
logic behind the presentation** — has not been done at all yet. The intended
shape is one file per component type here, and each effect splitting into:

```
<Name>Editor.jsx    the container: hooks, state, handlers. No shapes.
<Name>Face.jsx      pure presentation: props in, shapes and text out. No hooks.
```

Remaining:

1. `UiFader.jsx` (the VARC's slider and the mixer's `SvgFader` are the same
   control), `UiDotMeter.jsx`, `UiVuMeter.jsx`, `UiCurvePlot.jsx`,
   `UiPresetMenu.jsx`.
2. Convert the six effect editors plus `BussCompEditor` to use them, deleting the
   inline copies — `VarcRemote`'s `Led`/`Key`/`VarcSlider`/`VarcMeter`,
   `CompressorEditor`'s `RackKnob`/`PushButton`/`Engraved`/`VuMeter`,
   `ChorusEditor`'s `DimButton`, `DriveEditor`'s `DriveKnob`/`ModeButton`/
   `TransferPlot`, `TapeDelayEditor`'s `LedReadout` and its `TOLEX`/`BRUSHED`/
   `PLATE`/`SCREEN` materials.
3. Split each panel into container + face.
4. Break up `libControl/Mixer/Mixer.jsx` (≈680 lines) the same way — the channel
   strip, the send matrix, the effect returns, the master section.
5. Add all of it to `sources.json` (components before the panels that use them)
   and to the panel list in `test/panels.test.mjs`.

Until step 5, adding these files to the bundle would only make it bigger.
