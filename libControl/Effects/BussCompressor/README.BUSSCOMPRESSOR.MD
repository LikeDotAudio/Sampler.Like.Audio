# Buss Compressor — the master bus, and the VCA compressor across it

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaBussComp.js` | audio | The master bus itself, the stepped-pot tables, the AudioWorklet compressor, a native fallback, the fade, plugin registration. |
| `oaBussCompPresets.js` | data | The 19 factory settings. |
| `BussCompEditor.jsx` | display | The faceplate: a gain-reduction meter, nine knobs, three latching buttons and the mode switches. |

This is the **last thing in the signal path**. Everything audible in the app sums
into it — see [`../README.EFFECTS.MD`](../README.EFFECTS.MD) for the whole rack.

---

## 1. Why this file owns the master bus

Before it existed there was no master bus. Four different modules each connected
straight to `ctx.destination`:

```
oaFxBus.js       the dry path of every uncompressed channel
oaCompressor.js  every channel strip's output
oaReverb.js      both reverb returns
oaTapeDelay.js   all four tape returns
```

"The mix" was therefore a thing that only existed *inside the browser's own
summing node*, where nothing could reach it. **You cannot compress a signal you
never hold.** So one module now owns one bus, and those four connect to it
instead:

```
   channels ─┐
   strips ───┤
   reverbs ──┼─▶ [master in] ─▶ [COMPRESSOR] ─▶ [fade] ─▶ [out] ─▶ destination
   tapes ────┘                                                │
                                                              └─▶ L/R analysers
```

### It is not optional, and that is deliberate

Every other insert in this rack returns **null** when it has never been switched
on, and the caller carries on to wherever it was going. `oaMasterInput(ctx)` never
returns null, for three reasons:

- there is only ever **one** master, so there is nothing to be transparent *for*;
- everything has to sum **somewhere**, and the browser's destination is a worse
  place to do it because nothing can be inserted there afterwards;
- the **meters and the fade** need the bus whether or not the compressor is in.

What *is* optional is the compression. With **IN** out, the worklet takes a fast
path that copies its input to its output, and `plugins.test.mjs` asserts that
copy is bit-for-bit — with the threshold at −40, the ratio at 20:1, make-up at
+18 dB and 4K at full. The whole mix goes through this node; "almost the input"
would be a permanent, unfixable veil over the record.

The cost of the bus itself is **one gain node, one fade gain, one output gain,
the engine and two analysers, built once per context**. Not per hit —
`plugins.test.mjs` measures a clean voice at one node, the pan, exactly as before.

---

## 2. What it is

The SSL bus compressor: the one in the centre section of a 4000-series desk, and
the reason a stack of thirty tracks stops sounding like a stack. A **VCA** design
— fast, predictable, and much more about *cohesion* than about level control.

The feature set is **The Bus+**'s, which is SSL's own most recent version of that
circuit, so what is modelled here is theirs rather than invented. The faceplate is
laid out like the rack emulations of the G-series: meter across the top, then
three rows of three knobs, then three latching buttons.

**On a bus, less is more.** Two or three dB on the meter is what "glue" costs. A
needle that goes down and never comes back up is a threshold set too low, not a
compressor working hard.

---

## 3. The controls

Every numbered control on the real unit is a **stepped pot**, and they are stepped
here too: the knob picks an index into a table and the formatter turns it back
into the engraved number. Steps rather than a sweep because that is what the
hardware does, and because it makes a setting *sayable* — "attack 3, release auto,
four to one" is a recall; "attack 3.4718 ms" is not.

| Control | Range | What it does |
|---|---|---|
| **Threshold** | −20…+20 dB | Where compression starts. 0 sits at −18 dBFS. |
| **Ratio** | 11 positions | 1.3, 1.5, 2, 3, 4, 5, 10, 20, **−2.5, −1.5, −0.5** |
| **Attack** | 10 positions | .1, .3, 1, 3, 6, 10, 15, 20, 30, 40 ms |
| **Release** | 11 positions | .05 … 1.2 s, plus **AUTO** and **AUTO 2** |
| **Make-Up** | −10…+20 dB | Post-VCA, so it does not change how hard the unit works. |
| **SC Filter** | OUT…300 Hz | 12 dB/oct high-pass **in the detector only**. |
| **Mix** | DRY…WET | Parallel compression, two laws — see §5. |
| **Trim** | −18…+18 dB | Gain into the whole unit. |
| **Rate-S** | 1…60 s | How long the FADE button takes. |

and five switches: **IN**, **ANALOG** (4K mode, with nine distortion
intensities), **F/B**, **LOW THD** and **Σ S/C**.

### Ratio, including the negative ones

The gain computer takes one expression for the entire list:

```
slope = 1 - 1/ratio
GR_dB = (level_dB - threshold) · slope        [above the knee]
```

| ratio | slope | one dB over the threshold comes out… |
|---|---|---|
| 1.3 | 0.23 | 0.77 dB over |
| 4 | 0.75 | 0.25 dB over |
| 20 | 0.95 | 0.05 dB over |
| **−2.5** | **1.40** | **0.40 dB under** |
| **−1.5** | **1.67** | **0.67 dB under** |
| **−0.5** | **3.00** | **2.00 dB under** |

A negative ratio turns the transfer curve **over**: past the threshold, louder in
means quieter out. It is there either to nail a peak nothing else will hold, or on
purpose, for the pumping. No special case is needed in the DSP — the same line of
arithmetic covers all eleven positions, which is the whole reason the formula is
written that way.

The one value it cannot take is **zero**, since `1 - 1/0` is not a number. The
worklet clamps a ratio inside ±0.05 of the useless range, and
`plugins.test.mjs` asserts that no position on the pot is near it.

### Attack: slow is punchier

Fast (.1 ms) catches the stick hit itself and softens it. Slow (30–40 ms) lets the
whole transient through and clamps only the body behind it — so the transient ends
up *louder relative to everything else* than it was before compression. That is
why a mix bus compressor usually wants a slow attack and a channel limiter often
does not.

---

## 4. The release, which is where the character is

### AUTO is two time constants at once

A single release position has to choose. Fast, and the bed of the mix pumps up
between hits. Slow, and one loud chorus holds the record down through the verse
after it. **AUTO** does not choose:

```
AUTO     100 ms short stage,  12 s long stage
AUTO 2    50 ms short stage,   6 s long stage
```

In DSP, two envelopes and a maximum:

```
FAST:  attacks at the attack constant, releases at the SHORT constant
SLOW:  chases FAST with the LONG constant, both directions
applied = max(FAST, SLOW)
```

Why that shape works:

- A **transient** — a snare, five milliseconds — moves FAST a long way and SLOW
  almost not at all, because 5 ms against a 12 s constant is nothing. The applied
  reduction is FAST's, and it releases in a tenth of a second.
- A **sustained passage** charges SLOW up over seconds. When the passage ends,
  FAST drops in 100 ms but SLOW is still most of the way up and takes ten seconds
  to come down. The applied reduction is SLOW's.

That is exactly the manual's "louder elements released quickly, quieter elements
more slowly", and it is the reason AUTO is where most mixes leave this knob.
`plugins.test.mjs` runs both cases — one second of material and one 5 ms stab,
each followed by the same second of silence — and asserts the sustained one is
still pulling more than five times as much.

### LOW THD caps the release rather than smoothing the gain

Most compressors distort low frequencies before high ones, especially at fast
release settings. The mechanism is not mysterious: **an envelope that can fall
inside one cycle of a bass note starts tracking the waveform instead of the
note**, and a gain modulated at 50 Hz *is* 50 Hz distortion.

The obvious fix — an extra smoothing filter on the applied gain — is wrong,
because it slows the **attack** too, and a bus compressor with a .1 ms attack
setting that actually takes 6 ms is lying. So LOW THD caps the **release
coefficient** at a ~12 ms constant and leaves the attack untouched: the fastest
release is then just outside the period of the lowest notes.

---

## 5. Mix, in two laws

```
CLASSIC   (default)      wet = mix          dry = 1 - mix
PARALLEL                 wet = mix          dry = 1           (except fully wet)
```

Classic **crossfades**: at 50% you get half of each, and the level stays roughly
put. Parallel holds the untouched mix at 100% and rides the compressed one in on
top, which is the New York trick and gets loud fast.

The one exception is parallel at fully clockwise, which drops the dry to zero —
**audition**, so the compressed path can be heard on its own while the settings
are being made. Turning a knob to its end to hear the thing you are adjusting is
worth the irregularity.

---

## 6. F/B — where the detector listens

By default the side chain is fed **feed-forward**: the detector reads the input,
so it sees the transient perfectly and grabs it.

**F/B** feeds the detector from **after the VCA** instead. It is then reading a
signal that is already being turned down, so it asks for less, which turns it down
less, so it asks for less still. The loop settles at roughly **half** the
reduction:

```
feed-forward   gr = over · slope
feed-back      gr = over · slope / (1 + slope)
```

That settling point is the whole "relaxed" character — the grab softens into a
lean.

One detail worth getting right: the tap is **post-VCA but pre-make-up**. The
manual is explicit that make-up on this unit is an MDAC stage *after* the feed to
the side chain, and that is exactly why turning make-up up does not make the box
compress harder. Tapping after make-up instead would silently convert the
make-up knob into a second threshold control.

---

## 7. 4K MODE — even harmonics, not overload

A 4000-series desk ran its bus VCA **unbalanced**. Unbalanced means asymmetric,
asymmetric means **even-order** harmonics, and even-order harmonics are what
"thick" sounds like. A symmetric shaper — plain `tanh` — gives odd harmonics,
which sound like fuzz. That difference is the entire point of the switch.

```
u = drive · x
y = tanh(u + asymmetry · u²)         ← the squared term IS the asymmetry
y = y · levelCompensation
y = dcBlock(y)
```

Nine intensities, mapped onto drive, asymmetry and the level put back afterwards,
so turning it up **thickens** rather than getting louder. Distortion by shaping
rather than by overload, so — as the manual notes about the hardware — it costs no
headroom and no noise floor.

**The DC blocker is load-bearing.** `u²` has a DC component by construction; left
in, the master bus would acquire a standing offset and the headroom would go with
it. `plugins.test.mjs` averages twenty whole cycles of the output and asserts the
offset is under 0.005.

It sits **in the VCA's place, before make-up**, because on the real desk the
distortion came from the gain element itself rather than from a stage after it.

---

## 8. The side-chain filter

A 2nd-order (12 dB/oct) RBJ high-pass at Q = 0.707, OUT to 300 Hz in 10 Hz steps,
recomputed only when the knob moves.

**It filters the detector, not the audio.** That is the entire trick and it is
worth being blunt about why it matters: a record with real sub-bass drives a
full-band detector almost entirely from the kick, so the whole mix ducks in time
with it. Put the filter in and the detector stops hearing the bottom end while the
mix keeps every bit of it.

`plugins.test.mjs` sends 50 Hz and 2 kHz at the same level through a 200 Hz
setting and asserts the low tone pulls less than a third of the reduction.

The two detection modes are the Bus+'s:

```
CLASSIC   det = max(|L|, |R|)          the louder side decides for both
Σ S/C     det = |L + R| / 2            summed first, so what is hard-panned
                                       cancels and what is up the middle drives it
```

Either way the reduction is applied to **both** sides. Compressing the two
independently makes a hard-panned hit shove the image sideways every time it
lands.

---

## 9. Where the smoothing goes

The same choice the channel limiter makes, for the same reason. The textbook
version smooths the detected **level** and derives a gain from it; this smooths the
**gain reduction** instead. The static curve is evaluated instantly on the
rectified peak, and the attack and release constants are applied to the number of
decibels of reduction on its way to that target.

It costs the same and it is better behaved: the knobs then mean exactly what the
panel says they mean ("time for the gain to come down"), and the ratio stays
honest at every point of the envelope rather than drifting while a level detector
catches up.

The knee is a fixed **6 dB soft knee**. The bus compressor's reputation for being
inaudible until you bypass it is largely this — nothing on the panel switches on
at a corner, and a corner in the gain is a click.

---

## 10. The fade

**RATE-S** and **FADE** reproduce the console's auto-fade: a linear ramp on a gain
node taking the master to silence over 1–60 seconds, and back up when pressed
again.

Three decisions worth stating:

- **It rides a gain AFTER the compressor.** Fade in front of the detector and the
  compressor hears the mix getting quieter, lets go, and pushes the level back up
  — the fade fights itself and never quite ends.
- **Linear, not exponential.** A ramp to zero cannot be exponential at all in Web
  Audio, and a smoothed one arrives late and then hurries, which is very audible
  over half a minute. A hand on a fader is linear.
- **Timed by distance remaining.** Aborting a fade half way down brings it back at
  the rate it went down rather than snapping.

The panel needs to draw the fade's progress, and an AudioParam mid-automation is
not a number a display can portably ask for. So the ramp is **remembered** as
`{from, to, t0, t1}` and the position is arithmetic — which answers the same in a
browser, in an offline render and in a test.

---

## 11. The frame

```
slot 0  SEQ       shared
slot 1  ACTIVE    shared — 1 when the compressor is in circuit
slot 2  PEAK_L    shared — the master output, left
slot 3  PEAK_R    shared — the master output, right
slot 4  GR        gain reduction being applied, in dB
slot 5  FADE      the master fade gain, 0..1
```

`PEAK_L` and `PEAK_R` are split from a channel splitter rather than shared, unlike
the channel limiter's single reading. This is the one meter in the app with a
genuine left and right to show: the detector is stereo-linked but the *audio* is
not, and a mix really is wider on one side than the other.

Both the buss compressor's own panel and the Mixer's master strip read this one
frame. The Mixer's master meters used to be an **estimate** — every trigger's
velocity accumulated through an equal-power pan approximation — which could not
see a reverb tail, a tape repeat, a channel's makeup gain, this compressor, or the
fade. There is a real bus now, and it meters itself.

---

## 12. The native fallback

Where `AudioWorklet` is unavailable, the same shape is built from native nodes
around `DynamicsCompressor`. What survives: threshold, ratio, attack, release,
knee, make-up, trim and the mix blend. What cannot, and why:

| Lost | Why |
|---|---|
| **S/C Filter** | A native compressor has no side-chain input. |
| **F/B** | No way to feed its detector from its own output. |
| **Negative ratios** | Its ratio cannot go below 1 — a negative position lands on 20:1 rather than silently becoming 1:1. |
| **4K mode** | The shaper is a per-sample loop that does not exist here. |
| **LOW THD** | So is the release cap. |
| **AUTO / AUTO 2** | No two-stage release; the short stage is used, which does most of the audible work. |

The panel asks `oaBussFullDsp()` when it opens and **greys those switches out**,
rather than offering controls that quietly do nothing.

---

## 13. Saved with the song

```
save() -> every switch and every knob, FLAT — there is only ever one of these,
          so there is no `units` array to index into
load() -> back through oaSetBuss(), which clamps, persists and pushes at
          whichever engine is running
```

`on` is applied **last**, for the same reason it is on the channel strips: every
other setter pushes at the running engine, so half-loading a master that is
already in circuit means the mix is briefly compressed by a mixture of the old
settings and the new ones — and this is the master, where everything is audible
at once.

The stepped controls save as **pot positions**, not resolved values, which is
what makes an imported song survive a change to the tables: add a detent to
`OA_BUSS_ATTACKS` tomorrow and an old song still lands on the position it was
saved at.

See [the plugin host](../PluginHost/README.PLUGINHOST.MD) for the contract, and
[the index](../README.EFFECTS.MD#saved-with-the-song) for how the song file asks
every effect at once.

## 14. Where to look

| Question | File, section |
|---|---|
| How does a panel talk to this? | [`../PluginHost/README.PLUGINHOST.MD`](../PluginHost/README.PLUGINHOST.MD) |
| How does a hit reach the bus? | [`../FxBus/README.FXBUS.MD`](../FxBus/README.FXBUS.MD) |
| The per-channel compressor | [`../Compressor/README.COMPRESSOR.MD`](../Compressor/README.COMPRESSOR.MD) |
| Everything's audio surface | [`../README.EFFECTS.MD`](../README.EFFECTS.MD) |

## 15. Two things not done

- **The master fader is still cosmetic.** `masterVol` in the Mixer is React state
  that no audio node reads — it was that way before this bus existed, and wiring
  it in now would silently attenuate everyone's stored setting. The bus is the
  obvious place for it when someone decides what should happen to existing values.
- **The panel draws its own knob.** `libControl/Ui/UiKnob.jsx` exists to end
  exactly that duplication, but is not in `sources.json` yet; this faceplate
  should move onto it when it lands, along with the other five that still carry
  their own copy of the pointer maths.
