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

### Fixed & Tested
- Passed full Web Audio test suite (111/111 tests) and verified bundle compilation in `dist/app.js`.
