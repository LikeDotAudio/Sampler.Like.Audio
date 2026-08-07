# Plugin Host — the contract every effect is written against

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaPlugin.js` | audio | The registry, the binary frame, the pump, teardown. No React. |
| `useOaPlugin.js` | display | The four hooks a panel is allowed to use. The only React in this folder. |

Read this one first. Every other folder under `Effects/` is a back end that calls
`oaRegisterPlugin(...)` and a panel that reads it back through these hooks, so once
you know this file you can read any effect by skipping to its DSP.

---

## 1. The problem this solves

Before the host existed, each editor talked to the audio graph directly:

```
CompressorEditor  ──reaches into──▶  ctx.__oaComps[idx].analyser
Mixer strip       ──reaches into──▶  ctx.__oaComps[idx].analyser
```

Two things went wrong, and both are the reason for every design decision below.

**The UI knew the DSP.** A panel that names `ctx.__oaComps` cannot be moved,
restyled or tested without a live `AudioContext`, and the back end cannot change
its node graph without breaking a display that had no business knowing the graph
existed.

**The same work was done twice per frame, allocating each time.** Two readers
meant two 1024-float allocations, sixty times a second, per channel. That is
roughly a megabyte a second of garbage on an idle machine, and the collector
pause it eventually causes lands on the audio thread as an audible dropout.

So the rule became:

> **The back end measures once, into an array it allocated at startup and never
> replaces. The front end reads numbers out of that array by index.**

A meter is now `frame[LAYOUT.PEAK_L]`. No graph, no analyser, no allocation, no
arithmetic in the display.

---

## 2. The frame

Every unit of every plugin owns one `Float32Array`, allocated on first request and
handed back — the *same object* — for ever after.

```
slot 0  SEQ      pump pass counter, incremented every pass
slot 1  ACTIVE   1 = in circuit, 0 = the unit is currently a wire
slot 2  PEAK_L   output peak, 0..1, left
slot 3  PEAK_R   output peak, 0..1, right
slot 4… whatever the plugin declares in its own `layout`
```

The first four slots are identical across every plugin **on purpose**: the Mixer
can meter any effect's return without knowing which effect it is.

`SEQ` exists because a display cannot otherwise tell a *frozen* frame from a
*quiet* one — both read zero on the peak slots. A needle that stops moving while
`SEQ` keeps climbing is silence; a needle that stops moving while `SEQ` also stops
is a bug.

### Why a Float32Array and not an object

An object per unit per frame would be allocated per frame, or mutated in place —
in which case React's `===` check sees no change and the panel never redraws, so
you end up cloning it, which is the allocation again. A fixed typed array is
mutated in place, read by index, never reallocated, and no display ever holds a
reference to a value that can go stale.

---

## 3. The back-end interface

```
oaRegisterPlugin({
    id,       // short stable key — every front-end call starts with it
    label,    // what a panel puts on its title bar
    units,    // () => how many instances exist (channels, or buses)
    params,   // front-panel schema: [{ key, label, min, max, def, fmt, hint, ticks }]
    state,    // (i) => this unit's settings as plain data
    set,      // (i, key, value) => void — clamps and persists
    presets,  // { name: { label, ...values } }
    preset,   // (i, name) => void
    slots,    // frame length, >= OA_SLOT.USER
    layout,   // { NAME: slotIndex } for everything past the shared four
    read,     // (ctx, i, frame) => void — fill the frame. BACK END ONLY.
    dispose,  // (ctx) => void — tear out every node this plugin built
    save,     // () => plain JSON — everything this effect needs to come back
    load,     // (data, opts) => void — put it back
})
```

Registration is also a **normalisation** step, and the reason is worth stating
because it looks like pointless indirection:

```
FUNCTION normaliseParams(params):
    FOR each p:
        IF p.label is a string: keep it as-is
        ELSE: copy p, and set label = p.name OR p.short OR p.key
```

The reverb's schema calls a slider's name `name`, because that is the word
engraved on the VARC 444's faceplate; the compressor calls it `label`. Both are
right in their own file. The *contract* promises a panel a `label`, so the host
fills one in rather than forcing a plugin to rename a field it has a good reason
to keep.

`paramsFor(i)` is the escape hatch for plugins whose faceplate is not fixed — the
drum synth's knobs depend on which engine the pad is running. A panel calls
`oaPluginParams(id, idx)` either way and never learns which kind it is talking to.

---

## 4. The pump

One `requestAnimationFrame` loop fills every frame of every plugin. Sixteen open
panels cost **one** pass, not sixteen.

```
FUNCTION pumpOnce():
    ctx = window.OA_AUDIO_CTX
    FOR each registered plugin p WITH a read():
        FOR i IN 0 .. p.units() - 1:
            frame = frameFor(p.id, i)          // allocates once, then reused
            frame[SEQ] += 1
            TRY   p.read(ctx, i, frame)
            CATCH frame[ACTIVE] = 0            // a broken meter must not kill the loop
```

The loop is **reference counted**, not always-on:

```
FUNCTION oaPluginAttach():
    attached += 1
    IF attached == 1: start the rAF loop
    RETURN detach():                  // idempotent — a double-detach must not unbalance
        IF already released: return
        attached -= 1
        IF attached == 0: cancel the rAF loop
```

A closed panel costs exactly nothing, and the app does no per-frame work at all
while the user is only looking at the pads.

### Peak metering

```
FUNCTION oaAnalyserPeak(analyser):
    buf = SCRATCH(analyser.fftSize)        // ONE buffer for the whole app, grown as needed
    analyser.getFloatTimeDomainData(buf)
    RETURN max(abs(sample)) over buf

FUNCTION oaWritePeak(frame, slot, peak):
    frame[slot] = peak > frame[slot] ? peak : frame[slot] * 0.86
```

Two deliberate choices:

- `oaAnalyserPeak` is the **only** call to `getFloatTimeDomainData` in the app.
  `boundary.test.mjs` fails the build if a `.jsx` file names it.
- The 0.86 decay is applied **where the number is written**, not where it is read.
  If it decayed on read, two open displays watching one unit would decay the meter
  twice as fast as one — the picture would depend on how many windows were open.

---

## 5. The front-end interface

Everything a display may call, and nothing else:

```
oaPluginFrame(id, idx)      -> the live Float32Array (same object every time)
oaPluginLayout(id)          -> { SEQ, ACTIVE, PEAK_L, PEAK_R, ...the plugin's own }
oaPluginParams(id, idx)     -> the faceplate schema
oaPluginState(id, idx)      -> current settings, plain data
oaPluginSet(id, idx, k, v)  -> move a control
oaPluginPreset(id, idx, n)  -> load a preset
oaPluginCurve(id, idx, k)   -> a Float32Array to plot
oaPluginSubscribe(id, fn)   -> settings-changed events; returns the unsubscribe
oaPluginAttach()            -> "I am reading frames"; returns the detach
```

### Curves: the other half of the handoff

A **frame** carries numbers that change every frame. A **curve** carries numbers
that change when a knob moves — a distortion transfer function, a decay envelope,
a rendered waveform.

These used to be recomputed in the editors: `DriveEditor` evaluated the pedal's
own maths a second time, in JSX, purely to plot it. Two implementations of one
curve is one too many, and the copy in the display is always the one that drifts.
Now the back end bakes it once — it needs the table for its `WaveShaper` anyway —
and the panel plots the array it is handed without knowing what is in it.

The array is owned by the back end. **Read it, plot it, never write to it.**

---

## 6. The hooks (`useOaPlugin.js`)

```
useOaFrame(id, idx, onFrame)   // per-frame numbers  → draw straight to the DOM
useOaState(id, idx)            // settings           → real React state
useOaParams(id, idx)           // faceplate schema   → real React state
useOaCurve(id, idx)            // shapes to plot     → new reference only on change
useOaPadGrid()                 // re-render when the pad count changes
oaCurvePath(curve, w, h, mode) // Float32Array → an SVG path `d` string
```

### Why the metering is deliberately not React

```
FUNCTION useOaFrame(id, idx, onFrame):
    cb = ref(onFrame)                  // a ref, so an inline arrow does not
    cb.current = onFrame               // rebuild the loop on every render

    ON MOUNT:
        frame  = oaPluginFrame(id, idx)
        layout = oaPluginLayout(id)
        detach = oaPluginAttach()      // the pump only runs while someone watches
        LOOP every animation frame:
            TRY cb.current(frame, layout)
            CATCH warn once and KEEP LOOPING
        ON UNMOUNT: cancel the rAF, then detach()
```

A `setState` per meter per frame would re-render the tree sixty times a second to
move a needle. `useOaFrame` hands the frame to a callback that writes to the DOM
directly — a style height, an SVG transform — and React never hears about it.
**Metering is not application state; it is a picture of a number.** A knob
position *is* application state, which is why `useOaState` is ordinary React.

The `try/catch` inside the tick is load-bearing: without it, one throw ends that
panel's loop permanently and the needle freezes at its last value, which reads as
a dead effect rather than a broken display.

### Why `useOaCurve` compares by identity

```
refresh():
    next = oaPluginCurve(id, idx)
    setCurve(prev => prev === next ? prev : next)
```

The back end hands back the *same* array until it rebuilds it, so a reference
comparison is exactly the question "has the shape changed?" — answered without
walking four thousand floats. It also listens for `oa-reverb-rebuilt` and
`oa-synth-rendered`, because those two back ends rebuild on a trailing edge after
the hand stops moving: the settings-changed event arrives *before* the new curve
exists, so a second nudge is needed once it does.

---

## 7. Teardown

```
FUNCTION oaDisposePlugins(ctx):
    FOR each plugin WITH dispose: TRY p.dispose(ctx) CATCH ignore
    FOR each frame: fill with 0

FUNCTION oaDisconnectAll(nodes):
    FOR each node:
        TRY node.disconnect()
        IF node.stop exists: TRY node.stop()      // a running source holds its
                                                  // whole chain alive; stopping
                                                  // it is what frees the graph
```

A failed teardown in one plugin must not prevent the other seven from being torn
down, hence the swallowed catch. `leaks.test.mjs` builds a context, runs every
plugin, disposes and asserts nothing is left holding on — a plugin that cannot be
torn down cleanly in a test will not be torn down cleanly in a browser either.

---

## 8. The boundary is enforced, not merely intended

`test/boundary.test.mjs` reads the sources and fails the build if:

- a `.jsx` file names `__oaComps` / `__oaReverbs` / `__oaDelays`, calls
  `createGain`/`createConvolver`/…, touches `getFloatTimeDomainData`, constructs an
  `AudioWorkletNode`, or reads `.analyser`;
- a `.js` file under `Effects/` or `SoundSynth/` mentions `React.` (with
  `useOaPlugin.js` as the one declared exception);
- a panel asks for a plugin `id` that nothing registers.

Since each effect now keeps its DSP and its panel in one folder, the boundary is
no longer a directory — **it is the file extension**. `.js` is audio, `.jsx`
draws, and the test above is what keeps that true.

---

## 9. The other rules a module is held to

The frame contract above is about what a **display** may know. Two more, enforced
by the same test file, are about what a **module** may know.

### One node in, and nothing to reach through

Every module that owns persistent audio exports exactly one way in, and keeps the
nodes behind it file-local:

```
oaReverbInput(ctx, u)     -> a node to send into
oaDelayInput(ctx, u)      -> a node to send into
oaCompInput(ctx, idx)     -> a node to play into, or NULL ("no compressor here")
oaDriveNode(ctx, i, …)    -> a node to play into, or NULL ("clean channel")
oaChorusNode(ctx, mode)   -> { input, output, setMode, dispose } — an INSERT, so
                             it publishes both ends and its own teardown
```

alongside `…Send(u, idx)`, `…IsFed(u)`, `…Warm(ctx)` and `…BusCount(ctx)` where
the router needs them. What a module must **not** publish is the bus object
itself: `oaReverbBus(ctx, r).input` handed out the convolver, the return fader and
the analysers with it, so re-plumbing a machine meant re-plumbing its callers.

`ctx.__oaReverbs`, `ctx.__oaDelays` and `ctx.__oaComps` are private to their own
file, and `boundary.test.mjs` fails the build if another file names one.

### One node in, one way out of the file, one way onto disk

A module that owns settings also declares how they are carried:

```
save() -> plain JSON, everything it would need to come back
load(data, opts) -> put it back, through its own setters
```

Through the SETTERS, not by assignment — they clamp, persist and fire the change
event, and a song file is exactly the untrusted input those three exist for.

Two ordering rules keep turning up, and both are in the code for a reason:

- **A reverb loads its program FIRST, then its saved parameters on top.** A
  program load overwrites every slider, so the other order silently restores an
  edited machine as the stock program it started from.
- **`on` goes LAST on anything with an in/out switch.** Every other setter pushes
  at the running engine, so half-loading a strip that is already in circuit means
  the channel — or, on the master, the whole mix — is briefly compressed by a
  mixture of the old settings and the new ones.

`oaSavePlugins()` / `oaLoadPlugins(data, opts)` do the round trip for every
registered plugin at once. `test/plugins.test.mjs` enumerates the registry rather
than a list, because a list here would rot exactly the way the song exporter's
did — see [the index](../README.EFFECTS.MD#saved-with-the-song).

### One sample rate

`libControl/SoundSynth/oaAudioRate.js` owns the number. Ask `oaSampleRate(ctx)`,
build offline contexts with `oaOfflineContext(channels, seconds)`, and never
write a literal fallback — three files used to carry their own, two of them
disagreeing, so a preview bounced at 44.1k was drawn against a tail computed at
48k. The lint catches `|| 44100`-shaped fallbacks and stray
`new OfflineAudioContext(…)` calls.

## 10. Writing a new effect

1. `NewThing/oaNewThing.js` — build the nodes behind a file-local builder, export
   `oaNewThingInput(ctx, i)` as the only way in, and call
   `oaRegisterPlugin({ id: 'newthing', … })` at the bottom.
2. Fill the frame in `read(ctx, i, frame)` using `oaAnalyserPeak` + `oaWritePeak`.
   Convert seconds to samples with `oaSampleRate(ctx)`.
3. `NewThing/NewThingEditor.jsx` — `useOaState` for the knobs, `useOaFrame` for the
   meter, `useOaCurve` if there is a shape to plot. Name no audio node.
4. Add both files to `sources.json` (engine before `oaFxBus.js`, panel anywhere
   after the shared knob components), and the engine to `BACKEND_SOURCES` in
   `test/harness.mjs`.
5. Add the panel to the `PANELS` list in `test/panels.test.mjs`, and a
   `NewThing/README.NEWTHING.MD` next to the code — every folder here names its
   own document, so an editor holding six of them open shows six distinct tabs
   rather than six called README.
6. If the router has to reach it, add the port to the `OWNED` table in
   `test/boundary.test.mjs` so its node list is private from the first commit.
