# FX Bus — how a hit reaches the effects, and how it is let go

**Files**

| File | Layer | What it is |
|---|---|---|
| `oaFxBus.js` | audio | Per-voice routing, voice retirement, bus warm-up, and the `voices` diagnostic plugin. |

No panel. This is the plumbing every other folder plugs into, so read it second —
after [`../PluginHost/README.PLUGINHOST.MD`](../PluginHost/README.PLUGINHOST.MD) and before any
individual effect.

---

## 1. What it does

Every time a pad is struck, the sampler builds a source node and asks this file
for something to connect it to. What comes back is the head of a small chain
built **for that one hit**: a panner, a send gain for each effect bus this channel
actually feeds, and — on a driven channel — a whole distortion pedal.

```
             ┌───────────────────────────── per hit ─────────────────────────────┐
                                                        ┌──▶ send ──▶ reverb A bus
 source ──▶ [DRIVE pedal] ──▶ [pan] ──┬──▶ send ────────┼──▶ send ──▶ reverb B bus
            (only if driven)          │                 └──▶ send ──▶ delay 1..4 bus
                                      │
                                      └──▶ [COMPRESSOR strip] ──▶ MASTER BUS
                                             ↑ built ONCE per channel, shared
```

Three placement decisions, each with a reason:

**DRIVE goes in front of everything.** A pedal sits on the floor before the desk,
not in the aux rack, so the reverbs and tapes are fed the *distorted* signal. On a
clean channel `oaDriveNode` returns null and the voice connects straight to the
pan — bit for bit the original path, not "distortion turned down to zero".

**The COMPRESSOR goes on the end of the dry path, after the pan.** It is the one
thing here built once per channel and shared by every voice, because *a compressor
with no memory of the last hit is not a compressor*. Per-voice would mean every
note arriving at a fresh, unloaded detector.

**The sends are therefore tapped ahead of the compressor.** The reverbs and tapes
hear the channel's natural dynamics while the direct sound is squashed. This is
the more useful of the two orders — feeding a compressed signal to a reverb makes
the tail swell up behind every hit, which is a specific effect rather than a
neutral default.

---

## 2. Building a voice

```
FUNCTION oaVoiceOut(ctx, idx, pan):
    sweep(ctx)                              // pay off the last hit's rubbish first

    chain = []
    node = pan ? StereoPanner(pan) : Gain() // a plain gain when panning is off or
    chain.push(node)                        // unsupported — same shape either way

    compIn = oaCompInput(ctx, idx)          // an INPUT PORT, or null if this
    node.connect(compIn OR oaMasterInput(ctx))   // channel is uncompressed

    FUNCTION tap(amount, target):
        IF amount <= SEND_EPSILON: RETURN   // 0.001 — below this, build NOTHING
        sg = Gain(amount)
        node.connect(sg); sg.connect(target)
        chain.push(sg)

    FOR r IN 0..OA_REVERB_COUNT-1: tap(oaReverbSend(r, idx), oaReverbInput(ctx, r))
    FOR d IN 0..OA_DELAY_COUNT-1:  tap(oaDelaySend(d, idx),  oaDelayInput(ctx, d))

    drive = oaDriveNode(ctx, idx, node, chain)   // null on a clean channel
    head  = drive OR node
    head.__oaChain = chain                       // everything to disconnect later
    RETURN head
```

**Every destination here is an input port, and every send level is answered by
the module that owns it.** This loop used to read `OA_REVERB.units[r].sends[idx]`
and then reach into the returned bus object for `.input` — so the one file whose
job is to know nothing about how the effects are built knew both the shape of
another module's settings *and* the shape of its node graph. See
[the ports section](#7-the-ports-this-file-uses).

**Sends are read when the voice is built, not tracked live.** Moving a send knob
lands on the next hit rather than re-levelling notes that are already ringing —
which is how a real desk behaves, and it also means no per-voice subscription.

**`SEND_EPSILON` is a build-time test, not a gain floor.** A send at zero produces
no node at all, so a channel with nothing switched on costs exactly one node per
hit. `test/plugins.test.mjs` asserts both halves of this: *"a channel with no sends
and no pedal builds one node"* and *"a send below the epsilon builds no path"*.

---

## 3. Voice retirement — the reason this file has a queue

Everything above is built **per hit**. At sixteenth notes across a full grid that
is a few hundred nodes a second wired into a graph that reaches the destination.

The spec says a node with no references and no live input is collectable, and the
browser does eventually collect them. *Eventually* is the problem: the collector
runs when it decides to, the pause lands where it lands, and a pause during
playback is heard as a dropout.

```
FUNCTION oaRetireVoice(ctx, node, at):
    chain = node.__oaChain ; IF empty: RETURN
    ctx.__oaRetire.push({ chain, at: at + 0.25 })   // 0.25s of grace
    node.__oaChain = null
    sweep(ctx)

FUNCTION sweep(ctx):
    now = ctx.currentTime
    keep = entries whose .at is still in the future
    FOR every entry that is due:
        disconnect every node in its chain
    ctx.__oaRetire = keep                            // compacted in place
```

Two details that look arbitrary and are not:

- **The 0.25s grace.** The send gains are still feeding the reverb and delay buses
  for as long as the note rings. Cutting at the note's end would chop the *send*,
  not the sound — an audible truncation of the tail.
- **Swept, not timed.** A `setTimeout` per voice would be one timer per hit: the
  same churn in a different currency. The sweep is a linear pass over a queue that
  is normally a handful of entries, and it is triggered by the next hit.

The last voice of a session has no next hit behind it, so the meter pump calls
`oaSweepVoices(ctx)` once a frame. That is also how the tests watch the queue
drain to zero instead of assuming it does.

---

## 4. Warm-up

```
ASYNC FUNCTION oaWarmFx(ctx):
    AWAIT oaPrepareFx(ctx)          // registers the worklet modules
    oaMasterWarm(ctx)               // the one bus everything sums into
    oaCompWarm(ctx)                 // every switched-on strip
    oaReverbWarm(ctx)               // every room anything sends to
    oaDelayWarm(ctx)                // every tape anything sends to
```

The live context calls this on the first user gesture; the offline renderer awaits
it so its buses exist synchronously while the pattern is being scheduled.

**Each module decides for itself what "in use" means and builds what it needs.**
This function used to loop over `OA_REVERB.units` and `OA_DELAY.units` here,
testing send arrays and wiring each delay's `toRv` throws by hand. All three of
those loops now live in the file that owns the nodes.

What is left is the one thing genuinely the router's business: **order, which
matters and fails silently when wrong.**

- **Strips first.** If a strip were left to be built by the first voice, it would
  be constructed while the worklet module was still registering, take the native
  `DynamicsCompressor` fallback, and keep it for the whole session — the app would
  work, sound slightly wrong, and never say why. Building after `oaPrepareFx`
  resolves means the answer about worklets is already in.
- **Rooms, then tapes.** A tape wires its own throw into a room as it is built, so
  the room is ready either way — but building rooms first keeps the graph's
  construction order the same as its signal order, which is what makes a node dump
  readable when something is wrong.

---

## 5. The `voices` plugin — a diagnostic with no sound

This registers as a plugin with no panel and no audio, purely to publish numbers:

```
layout: VOICES    = live sources sounding right now
        PENDING   = chains built and waiting to be released
        CACHE_MB  = megabytes held by the Tone Mode pre-render cache
        BUSES     = reverbs + delays + compressor strips currently built

read(ctx, i, frame):
    oaSweepVoices(ctx)              // the pump's turn to drain the queue
    frame[ACTIVE] = live > 0
    frame[VOICES] = live
    frame[PENDING] = ctx.__oaRetire.length
    frame[CACHE_MB] = oaToneCacheBytes() / 1MB
    frame[BUSES] = oaReverbBusCount(ctx) + oaDelayBusCount(ctx) + oaCompStripCount(ctx)
```

`BUSES` used to be `count(ctx.__oaReverbs) + count(ctx.__oaDelays) +
count(ctx.__oaComps)` — which made the file that is supposed to know nothing about
how the effects are built the one file that knew where all three of them keep
their nodes. Each module counts its own now.

The failure that motivated all of the retirement machinery — the app getting
slower and dirtier the longer it ran — was completely invisible while it was
happening. Publishing the numbers through the *same* binary frame as every meter
means a display can show them and the tests can assert on them.

**The whole diagnostic:** if `VOICES` or `PENDING` climbs and does not come back
down while nothing is playing, something is holding on.

---

## 6. Teardown

```
FUNCTION oaDisposeVoices(ctx):
    FOR each source in OA_LIVE_VOICES: stop() then disconnect()
    clear OA_LIVE_VOICES and OA_DRUM_LOOPS
    FOR each queued retirement: disconnect its chain
    empty the queue
```

`stop()` before `disconnect()` matters: a source still running holds its whole
downstream chain alive, so stopping is what actually frees the graph. A looping
pad the user never toggled off is exactly the voice this exists to catch.

---

## 7. The ports this file uses

This is the router, so it is the file with the most reason to reach into other
modules — and therefore the one the rule is really about. Everything it is
allowed to say about another effect:

| Call | Owned by | Answers |
|---|---|---|
| `oaReverbInput(ctx, u)` | `../Reverb/oaReverb.js` | one node to send into (builds the bus on first ask) |
| `oaReverbSend(u, idx)` | `../Reverb/oaReverb.js` | this channel's send level, 0..1 |
| `oaReverbWarm(ctx)` / `oaReverbBusCount(ctx)` | `../Reverb/oaReverb.js` | build what is in use / how many exist |
| `oaDelayInput(ctx, u)`, `oaDelaySend`, `oaDelayWarm`, `oaDelayBusCount` | `../TapeDelay/oaTapeDelay.js` | the same four |
| `oaCompInput(ctx, idx)` | `../Compressor/oaCompressor.js` | a node, or **null** meaning "no compressor here" |
| `oaCompWarm(ctx)` / `oaCompStripCount(ctx)` | `../Compressor/oaCompressor.js` | build every switched-on strip / how many exist |
| `oaDriveNode(ctx, idx, dest, chain)` | `../Drive/oaDrive.js` | a node to play into, or **null** on a clean channel |
| `oaMasterInput(ctx)` / `oaMasterWarm` / `oaMasterBusCount` | `../BussCompressor/oaBussComp.js` | the node the whole mix sums into — **never null**, because everything has to sum somewhere |

Null is a real answer from both optional inserts, which is why the router can
treat the pedal and the compressor identically: *if there is a node, use it;
otherwise carry on to where you were going.*

The master is the exception, and deliberately so. It never returns null: there is
only one of it, everything has to sum somewhere, and the meters and the fade need
it whether or not the compressor is in circuit. So the phrase "carry on to where
you were going" now means the master bus rather than `ctx.destination` — nothing
in the app reaches the output any other way.

What it may **not** say: `ctx.__oaReverbs`, `ctx.__oaDelays`, `ctx.__oaComps`, or
`.input` on anything it did not build. `test/boundary.test.mjs` fails the build
if it does — see *each effect owns its own audio*.

## 8. Where to change things

| You want to… | Touch |
|---|---|
| add a new send destination | the `tap(...)` loops in `oaVoiceOut`, plus a warm-up entry |
| change what "in front of the desk" means | the `drive`/`head` lines at the end of `oaVoiceOut` |
| change the tail grace period | the `+ 0.25` in `oaRetireVoice` |
| add a diagnostic number | extend `layout` and `read` on the `voices` plugin |

Covered by `test/plugins.test.mjs` (`fx bus` suite) and `test/leaks.test.mjs`.
