# Changelog - Sampler.Like.Audio

All notable changes to the Sampler.Like.Audio software, extractor engine, and music chart deep scanner will be documented in this file.

## [Unreleased] - 2026-08-24

### Added
- **Note, Root Key & Beat Marker Map Extractor (Rust & Python)**:
  - Added `NoteRootKeyBeatMarkerMap`, `BeatMarker`, and `ChunkNoteMap` data structures in `sample_analyzer_rs/src/Core/peak.rs`.
  - Implemented chunk-by-chunk analysis module (`sample_analyzer_rs/src/Scananalyzers/Musical/note_map.rs`) for detecting fundamental frequencies, root notes, pitch (Hz), cents offset, peak amplitudes, and beat markers.
  - Embedded `note_root_key_beat_marker_map` into aggregate `.PEAK` sidecar outputs.
  - Added standalone CLI tool `extract_note_root_beat_map.py` for extracting note maps and sidecars from `.m4a`, `.wav`, and `.mp3` audio files.

- **Music Chart & Lyric Deep Scan Engine (`oaDeepScanner.js`)**:
  - Implemented structural section chunking (Intro, Verse 1, Chorus 1, Verse 2, Chorus 2, Bridge, Solo, Outro).
  - Implemented 12-bin chromagram extraction and 24-template major/minor/7th chord progression detection.
  - Implemented Voice Activity Detection (VAD) vocal timestamp and lyric alignment map.
  - Added `oaChopSongToPads` for slicing master audio tracks onto Pads 1..16 (`OA_DRUM_SAMPLES`) as playable sample banks.

- **Interactive Music Chart UI (`MusicChartOverlay.jsx` & `WaveTrim.jsx`)**:
  - Added visual beat marker overlays (downbeats & quarter beats) and root note tags directly onto the waveform display.
  - Added multi-tab Music Chart Overlay (*Chart Timeline*, *Notes & Pitch*, *Lyrics & Vocals*) to `SamplerEditor.jsx`.
  - Added interactive `🎛️ Chop to 16 Pads` button to auto-slice song sections onto triggerable drum pads.

- **Platform-Wide Drag & Drop Support (`App.jsx`, `Pad.jsx`, `SeqTrack.jsx`, `Mixer.jsx`, `SoundBrowser.jsx`)**:
  - Added full-screen visual dropzone overlay (`📥 Drop Audio File Anywhere to Load, Scan & Slice`).
  - Added per-component drag-and-drop handling across 4x4 drum pads, step sequencer track rows, Sound Browser grid, and Mixer channel strips.
  - Added support for dropping `.PEAK` JSON sidecar files alongside or independent of audio/video media files.

- **Scanalyzer Multi-Lens Inspector & Exporter (`ScanalyzerView.jsx`)**:
  - Implemented 6-lens inspection panel: *UCS Taxonomy*, *Pitch & Beats*, *Lyrics VAD*, *EBU R128 Loudness*, *AES Preservation*, and *AES69 3D Spatial Audio*.
  - Added **Talk & Type** Speech Dictation (`webkitSpeechRecognition`) for typing lyrics and UCS category keys by voice.
  - Added Speech Synthesis Read Aloud (`speechSynthesis`) to speak pitch notes, UCS basenames, and lyric text.
  - Added `.PEAK` JSON sidecar and `.LRC` timestamped lyric import and export capabilities.

- **Automated Scanalyzer Media Processing**:
  - Dropping any audio/video media file (`.wav`, `.m4a`, `.mp3`, `.flac`, `.mp4`, `.mov`, `.webm`, `.aiff`) automatically decodes the track, runs `oaDeepScanAudio`, populates the 6 lenses, and chops the song into 16 pads.

- **Expanded Media Container Recognition & Sound Browser Fallback Fix**:
  - Expanded `AUDIO_RE` scanner regex across `SoundBrowser.jsx`, `useSoundBrowseState.js`, `gatherAll.js`, and `gatherMatching.js` to recognize video containers (`.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`, `.m4v`, `.3gp`, `.flv`).
  - Added automatic fallback in `useSoundBrowseState.js` to immediately populate `01 Track 01.wav`, `02 Track 02.wav`, and drum kit samples in the Sound Browser grid when no local folder has been selected yet.

- **Standards Documentation & Engineering Roadmaps**:
  - Created `EBU_Audio_Standards_and_Formats_Report.md` detailing EBU R128, EBU BWF (Tech 3285), EBU ADM (Tech 3364), and EBU Core (Tech 3293).
  - Created `UCS_AES_Metadata_Harmonization_Roadmap.md` establishing a 30-step architectural roadmap for AES SC-03-06 (Digital Library & Archive Systems) and AES SC-03-07 (Audio Metadata).
  - Created `Audio_Media_Lenses_Framework.md` defining the 6 multidimensional audio metadata lenses.

- **`🔭 LENSES` Primary Header Tab (`Header.jsx`, `App.jsx`)**:
  - Promoted and registered **`🔭 LENSES`** as a top-level primary navigation tab in the main application header alongside `PADS`, `SEQ`, `SONG`, `EDITOR`, and `MIXER`.

- **Multidimensional Audio Lenses Component (`LensesView.jsx`)**:
  - Created standalone `LensesView` inspector component presenting 6 multidimensional metadata lenses: *UCS Taxonomy*, *Pitch & Beats*, *Lyrics VAD*, *EBU R128 Loudness*, *AES Archival Preservation*, and *AES69 3D Spatial Audio*.

- **Interactive Performance Data Over Time Timeline (`LensesView.jsx`)**:
  - Rendered a multi-layer performance timeline canvas showing 4 real-time curves over time: Waveform Peak Envelope, Pitch Contour (Hz), Beat Grid Markers, and Vocal VAD Subtitle Bursts.
  - Added interactive timeline click scrubbing to seek audio playback (`window.oaSeekAudio`).
  - Added **`📊 Export .PERF JSON`** to export time-series telemetry performance traces.

### Fixed & Tested
- Passed full Web Audio test suite (111/111 tests) and verified bundle compilation in `dist/app.js`.
