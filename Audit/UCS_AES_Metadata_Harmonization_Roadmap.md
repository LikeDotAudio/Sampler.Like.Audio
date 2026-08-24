# Architectural Audit & 30-Step Engineering Roadmap: Harmonizing UCS & AES Audio Metadata Standards

## Executive Summary & Scope Audit

This document establishes a technical roadmap to merge the **Universal Category System (UCS v2.1)** with **AES/EBU Audio Metadata Standards** (AES60, AES69, EBU ADM, EBU BWF `bext`, and iXML).

The roadmap operates strictly within the mandates of two primary Audio Engineering Society Standards Committee (AESSC) working groups:
1. **AES SC-03-06 (Digital Library and Archive Systems)**: Content conversion/migration, asset integrity, storage media, preservation formats, and documentation.
2. **AES SC-03-07 (Audio Metadata)**: Cross-protocol metadata coordination, structural requirements, taxonomy harmonization, and inter-organizational standardization (AES, EBU, SMPTE, ISO).

```
+-----------------------------------------------------------------------------------+
|                            UNIVERSAL CATEGORY SYSTEM (UCS)                        |
|       [CatKey] _ [Category] _ [SubCategory] _ [FXName] _ [CreatorID] _ [SourceID] |
+-----------------------------------------------------------------------------------+
                                         |
                                         v  (Harmonization Engine)
+-----------------------------------------------------------------------------------+
|                        AES / EBU METADATA CONTAINER PIPELINE                      |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | BWF bext (3285)  |  | EBU ADM / AES69   |  | iXML / axml     |  | JSON .PEAK | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|               PRESERVATION & DISTRIBUTION (AES SC-03-06 / SC-03-07)                |
|             Archive Integrity | Sample Chopping | Spatial Directivity               |
+-----------------------------------------------------------------------------------+
```

---

## 30-Step Master Implementation Roadmap

### Phase I: Taxonomy Mapping & Data Model Alignment (Steps 1–6)
*Target: SC-03-07 Harmonization & Ontology Mapping*

* **Step 1: Structural Schema Audit**
  Map the UCS 6-part string convention (`[CatKey]_[Category]_[SubCategory]_[FXName]_[CreatorID]_[SourceID]`) directly to XML nodes in the EBU Core (Tech 3293) and iXML schemas.
* **Step 2: UCS-to-AES60 Core Metadata Mapping**
  Map `CatKey` to `AES60:AudioCategory`, `CreatorID` to `AES60:Creator`, and `SourceID` to `AES60:SourceRepository`.
* **Step 3: Define Custom `iXML` UCS Extension Chunk**
  Create an `<iXML><UCS>` schema block containing `<CATKEY>`, `<CATEGORY>`, `<SUBCATEGORY>`, `<USER_CATEGORY>`, and `<VENDOR_ID>`.
* **Step 4: Formulate BWF `bext:CodingHistory` UCS Annotations**
  Standardize `bext:CodingHistory` tokens to log UCS category migrations during archival encoding (`A=PCM,F=44100,W=16,M=STEREO,UCS=MUSC-GENR`).
* **Step 5: EBU ADM Object Classification Linking**
  Link UCS category keys (`VOIC-LYRC`, `DRUM-KICK`, `MUSC-CHRD`) to EBU ADM (Tech 3364) `<audioContent>` and `<audioObject>` labels.
* **Step 6: ID3v2 / MP4 Atom Harmonization**
  Map UCS parameters to ID3 `TKEY`, `TBPM`, `TCON` (Genre), `TXXX:UCS_CATKEY`, and MP4 `©nam` / `©ART` atoms for lossy/lossless distribution compatibility.

---

### Phase II: Preservation & Archival Storage Specification (Steps 7–12)
*Target: SC-03-06 Media Preservation, Content Integrity & Migration*

* **Step 7: Checksum & Cryptographic Integrity Manifests**
  Embed SHA-256 / BLAKE3 hashes into the BWF `axml` chunk alongside UCS category metadata to ensure bit-level integrity during migration.
* **Step 8: Migration Rule Engine for Legacy Codecs**
  Define automated transcoding rules (e.g. `ALAC/m4a` to uncompressed `BWF WAV`) while preserving all embedded UCS tags and `iTunNORM` values.
* **Step 9: High-Density Archival Storage Formatting**
  Specify LTO (Linear Tape-Open) and Cloud Object Storage (S3/POSIX) metadata indexing rules using UCS file basenames.
* **Step 10: Multi-Track Asset Bundling Standard**
  Define multi-channel stem package definitions (`.wav` + `.PEAK` sidecars) conforming to AES SC-03-06 preservation formats.
* **Step 11: Archival Lossless Compression Validation**
  Validate bit-exact reproduction of FLAC and WavPack archives carrying embedded UCS/BWF metadata blocks.
* **Step 12: Historical Versioning & Lineage Tracking**
  Implement `AES60:Derivation` trees inside `.PEAK` sidecars to track parent audio tracks and sliced pad children.

---

### Phase III: Extraction Engine & Automated Tagging (Steps 13–18)
*Target: Rust & Python Core Extractor Integration*

* **Step 13: Rust Extractor Engine (`sample_analyzer_rs`) UCS Integration**
  Equip `sample_analyzer_rs` to output UCS `CatKey` flags based on HPS (Harmonic Product Spectrum) analysis.
* **Step 14: Automated Musical Feature Category Assignment**
  Assign `MUSC-TONE` to single-pitched samples, `DRUM-PERC` to transient-heavy audio, and `VOIC-ACAP` to vocal activity.
* **Step 15: Python CLI (`extract_note_root_beat_map.py`) UCS Metadata Injection**
  Update CLI tool to inject UCS tags directly into exported `.PEAK` sidecars.
* **Step 16: Automated Beat Marker & BPM UCS Classification**
  Annotate rhythmic files (`DRUM-LOOP`, `MUSC-LOOP`) with detected BPM and time signature markers.
* **Step 17: Pitch & Key Detection UCS Metadata Binding**
  Embed fundamental frequency (Hz), cents detune, and root note (`E3`, `G#2`) into UCS-compliant `iXML` blocks.
* **Step 18: Multithreaded Batch Scanner Integration**
  Enable 30-worker parallel scanning of audio libraries to apply UCS categories to unclassified sound files automatically.

---

### Phase IV: Web Engine & UI Integration (`Sampler.Like.Audio`) (Steps 19–24)
*Target: Web Audio API, Sound Browser & Sequencer Harmonization*

* **Step 19: Web UI Sound Browser Category Filter (`SoundBrowser.jsx`)**
  Add UCS category filter chips (`DRUM`, `VOIC`, `MUSC`, `SFX`) to the Sound Browser header.
* **Step 20: Automatic 16-Pad Slicing Category Tagging (`oaChopSongToPads`)**
  Tag sliced drum/note pads automatically with `DRUM-CHOP` or `MUSC-NOTE` metadata.
* **Step 21: Waveform Overlay Display of UCS & AES Tags (`WaveTrim.jsx`)**
  Render UCS category tags alongside beat markers and key root badges directly on the canvas waveform display.
* **Step 22: Drag-and-Drop UCS Inspector (`App.jsx` & `Pad.jsx`)**
  Extract and display UCS categories instantly when dragging external files onto pads or mixer channels.
* **Step 23: Interactive Lyric & Vocal Subtitle Alignment (`MusicChartOverlay.jsx`)**
  Align `VOIC-LYRC` timestamps with speech/vocal Activity Detection (VAD) frames.
* **Step 24: Real-time MQTT/State Synchronization**
  Propagate UCS metadata state changes across pads, mixer channels, and sequencer tracks via `oa-sample-changed`.

---

### Phase V: Harmonization, Interoperability & Standardization (Steps 25–30)
*Target: SC-03-07 Liaison, Schema Validation & Testing*

* **Step 25: JSON Schema & XML DTD Validation Rules**
  Publish official JSON Schema (`ucs_aes_peak_v1.json`) and XML DTDs for validating embedded metadata.
* **Step 26: Cross-Platform DAW Compatibility Suite**
  Verify metadata readability across Pro Tools, Reaper, Soundminer, BaseHead, Cubase, and Web Audio engines.
* **Step 27: Spatial Audio Directivity Mapping (AES69 / SOFA Link)**
  Link UCS categories to 3D spatial directivity profiles (e.g. `SPKR-DIR`, `MIC-3D`).
* **Step 28: EBU R128 Loudness Auto-Gain Staging**
  Apply `-23 LUFS` / `-14 LUFS` normalization gain offsets automatically based on embedded BWF `bext` metadata.
* **Step 29: Unit Test & Regression Suite**
  Incorporate automated boundary tests in `./build.sh` ensuring metadata parsing never degrades audio performance.
* **Step 30: Publish Draft Working Paper for AES SC-03-06 & SC-03-07**
  Format implementation results into a standardized AES recommendation report for joint working group review.
