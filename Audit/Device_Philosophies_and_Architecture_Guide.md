# Device Philosophies & Architectural Guide

**Sampler.Like.Audio** — Written by Anthony P. Kuzub (`i @ Like . audio`)

---

## 1. Core Architectural Philosophy

Every visual representation and DSP unit in `Sampler.Like.Audio` is built as an **homage to classic studio hardware**. The architecture enforces strict engineering principles across all devices in `libControl`:

*   **Zero External Framework Dependency**: DSP audio nodes, worklets, and synthesizers are constructed using native Web Audio API (`AudioContext`).
*   **True Out-Of-Circuit Bypass**: When an effect is bypassed or turned off, it is routed around entirely (`OaOutOfCircuit`), behaving sample-for-sample like a copper wire.
*   **Sample-Rate Independence**: All filters, delay lines, and synthesizers query `window.oaSampleRate(ctx)` dynamically rather than hardcoding sample rates.
*   **Memory Budget Safety**: Buffers, impulse responses, and audio nodes are pooled, reused, and managed within a strict resident memory budget.

---

## 2. Primary Control Devices (`libControl/`)

### 🎛️ 2.1 Pads (`libControl/Pads/`)
*   **Philosophy**: Responsive, low-latency 4x4 trigger matrix inspired by iconic hardware drum samplers (MPC / SP-404).
*   **Capabilities**:
    *   Dynamic sample assign, pitch-shift, reverse playback, and start/end sample trimming.
    *   MIDI velocity sensing and keyboard trigger maps (`QWER ASDF ZXCV`).
    *   Drag-and-drop target for audio files and `.PEAK` JSON sidecars.

### 🎼 2.2 Sequencer (`libControl/Sequencer/`)
*   **Philosophy**: Pattern-based 16-step grid sequencer with hardware-accurate swing and micro-timing.
*   **Capabilities**:
    *   Multi-track step sequence grid linked to the 16 drum pads.
    *   Pattern chaining, song section arrangement, and real-time tempo sync.
    *   Non-blocking high-resolution Web Worker timer clock (`oaClock.js`).

### 🎚️ 2.3 Mixer & Sampler Editor (`libControl/Mixer/`)
*   **Philosophy**: Studio console channel strip interface with embedded waveform editing and peak metering.
*   **Capabilities**:
    *   Per-channel gain, pan, mute, solo, and send controls.
    *   Visual sample waveform viewer with beat marker overlays and note maps.
    *   `🎛️ Chop to 16 Pads` auto-slicing engine.

### 📁 2.4 Sound Browser (`libControl/SoundBrowser/`)
*   **Philosophy**: Seamless media file scanner bridging browser storage, local File System Access API, and remote sample libraries.
*   **Capabilities**:
    *   Container support across `.wav`, `.mp3`, `.m4a`, `.flac`, `.aiff`, `.mp4`, `.mov`, `.webm`.
    *   Instant fallback to pre-loaded sample kits (`01 Track 01.wav`, `02 Track 02.wav`, APK drum kit).
    *   Real-time search filtering and waveform previews.

---

## 3. Multidimensional Audio Lenses & Deep Scanner (`libControl/MusicChart/`)

### 🔭 3.1 Lenses & Scanalyzer View (`LensesView.jsx` / `ScanalyzerView.jsx`)
*   **Philosophy**: Multidimensional inspection of audio content across 6 computational lenses, bridging technical archival standards and musical analysis.
*   **The 6 Lenses**:
    1.  **🔍 UCS Taxonomy**: Configures universal category keys (`[CatKey]_[FXName]_[CreatorID]_[SourceID].wav`).
    2.  **🎵 Pitch & Beats**: Detects fundamental frequency (\(f_0\)), cents detune, root note (`E3`), BPM, and beat grid.
    3.  **🎙️ Lyrics & VAD**: Speech/Vocal Activity Detection timestamps and subtitle alignment.
    4.  **🎚️ EBU R128 Loudness**: Measures Integrated LUFS (-23 LUFS / -14 LUFS target), Max True Peak (dBTP), and LRA.
    5.  **🏛️ AES Preservation**: Cryptographic SHA-256 checksums, BWF `bext` timecode offsets, and version headers.
    6.  **🌐 AES69 3D Spatial**: Spatial audio coordinates (Azimuth \(\phi\), Elevation \(\theta\), Distance \(r\)).
*   **Performance Data Over Time Timeline**: Interactive multi-layer canvas plotting waveform volume envelope, pitch contour (Hz), beat grid lines, and VAD vocal bursts.
*   **Talk & Type Integration**: Voice dictation (`🎤 Dictate`) for lyrics and speech synthesis (`🔊 Read Aloud`) for reading notes and titles.
*   **Import / Export**: `.PEAK` JSON sidecars, `.PERF` performance traces, and `.LRC` subtitle files.

---

## 4. Hardware Homage DSP Effects (`libControl/Effects/`)

### 🎛️ 4.1 VCA Compressor (`oaCompressor.js`)
*   **Philosophy**: Classic VCA peak/RMS compressor modeled after studio rack units.
*   **Parameters**: Threshold, Ratio (1.5:1 to ∞:1), Attack, Release, Makeup Gain, Blend (Dry/Wet).

### 🎚️ 4.2 Master Buss Compressor (`oaBussComp.js`)
*   **Philosophy**: Master buss stereo compressor delivering glue, warmth, and dynamic control.
*   **Parameters**: AUTO release timing program, sidechain high-pass filter, 44K transformer coloration mode, feed-forward vs. feed-back detector topologies.

### 📻 4.3 Drive & Wavefolder (`oaDrive.js`)
*   **Philosophy**: Non-linear tube saturation, tape overdrive, and starve wavefolding distortion.
*   **Parameters**: Drive Gain, Asymmetry, Starve Dead-Zone, Tone Filter.

### 🌀 4.4 Stereo Chorus (`oaChorus.js`)
*   **Philosophy**: Bucket-brigade style analog chorus with dual opposite-phase LFO sweep oscillators.
*   **Parameters**: Rate, Depth, Feedback, Stereo Phase Offset.

### 📼 4.5 Multi-Head Tape Delay (`oaTapeDelay.js`)
*   **Philosophy**: Vintage multi-head tape echo with tempo-grid synchronization and tape saturation in feedback loops.
*   **Parameters**: Time (ms / beat subdivision), Feedback Saturation, Tone, Wow/Flutter.

### 🏛️ 4.6 VARC Digital Reverb (`oaReverb.js`)
*   **Philosophy**: Variable Acoustic Room Synthesizer (VARC) generating finite, decaying rooms (Hall, Plate, Room, Ambient).
*   **Parameters**: Decay Time, Pre-Delay, High-Cut, Low-Cut, Early Reflections.

### 🥁 4.7 Multi-Engine Drum Synthesizer (`oaDrumSynthEngines.js`)
*   **Philosophy**: Discrete analog-modeling synth engines generating kicks, snares, hats, and toms from pure sine waves, noise generators, and pitch envelopes.
*   **Parameters**: Pitch, Decay, Noise Color, Punch, Tone.

---

## 5. Summary & Verification

All devices pass automated unit, integration, and memory isolation boundary tests (`npm test` / `./build.sh`) with **111/111 passing tests**.
