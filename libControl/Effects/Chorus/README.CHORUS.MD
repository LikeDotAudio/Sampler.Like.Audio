# Chorus — a width box, not a chorus

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaChorus.js` | audio | The five modes, the node graph, plugin registration. |
| `oaChorusModes.js` | data | The 13 settings: four buttons and their combinations. |
| `ChorusEditor.jsx` | display | The five-button faceplate. |

This is the odd one out in `Effects/`: it is an **insert inside each tape delay**,
not a bus of its own. It sits after the tape and ahead of the return fader — see
[`../TapeDelay/README.TAPEDELAY.MD`](../TapeDelay/README.TAPEDELAY.MD).

---

## 1. Why it is not a chorus

The box this models was never really a chorus — it was a width box.

A conventional chorus sweeps a delayed copy hard enough that you *hear the pitch
move*; that warble is what everyone recognises. This does the opposite, on three
counts at once:

1. the sweep is kept so shallow it is almost inaudible on its own;
2. the two sides are swept in **opposite directions**;
3. the wet copy is **added to the left and subtracted from the right**.

Point 3 is the whole trick. Out of phase across the pair, the wet signal cancels
itself when the mix folds to mono, so the effect adds almost nothing you can point
at. The ear reads the phase difference between the sides as *space*: the sound
arrives wider and closer, with no warble sitting on top of it.

Like the original, there are **no knobs** — an OFF button and four fixed modes,
mutually exclusive, from a gentle shimmer to the deepest setting the box has.

---

## 2. The graph

```
input ─┬────────────────── dry (gain 1) ─────────────────────┬─▶ output
       │                                                     │
       └─▶ [highpass 140 Hz, forced to 2ch] ─▶ splitter      │
                                                │            │
                          ch0 ─▶ delay L (base ± sweep) ─▶ ×(+mix) ─▶ merge ch0
                          ch1 ─▶ delay R (base ∓ sweep) ─▶ ×(−mix) ─▶ merge ch1
                                        ▲        ▲                       │
                                        │        │                       └──▶ output
                              one LFO ──┴─(+d)   └─(−d)   opposite polarity gains
```

```
FUNCTION oaChorusNode(ctx, mode):
    spec = MODES[mode]
    input → dry(1) → output                       // an INSERT: dry always passes
    input → highpass(140 Hz, channelCount = 2 explicit) → splitter
    splitter.ch0 → delayL(spec.base) → wetL(+spec.mix) → merge.ch0
    splitter.ch1 → delayR(spec.base) → wetR(−spec.mix) → merge.ch1
    merge → output
    lfo(sine, spec.rate) → swL(+spec.depth) → delayL.delayTime
                         → swR(−spec.depth) → delayR.delayTime
    lfo.start()
    RETURN { input, output, setMode, dispose }
```

### The three non-obvious nodes

**The 140 Hz highpass.** Everything below stays where it was. Low frequencies
carry a lot of the level, and cross-fading them out of phase hollows the bottom
out the instant anyone folds the mix to mono.

**`channelCount = 2, channelCountMode = 'explicit'` on that filter.** A mono
source fed into a splitter lands on channel 0 and leaves channel 1 silent — which
would put the entire effect on the left and lose the cancellation the whole design
rests on. The tape output happens to be stereo; nothing else should have to be.

**One LFO, two polarity gains.** As the left side stretches, the right side
shortens. Sweeping both together would just be a chorus; sweeping them apart is
what opens the stereo field.

### Modes

| Button | base (BBD delay) | rate | depth | mix |
|---|---|---|---|---|
| OFF | 7.0 ms | — | 0 | 0 |
| 1 | 6.8 ms | 0.35 Hz | 0.18 ms | 0.32 |
| 2 | 7.2 ms | 0.42 Hz | 0.26 ms | 0.44 |
| 3 | 7.8 ms | 0.62 Hz | 0.40 ms | 0.58 |
| 4 | 8.5 ms | 0.88 Hz | 0.62 ms | 0.72 |

**At mode 0 every wet gain is zero, so what comes out is bit-for-bit what went
in.** That is why the insert can sit permanently in the tape return without
costing anything but a couple of gain nodes.

---

## 3. Punching a button

```
FUNCTION setMode(m):
    s = MODES[m]
    delayL/R.delayTime →(0.05s) s.base
    wetL.gain →(0.03s) +s.mix ;  wetR.gain →(0.03s) −s.mix
    swL.gain  →(0.05s) +s.depth ; swR.gain →(0.05s) −s.depth
    IF s.rate: lfo.frequency →(0.1s) s.rate       // NOT set when rate is 0
```

Every change is a `setTargetAtTime` ramp, not a step: long enough that punching a
button crossfades rather than clicks, short enough that it still feels like a
button.

The `IF s.rate` guard is deliberate — **the last speed is held through a bypass.**
Letting the LFO wind down to a dead stop makes the next mode land with a lurch as
it spins back up.

---

## 4. As a plugin

The chorus registers even though it has no bus of its own, because a panel should
not have to know that. It asks for chorus unit 2 and gets chorus unit 2.

```
id 'chorus' · label 'Width' · event 'oa-delay-changed'   // it IS a delay change
units = OA_DELAY_COUNT                                       // one per tape machine
state(i) = { chorus: delayUnit(i).chorus }
set(i, 'chorus', v) = oaSetDelayChorus(i, v)

params = ONE parameter with ticks ['OFF','1','2','3','4']
         — declared as a parameter so a generic panel can render it without a
           special case for "this plugin has no knobs"

slots  = USER + 2
layout MODE  = which button is lit, 0..4
       DEPTH = the sweep depth, for the depth lamp

read(ctx, i, frame):
    frame[ACTIVE] = mode > 0
    frame[MODE]   = mode ; frame[DEPTH] = spec.depth
    frame[PEAK_L] = frame[PEAK_R] = 0      // it has no meter of its own: it is
                                           // metered inside the tape return.
                                           // A zero says so; a made-up number
                                           // would not.
```

The buttons interlock in `oaSetDelayChorus` — one mode at a time, and pressing the
lit one drops back to OFF.

---

## 5. Teardown

There is no `dispose` in the registration, because the chorus is disposed **with
the delay it lives inside** (`oaDisposeDelay` calls `bus.chorus.dispose()`).

Its own `dispose` names the LFO and both polarity gains explicitly:

```
dispose(): oaDisconnectAll([lfo, swL, swR, input, output, dry, hp,
                            split, merge, dL, dR, wetL, wetR])
```

The sweep oscillator has no stop time — started once, it holds both delay lines'
`delayTime` params for as long as the context lives. Disconnecting the audio path
alone leaves it running.

---

## 6. Where to change things

| You want to… | Touch |
|---|---|
| add a mode | `OA_CHORUS_MODES` — `OA_CHORUS_COUNT`, the presets and the tick labels all derive from it |
| change how much bottom stays put | the `hp.frequency` of 140 Hz |
| make it a normal chorus | remove the sign flips on `wetR` and `swR` — and lose the point of the box |

Covered by `test/panels.test.mjs`; the mode plumbing rides along with the tape
delay's suite in `test/plugins.test.mjs`.

---

## 7. Twelve settings, still four buttons

`oaChorusModes.js`. What is easy to miss from photographs of the original is that
the four buttons were meant to be pressed **in combination** — singly they run
from a gentle shimmer (1) to the deepest the box goes (4), and together they add,
giving widths no single button reaches. That is why a four-button box is worth
twelve settings.

So a **mode is a combination**, and `buttons` lists which caps are down:

```
OFF · 1 · 2 · 3 · 4 · 1+2 · 1+3 · 1+4 · 2+3 · 2+4 · 3+4 · 1+2+3 · 2+3+4 · ALL
```

The panel still draws five buttons, exactly as the hardware does. Pressing one
calls `oaChorusToggle(mode, n)`, which toggles that cap into or out of the set
that is down and finds the entry with that exact combination.

**Voicing a combination is not addition.** Two sweeps at different rates
partially cancel, so the mix is roughly the larger plus half the smaller, the
depth a little *under* the sum, and the rate lands between the two pulled toward
whichever button is deeper.

**Order is load-bearing:** `unit.chorus` is stored per delay as an index into the
table, so entries 0–4 keep the meaning they shipped with and every combination is
appended after them.

---

## 8. Saved with the song

```
save() -> { modes: [one per tape return] }
load() -> oaSetDelayChorus per return
```

This is the one plugin whose state is **also** carried by another: the mode lives
on the delay unit, so a song file holds it twice. That is deliberate — the
duplicate is a few bytes, applying it twice is idempotent, and the alternative is
a plugin that silently has no `save()` and an export whose completeness depends
on load order.

---

<sub>Part of **[Sampler.Like.Audio](https://Sampler.Like.audio)** · Written by Anthony P. Kuzub · i @ Like . audio ·
Released under the **MIT Licence** — free, for everyone, for ever ([LICENSE](../../../LICENSE)).
Every visual representation in this project is an homage to classic hardware; there is no affiliation with, or
endorsement by, any of the original designers or manufacturers, and their layouts are used only because they are
familiar interfaces.</sub>
