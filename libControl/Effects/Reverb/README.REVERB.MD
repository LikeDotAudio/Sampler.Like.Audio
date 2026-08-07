# Reverb — two convolution machines, addressed like a VARC 444

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaReverb.js` | audio | Parameters, program banks, the impulse-response builder, the buses, plugin registration. |
| `oaReverbPrograms.js` | data | The 11 banks of 10 programs. Order is load-bearing — see the header. |
| `VarcRemote.jsx` | display | The VARC 444 remote: display glass, keypad, six sliders, dot meter. |

Two reverbs exist for the whole kit — `RV A` and `RV B` — not one per channel.
Every voice splits into a dry path straight to the output and a per-channel send
into one of the two. The tape delays feed them too (see `toRv` in
[`../TapeDelay/`](../TapeDelay/README.TAPEDELAY.MD)).

---

## 1. Why the parameters live in the impulse response

The unit models a hardware reverb, and that machine is a **feedback delay
network**: a tank of delay lines with the output folded back into the input,
processed sample by sample. This is a **convolution** reverb — the room is
precomputed as an impulse response (IR) and the browser convolves audio against
it.

That sounds like a compromise, and for some parameters it is. For the two that
matter most it is arguably the *more* direct route:

> **SHAPE and SPREAD are envelope controls.** On the real machine they shape how
> energy *builds* before it decays — the swell that makes a big hall read as big
> rather than merely long. In an FDN that has to be imposed on the tank from
> outside. In an impulse response **the envelope is the thing being drawn**, so
> shape and spread are not approximated here at all: they are the literal curve of
> the tail.

What convolution genuinely costs is that a parameter change means rebuilding the
response rather than turning a knob on a running network — a few milliseconds of
arithmetic. Hence the debounce in `oaRefreshReverb()`. The hardware has the same
tell for the same reason: its manual notes that changing SIZE briefly mutes the
audio while it re-allocates delay memory.

---

## 2. The parameters

Six to a page, because the remote has six sliders.

**Page 1 — the six on the front of the manual**

| Key | Panel | Range | What it does |
|---|---|---|---|
| `rtMid` | RTM | 0.15–12 s | Time to fall 60 dB. The single biggest decision. |
| `shape` | SHP | 0–255 | The *contour* of the buildup. Low hits and decays; high swells in. |
| `spread` | SPR | 0–255 | How *long* the buildup lasts. Shape draws the curve, spread stretches it. |
| `size` | SIZ | 4–39 m | Room dimension. Sets early-reflection spacing, and scales spread with it. |
| `hfCut` | HFC | 0.5–20 kHz | Air and soft walls eating the top end. Lower = darker, more distant. |
| `preDelay` | PDL | 0–250 ms | Silence before the room answers. |

**Page 2**

| Key | Panel | Range | What it does |
|---|---|---|---|
| `diffusion` | DIF | 0–255 | Low leaves discrete slapping echoes; high is a smooth wash. |
| `rtLow` | RTL | 0.2–4× | Bass decay as a multiple of `rtMid`. Above 1 the bottom rings on. |
| `xover` | XOV | 80–2000 Hz | Where bass multiply stops applying. |
| `erLevel` | ERL | 0–1 | Loudness of discrete wall bounces against the diffuse tail. |
| `erTime` | ERT | 0.2–3× | Stretches the early pattern without moving room size. |
| `ret` | LVL | 0–1 | How much of this machine returns to the mix. |

`ret` is special everywhere in this file: it is a **gain**, not geometry, so it
never triggers a rebuild and it is never overwritten by loading a program — the
return fader belongs to the user, not to the preset.

---

## 3. Programs and banks

Programs are stored the way the machine stores them: banks of up to ten, each
program nothing but a full set of the parameters above.

```
RANDOM HALLS   SMALL/MEDIUM/LARGE RAND HALL, RICH HALL, GOTHIC HALL
HALLS          SMALL/MEDIUM/LARGE/CONCERT HALL, CHURCH, VOCAL HALL
ROOMS          …
PLATES         SMALL/MEDIUM/LARGE/VOCAL/DRUM PLATE
WILD SPACES    CANYON, CAVERN, TUNNEL, INSIDE A PIPE, THE ABYSS
AMBIENCE       SMALL AMBIENCE, STUDIO, STAGE, DRUM BOOTH
EFFECTS        GATED, REVERSE, NONLIN, SLAP CHAMBER
```

Loading one overwrites every slider at once and clears the edit dot:

```
FUNCTION oaLoadReverbProgram(u, bank, prog):
    clamp bank and prog into range
    unit.bank, unit.prog = bank, prog
    unit.edited = false
    FOR each param EXCEPT 'ret': unit[key] = clamp(program[key])
    save to localStorage
    oaRefreshReverb(u, immediate = TRUE)     // a program load is a decision,
                                             // not a drag — rebuild now
    dispatch 'oa-reverb-changed'
```

### Migration from the two dropdowns

The units used to be a "tone" and a "size" dropdown with four choices each. A
`LEGACY` table maps every old pair onto the nearest program, so a machine set up
before the VARC existed comes back *recognisably* rather than snapping to a
default:

```
'short|bright' → PLATES:SMALL PLATE      'extralong|dull' → AMBIENCE:STUDIO   …
```

`oaSetReverb` also still accepts `'tone'` and `'size'` as strings, because a very
old song file sets them **separately**. Each is stashed under `__tone` / `__size`
and the pair is mapped as soon as either arrives — writing `'medium'` straight
into `unit.size` would break the room, since `size` is a number now.

---

## 4. Building the room

`oaBuildImpulse(ctx, unit)` reads top to bottom as the life of a single handclap:
it leaves the source (pre-delay), hits the walls a few times and comes back as
distinct slaps (early reflections), and those slaps multiply into a wash that
swells and dies (the late tail).

### How long the buffer has to be

```
FUNCTION irSeconds(unit):
    build = (spread/255) * (0.03 + (size/39) * 0.5)
    tail  = rtMid * max(1, rtLow) * 1.15
    RETURN min(14, preDelay/1000 + build + tail + 0.05)
```

The `min(14, …)` is a guard: without it a runaway setting can ask for a hundred
megabytes of stereo float.

### The whole builder

```
FUNCTION oaBuildImpulse(ctx, unit):
    rate = oaSampleRate(ctx)          # the app's one clock — see oaAudioRate.js
    len = rate * irSeconds(unit)
    buf = stereo buffer of len

    preS   = preDelay in samples
    buildS = the swell length in samples
    shapeExp = 0.12 + (shape/255) * 4.0          // THIS EXPONENT IS THE SHAPE SLIDER

    decMulHi = exp(-6.907755 / rtMid          / sampleRate)
    decMulLo = exp(-6.907755 / (rtMid*rtLow)  / sampleRate)

    FOR ch IN [left, right]:
        skew = (ch == left) ? 1 : 1.037

        # ---- the discrete bounces ----
        baseTap = (size / 343) * erTime          // 343 m/s, so metres → seconds
        FOR t IN 1..18:
            when = baseTap * skew * (t*0.61803 + sin(t*2.4)*0.17 + 0.25)
            at   = preS + when*sampleRate ; STOP if past the end
            amp  = erLevel * 0.82^t * (ch == left ? 1 : 0.93)
            n    = smear length, from diffusion
            FOR k IN 0..n-1:
                buf[at+k] += amp * (1 - k/n) * (n == 1 ? 1 : whiteNoise())

        # ---- the diffuse tail ----
        lp = low = 0 ; decHi = decLo = 1 ; coef = lpAt(0)
        FOR i FROM preS TO len-1:
            age = i - preS
            EVERY 256 SAMPLES: coef = lpAt(age / tailLength)      // damping ages

            lp   = onePoleLowpass(whiteNoise(), coef)             // air + soft walls
            low  = onePoleLowpass(lp, xoCoef)                     // split the bands
            high = lp - low

            decHi *= decMulHi ; decLo *= decMulLo                 // one multiply each
            build  = age < buildS ? (age/buildS)^shapeExp : 1     // the swell

            v = (high*decHi + low*decLo) * build
            buf[i] += dense enough ? v : v * 0.25                 // see "sparsity"
    RETURN buf
```

Every non-obvious constant, and why:

**`exp()` per sample would double the build cost.** A 60 dB fall over `rtMid`
seconds is `exp(-6.9078·t/rt)`. Since `exp(a+b) = exp(a)·exp(b)`, the entire
envelope collapses to **one multiply** in the inner loop — that is what `decMulHi`
/ `decMulLo` are. The same trick applies to the damping: `lpAt()` calls `exp()`,
so it is refreshed only every 256 samples. The damping curve moves far too slowly
for the steps to be audible.

**Two decay bands.** A real hall's low end always outlasts its top. `xover` splits
the noise with a one-pole, the two halves decay at different rates (`rtMid` vs
`rtMid × rtLow`), and they are summed back. That is the whole of "bass multiply".

**The taps are deliberately irrational.** `t·0.61803 + sin(t·2.4)·0.17 + 0.25`
keeps the 18 early reflections from falling into a rhythm — evenly spaced taps
ring as a *pitch* instead of reading as a room. The right channel is skewed by
1.037 for the same reason across the stereo field: identical taps on both sides
collapse the room to a point between the speakers.

**Diffusion does two jobs.** In the early section it decides whether each tap is a
bare impulse or a short burst of noise (`smear`). In the tail it decides
*sparsity*: at low diffusion only a fraction of samples carry full energy, and the
rest are attenuated to a quarter — which is precisely what makes a tail sound
grainy and discrete rather than smooth.

---

## 5. The bus, and the one way in

One set of buses per `AudioContext`, so the offline renderer gets its own. The
builder and everything it holds are **file-local**; the only public audio surface
is the input port:

```
window.oaReverbInput(ctx, u)   -> the node to send into (builds the bus on first ask)
window.oaReverbSend(u, idx)    -> this channel's send level, 0..1
window.oaReverbIsFed(u)        -> is anything sending to this machine?
window.oaReverbWarm(ctx)       -> build every machine that is
window.oaReverbBusCount(ctx)   -> how many exist, for the voice diagnostic
```

It used to be `oaReverbBus(ctx, r).input`, called from two other files. That
published the whole bus object — convolver, return fader, analysers — so
re-plumbing the machine meant re-plumbing its callers, and the tape delay could
(and did) reach past the input into the same object's internals.
`test/boundary.test.mjs` now fails the build if any file but this one names
`ctx.__oaReverbs`.

```
FUNCTION reverbBus(ctx, u):                          // file-local
    IF already built: return it
    input     = Gain()               // every send lands here
    convolver = Convolver(normalize = true)
    convolver.buffer = oaBuildImpulse(ctx, unit)
    ret       = Gain(standby ? 0 : unit.ret)
    input → convolver → ret → destination

    ret → ChannelSplitter → [analyserL, analyserR]     // fftSize 1024
    RETURN { input, convolver, ret, analysers, muted }
```

The analysers tap the **wet output**, so the return strip and the remote's meter
show what is actually ringing rather than inferring it from send levels.

### The debounce

```
FUNCTION oaRefreshReverb(u, immediate):
    bus.ret.gain = oaReverbGain(u, bus)      // level applies AT ONCE — it's a gain
    cancel any pending rebuild
    build = ():
        bus.convolver.buffer = oaBuildImpulse(ctx, unit)
        dispatch 'oa-reverb-rebuilt'
    immediate ? build() : setTimeout(build, 90)
```

A slider drag fires dozens of changes a second and each rebuild is milliseconds of
arithmetic. The trailing edge (90 ms after the hand stops) is what keeps dragging
smooth. The separate `oa-reverb-rebuilt` event exists because the settings event
fires *before* the new buffer exists — `useOaCurve` listens for both.

### Two ways to go quiet, which must not fight

```
FUNCTION rvGain(u, bus):  RETURN (bus.muted OR unit.standby) ? 0 : unit.ret
```

- **MUTE** is momentary, lives on the *bus*, and dies with the context.
- **POWER / standby** is persistent, lives on the *unit*, and survives a reload.

Either alone silences the return, and neither can strand the other in a state
where the machine looks live and is not. Both ramp with `setTargetAtTime` rather
than a step, because an instant gain change on a ringing tail clicks.

### Teardown

```
FUNCTION oaDisposeReverb(ctx):
    clear every pending rebuild timer     // else it fires into a dead bus and
                                          // builds a fresh impulse for nobody
    FOR each bus: disconnect input/convolver/ret/analysers
                  convolver.buffer = null
```

Dropping the buffer matters as much as dropping the node: an IR is seconds of
stereo float, the largest single allocation in the whole effects rack.

---

## 6. As a plugin

```
id 'reverb' · event 'oa-reverb-changed' · units = 2
presets  = every stored program flattened to "bank:prog" keys, so a generic
           panel can load one by name while the VARC still addresses them
           by bank and number the way the hardware does
slots    = USER + 2
layout   SILENT  = 1 while muted or in standby   (the panel's POWER lamp)
         RETURN  = the return level actually in force, after mute and standby

read(ctx, i, frame):
    frame[ACTIVE] = bus exists AND not standby
    frame[SILENT] = standby OR bus.muted
    frame[RETURN] = oaReverbGain(i, bus)
    oaWritePeak(frame, PEAK_L/R, oaAnalyserPeak(bus.analysers[0/1]))
```

### The curve

```
curve(i):
    key = every parameter value joined            // cheap identity of "the room"
    IF key unchanged: RETURN the same array       // 60 asks a second, one build
    d = the convolver's ACTUAL channel-0 data
    FOR each of 256 output points:
        take the PEAK of the corresponding block of d
    normalise so the maximum is 1
```

Two decisions worth copying elsewhere:

- It reads the buffer **the convolver is actually running**, not a second
  implementation of the maths. There is no way for the picture to drift from the
  sound.
- **Peak** per block, not average: an average of a noisy IR trends to a smooth
  nothing, while the peak envelope is the shape a person recognises as a reverb
  tail.

---

## 7. The panel (`VarcRemote.jsx`)

The interaction is the one from the manual, not a settings form: you do not pick
"large" from a list, you walk the banks, load a numbered program, and push the six
sliders until the room is the one you wanted.

```
line 1   ▾NN  PROGRAM NAME  [*]     the running program; * = edited away from it
line 2   ▾NN  BANK NAME            the bank being BROWSED — dimmed while browsing
line 3   PAGE n  /  a flashed message
```

**Browsing vs running.** `bankSel` (React state) is the bank on screen;
`unit.bank` is where the running program came from. While they differ,
`browsing` is true and line 2 renders dim — the machine's way of saying *nothing
has changed yet*. On hardware that bank number flashes; dimming is this display's
version of flashing.

**The keypad** loads program N of the *browsed* bank, with `0` as the tenth key.
Stepping programs from a browsed bank deliberately restarts at that bank's first
program rather than carrying an index across banks of different lengths.

**The meter** reads the plugin frame, not the analysers:

```
useOaFrame('reverb', active, (frame, L) =>
    IF dispHold: RETURN                          // HOLD stops the READER, not the source
    FOR ch IN [L, R]:
        p  = frame[ch ? PEAK_R : PEAK_L]
        db = 20*log10(p * VARC_METER_GAIN)       // gain 2 — display only
        light the dots below db on a -34..+12 scale, last two are the ovld pair
)
```

Before the plugin host existed this panel found the bus in `ctx.__oaReverbs` and
read the analysers itself — which meant *opening the panel doubled* the metering
work the Mixer's return strip was already doing on the same nodes.

`VARC_METER_GAIN = 2` is display-only lift: a reverb return is quiet by nature, and
without it a typical tail flickers at the far left of the scale. Nothing
downstream hears it.

HOLD is honoured in the reader for the same reason: the frame keeps being filled
for every other display, and this one simply stops looking. The needle stops, the
room does not.

**WET SOLO** puts every *other* machine into standby, and lifting it simply
clears standby again — no saved-state bookkeeping to get out of step.

---

## 8. Tests and gotchas

Covered by `test/plugins.test.mjs` (impulse length and content, program loads,
mute/standby interaction) and `test/panels.test.mjs` (the remote opens, redraws
and closes against a fake React).

| Gotcha | Where |
|---|---|
| `ret` must never trigger a rebuild or be written by a preset | `oaSetReverb`, `oaLoadReverbProgram` |
| a pending rebuild after disposal builds an IR for nobody | `oaDisposeReverb` clears the timers |
| `oa-reverb-changed` fires *before* the new IR exists | listen for `oa-reverb-rebuilt` too |
| the IR is the biggest allocation in the rack | `irSeconds` caps at 14 s |
| a tail built at one rate under a mix running at another | `oaSampleRate(ctx)`, never a literal — `test/boundary.test.mjs` enforces it |

---

## 10. The program library

`oaReverbPrograms.js` holds every stored program and nothing else — 11 banks of
10, up from 7 banks of 4–6. The keypad has ten keys, so a bank holds ten
programs; a bank of four left six dead keys.

| Bank | What it is |
|---|---|
| RANDOM HALLS | halls with random tail elements — long, slightly unstable, never metallic |
| HALLS | the same shapes without the random element, so the tail sits still |
| ROOMS | denser and shorter: early reflections are most of what you hear |
| PLATES | no walls, so almost no early energy and near-total diffusion from the first millisecond |
| WILD SPACES | sizes at the end stop, bass multiply far past 1 |
| AMBIENCE | short enough to hear the space without hearing a reverb |
| EFFECTS | gated, reverse, non-linear — not trying to be a room |
| CHAMBERS | a real room built to be recorded in: denser than a hall, far more early energy than a plate |
| RANDOM SPACES | the random algorithm on spaces rather than halls — a texture, not a room |
| CONCERT HALLS | voiced for something *played* in them: long pre-delays, early reflections low |
| POST & FOLEY | places, not reverbs — car interiors, garages, stairwells, a stadium |

**Order is load-bearing in two places.** A program is addressed by (bank,
program), and a song file, a saved unit and the `LEGACY` table all store those
two numbers — so new programs are appended to the end of their bank and new banks
to the end of the list. Reordering silently repoints every saved session at a
different room.

---

## 11. Saved with the song

```
save() -> { units: [both machines, whole] }
load() -> per machine: sends, THEN the program, THEN every saved parameter on
          top of it, then ret and standby
```

**The order is the whole of it.** `oaLoadReverbProgram` overwrites every slider,
so loading the program after the parameters would restore an edited machine as
the stock program it started from and lose every edit — silently, since the
result is a perfectly good reverb.

A v1 song carried one flat reverb rather than a list; it lands on machine A. A
pre-VARC song carries `size`/`tone` as strings, and `oaSetReverb` maps that pair
onto the nearest program.

---

<sub>Part of **[Sampler.Like.Audio](https://Sampler.Like.audio)** · Written by Anthony P. Kuzub · i @ Like . audio ·
Released under the **MIT Licence** — free, for everyone, for ever ([LICENSE](../../../LICENSE)).
Every visual representation in this project is an homage to classic hardware; there is no affiliation with, or
endorsement by, any of the original designers or manufacturers, and their layouts are used only because they are
familiar interfaces.</sub>
