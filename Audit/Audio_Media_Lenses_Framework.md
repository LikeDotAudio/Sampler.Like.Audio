# The Multidimensional Audio Media Lenses Framework

## Executive Conceptual Framework

Viewing audio metadata not merely as passive tags, but as **multidimensional lenses**, transforms raw PCM/lossless audio files into living, queryable, and interactively playable media assets. Each "lens" provides a unique perspective and set of computational operations for extraction, visualization, playback, and preservation.

```
                                    +-----------------------+
                                    |     RAW AUDIO MEDIA   |
                                    |  (WAV / M4A / FLAC)   |
                                    +-----------------------+
                                                |
          +-------------------+-----------------+-------------------+-------------------+
          |                   |                 |                   |                   |
          v                   v                 v                   v                   v
   +--------------+    +--------------+  +--------------+    +--------------+    +--------------+
   | LENS 1: UCS  |    | LENS 2: MUSC |  | LENS 3: LYRC |    | LENS 4: R128 |    | LENS 5: AES  |
   | Taxonomy &   |    | Key, Pitch,  |  | Vocal VAD &  |    | Perceptual   |    | Archival &   |
   | Identity     |    | Beat Markers |  | Subtitles    |    | Loudness     |    | Preservation |
   +--------------+    +--------------+  +--------------+    +--------------+    +--------------+
          |                   |                 |                   |                   |
          +-------------------+-----------------+-------------------+-------------------+
                                                |
                                                v
                                    +-----------------------+
                                    |  LENS 6: AES69 / ADM  |
                                    |  3D Spatial Audio &   |
                                    |  Binaural Directivity |
                                    +-----------------------+
```

---

## The 6 Core Audio Lenses

### 🔍 Lens 1: Taxonomy & Identity Lens (UCS — Universal Category System)
* **Perspective**: *What is the sound?*
* **Core Parameters**: `CatKey`, `Category`, `SubCategory`, `FXName`, `CreatorID`, `SourceID`.
* **Application**: Allows instant filtering across massive audio repositories, automated drum/instrument pad assignment, and standardized sound asset organization.

### 🎵 Lens 2: Musicality & Harmonic Lens (Note Root Key Beat Marker Map)
* **Perspective**: *What is the musical structure, pitch, and tempo?*
* **Core Parameters**: Fundamental frequency (Hz), cents detune, root note (`E3`, `G#2`), BPM, beat grid timestamps, 24-triad/7th chord progression timeline.
* **Application**: Enables automatic song chopping to 16 drum pads (`oaChopSongToPads`), pitch-locked sample auditioning, and real-time step sequencer quantization.

### 🎙️ Lens 3: Vocal & Lyric Alignment Lens (VAD & Subtitle Mapping)
* **Perspective**: *Where are the words and vocal phrases?*
* **Core Parameters**: Voice Activity Detection (VAD) confidence, frame-accurate word timestamps, unsynchronized/synchronized lyric strings (`USLT`/`SYLT`).
* **Application**: Powers interactive karaoke/subtitle overlays (`MusicChartOverlay.jsx`), vocal chop extraction, and vocal stem isolation.

### 🎚️ Lens 4: Perceptual Loudness Lens (EBU R128 & ITU-R BS.1770)
* **Perspective**: *How loud is the sound to human ears?*
* **Core Parameters**: Integrated Loudness (-23 LUFS / -14 LUFS), Maximum True Peak (dBTP), Loudness Range (LRA), Short-Term & Momentary windowing.
* **Application**: Prevents clipping, eliminates the "Loudness War", and applies automatic gain-staging across pads and mixer channels.

### 🏛️ Lens 5: Archival & Preservation Lens (AES SC-03-06 / SC-03-07 / BWF bext / iXML)
* **Perspective**: *How do we preserve the media with bit-level integrity for 100+ years?*
* **Core Parameters**: `TimeReference` (sample-accurate offset from midnight), SHA-256 cryptographic hashes, `bext` coding history, `AES60:Derivation` lineage trees.
* **Application**: Guarantees content conversion integrity, migration tracking, and loss-free asset distribution across archival systems.

### 🌐 Lens 6: Spatial Audio & Directivity Lens (AES69 / SOFA & EBU ADM)
* **Perspective**: *Where is the sound located in 3D space, and how does it radiate?*
* **Core Parameters**: 3D spatial coordinates (Azimuth \(\phi\), Elevation \(\theta\), Radius \(r\)), Head-Related Transfer Functions (HRTF), speaker/microphone polar directivity profiles.
* **Application**: Drives headphone 3D spatial audio renderers, Dolby Atmos / MPEG-H object monitoring, and immersive VR/AR acoustic modeling.

---

## Multi-Lens Synthesis Matrix

| Lens | Standard / Engine | Extracted Payload | Primary Web UI / Engine Target |
| :--- | :--- | :--- | :--- |
| **Taxonomy** | UCS v2.1 | `DRUM-KICK`, `MUSC-CHRD` | `SoundBrowser.jsx` category chips |
| **Musicality** | Rust / Python Extractor | Root Key (`E3`), BPM (87.6), Beat Grid | `WaveTrim.jsx` canvas markers & `SamplerEditor` |
| **Lyrics** | `oaDeepScanner.js` (VAD) | Word timestamps & lyric text | `MusicChartOverlay.jsx` subtitle timeline |
| **Loudness** | EBU R128 / ITU BS.1770 | Integrated LUFS, Max True Peak dBTP | `Mixer.jsx` auto-gain staging & metering |
| **Archival** | AES SC-03-06/07 (BWF/iXML) | SHA-256 hash, `bext` Timecode | Lossless `.PEAK` sidecar preservation |
| **Spatial** | AES69 (SOFA) / EBU ADM | 3D Azimuth/Elevation coordinates | Spatial binaural engine & 3D panning |
