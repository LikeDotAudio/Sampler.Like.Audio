/**
 * Header: DrumKit.js
 * Purpose: Shared 16-voice drum kit for the Sampler + Sequencer.
 * Description: Single source of truth for the drum-sound names/voices so the
 *   Sampler pads and the Sequencer tracks are the SAME kit. Also provides a
 *   shared AudioContext and a shared sample store, so a sample loaded on a
 *   Sampler pad is played by the Sequencer for that track too.
 *
 * Plain JS (not JSX) so it runs before the text/babel component scripts and
 * window.OA_DRUM_KIT is ready when they execute.
 *
 * Version: 26.07.11.1
 */

// Every voice the kit can offer: name + synth pitch (Hz) + oscillator type
// (used when no sample is loaded). The first 16 are the original 4 × 4 kit; the
// rest fill out a 5 × 5. Pad index === Sequencer track index === key into
// OA_DRUM_SAMPLES.
window.OA_DRUM_VOICES = [
    { name: 'Kick',    freq: 60,   type: 'sine' },
    { name: 'Snare',   freq: 200,  type: 'sine' },
    { name: 'Hi-Hat',  freq: 800,  type: 'square' },
    { name: 'Perc',    freq: 400,  type: 'sine' },
    { name: 'Clap',    freq: 300,  type: 'square' },
    { name: 'Rim',     freq: 1000, type: 'square' },
    { name: 'Tom Lo',  freq: 100,  type: 'sine' },
    { name: 'Tom Mid', freq: 150,  type: 'sine' },
    { name: 'Tom Hi',  freq: 250,  type: 'sine' },
    { name: 'Cymbal',  freq: 1200, type: 'square' },
    { name: 'Ride',    freq: 900,  type: 'square' },
    { name: 'Cowbell', freq: 540,  type: 'square' },
    { name: 'Conga',   freq: 350,  type: 'sine' },
    { name: 'Clave',   freq: 1100, type: 'sine' },
    { name: 'Shaker',  freq: 1500, type: 'square' },
    { name: 'FX',      freq: 700,  type: 'sawtooth' },
    // 5 × 5 adds a second kick and snare, the open hat the 4 × 4 had no room
    // for, a floor tom, and the metal and hand percussion to go with them.
    { name: 'Kick 2',  freq: 70,   type: 'sine' },
    { name: 'Snare 2', freq: 240,  type: 'sine' },
    { name: 'Open Hat',freq: 850,  type: 'square' },
    { name: 'Tom Fl',  freq: 80,   type: 'sine' },
    { name: 'Crash',   freq: 1300, type: 'square' },
    { name: 'Splash',  freq: 1600, type: 'square' },
    { name: 'Block',   freq: 1150, type: 'square' },
    { name: 'Triangle',freq: 1100, type: 'sine' },
    { name: 'Bongo',   freq: 520,  type: 'sine' },
];

// The live kit, cut to the current grid. MUTATED in place rather than replaced —
// several modules read it once at load time, and they all have to see the same
// array change size.
window.OA_DRUM_KIT = window.OA_DRUM_KIT || [];

window.oaBuildDrumKit = function () {
    const kit = window.OA_DRUM_KIT;
    const n = window.OA_PAD_COUNT;
    kit.length = 0;
    for (let i = 0; i < n; i++) {
        // Past the named voices a pad still needs a name and a pitch; carry on
        // up the list an octave at a time.
        const v = window.OA_DRUM_VOICES[i % window.OA_DRUM_VOICES.length];
        const lap = Math.floor(i / window.OA_DRUM_VOICES.length);
        kit.push(lap === 0 ? Object.assign({}, v)
                           : { name: `${v.name} ${lap + 1}`, freq: v.freq * Math.pow(2, lap), type: v.type });
    }
    return kit;
};
window.oaBuildDrumKit();

// Shared AudioContext so buffers decoded by the Sampler play in the Sequencer.
window.oaAudioCtx = function () {
    if (!window.OA_AUDIO_CTX) {
        // Through oaNewAudioContext(), which asks for OA_SAMPLE_RATE and — if
        // the browser refuses it — adopts whatever the device gave instead, so
        // every offline render in the app follows the live rate rather than a
        // constant that turned out not to be true. See oaAudioRate.js.
        window.OA_AUDIO_CTX = window.oaNewAudioContext();
    }
    if (window.OA_AUDIO_CTX.state === 'suspended') {
        // Best-effort resume (browsers gate audio until a user gesture).
        try { window.OA_AUDIO_CTX.resume(); } catch (e) {}
    }
    // The tape delays run in an AudioWorklet, which has to be fetched and
    // registered before a node can exist. Kick that off the moment there is a
    // context, so it is ready long before the first hit.
    if (window.oaWarmFx && !window.OA_AUDIO_CTX.__oaWarmed) {
        window.OA_AUDIO_CTX.__oaWarmed = true;
        try { window.oaWarmFx(window.OA_AUDIO_CTX).catch(() => {}); } catch (e) {}
    }
    return window.OA_AUDIO_CTX;
};

// index -> sample ENTRY { buffer, pitch, loop, fade, name }. Populated by the
// Sampler / AudioEditor, read by both the Sampler pads and the Sequencer.
window.OA_DRUM_SAMPLES = window.OA_DRUM_SAMPLES || {};
// index -> currently-playing looping BufferSource (for auto-loop toggle pads).
window.OA_DRUM_LOOPS = window.OA_DRUM_LOOPS || {};

// Every currently-sounding BufferSource, for live MIDI pitch-bend.
//
// THIS USED TO BE CALLED OA_DRUM_VOICES, which is the name of the kit voice
// table thirty lines above. `window.OA_DRUM_VOICES = window.OA_DRUM_VOICES || []`
// therefore did nothing at all — the table was already truthy — and every
// sounding BufferSource was pushed onto the KIT DEFINITION. Two things went
// wrong and neither announced itself: oaBuildDrumKit() indexes that table with
// `i % length`, so rebuilding the grid while anything was ringing handed pads a
// BufferSource in place of a voice spec (no .name, no .freq); and the array is
// the app's only strong reference to a playing source, so it is exactly where a
// voice that never fires 'ended' piles up. Separate names, separate arrays.
window.OA_LIVE_VOICES = window.OA_LIVE_VOICES || [];
window.OA_PITCH_BEND = window.OA_PITCH_BEND || 0;

// Pre-rendered pitched buffers for Tone Mode (avoids real-time resampling
// latency). rootIdx -> { semitones -> AudioBuffer }. See oaDrumkitSynth.js for
// the budget that keeps this from eating the machine.
window.OA_TONE_CACHE = window.OA_TONE_CACHE || {};

// Set the global pitch-bend (cents) and retune every sounding voice live.
window.oaSetPitchBend = function (cents) {
    window.OA_PITCH_BEND = cents || 0;
    for (let i = 0; i < window.OA_LIVE_VOICES.length; i++) {
        const s = window.OA_LIVE_VOICES[i];
        try { if (s.detune) s.detune.value = window.OA_PITCH_BEND; } catch (e) {}
    }
};

// Store/replace a pad's sample. opts: { loop, pitch, fade, name }.
window.oaSetDrumSample = function (idx, buffer, opts) {
    opts = opts || {};
    let sampleRoot = null;
    const name = opts.name || '';
    const m = /ROOT-(\d+)/i.exec(name);
    if (m) sampleRoot = parseInt(m[1], 10);
    
    const entry = {
        idx: idx,                   // so a played copy can find its reverb send
        buffer: buffer,
        pitch: opts.pitch || 1,     // playbackRate multiplier (pitch + speed)
        sampleRoot: sampleRoot,     // MIDI note root parsed from filename
        offset: opts.offset || 0,   // start offset in seconds (time shift)
        end: (opts.end != null ? opts.end : null),   // cut-off in seconds (null = EOF)
        loop: !!opts.loop,
        fade: !!opts.fade,
        name: name,
        folder: opts.folder || '',  // source folder (for set snapshots / revert)
    };
    // The pad's old sample is gone, so every pre-rendered pitch of it is dead
    // weight — and worse than dead, because oaTriggerTone reads the cache FIRST
    // and would go on playing the sample that used to be here. Drop it before
    // the new entry lands.
    if (window.oaEvictToneCache) window.oaEvictToneCache(idx);

    window.OA_DRUM_SAMPLES[idx] = entry;
    if (window.oaPrecachePad) window.oaPrecachePad(entry);
    // A loaded sample takes over from the synth voice — the Mixer hides SYNTH.
    window.dispatchEvent(new CustomEvent('oa-sample-changed', { detail: { idx: idx } }));
};

// Patch an existing pad's options (pitch/loop/fade) without re-decoding.
window.oaUpdateDrumSample = function (idx, patch) {
    const e = window.OA_DRUM_SAMPLES[idx];
    if (e) {
        const oldPitch = e.pitch || 1;
        Object.assign(e, patch || {});
        if (e.pitch !== oldPitch || !e.cachedBuffer) {
            // Every tone-mode render was baked at the OLD base pitch, so they
            // are all the wrong speed now. Same reasoning as a sample swap.
            if (e.pitch !== oldPitch && window.oaEvictToneCache) window.oaEvictToneCache(idx);
            if (window.oaPrecachePad) window.oaPrecachePad(e);
        }
    }
};


