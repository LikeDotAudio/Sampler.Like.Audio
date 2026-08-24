# Comprehensive Technical Report: EBU Audio Standards & Metadata Formats

## Executive Summary

The **European Broadcasting Union (EBU)** maintains the foundational standards governing digital audio production, broadcasting, spatial audio rendering, and archival metadata. From the universal **Broadcast Wave Format (BWF)** to **EBU R128 Loudness Normalization** and the **Audio Definition Model (ADM)** for Next Generation Audio (NGA), EBU standards bridge physical media encoding with semantic metadata and perceptual signal processing.

This report provides an in-depth technical examination of the four core EBU audio specifications:
1. **EBU BWF (Tech 3285)** — Broadcast Wave File Format & Headers
2. **EBU R128 (Tech 3341/3342)** — Loudness Metering & Normalization
3. **EBU ADM (Tech 3364)** — Audio Definition Model for Immersive 3D Audio
4. **EBU Core (Tech 3293)** — Semantic Media Metadata Ontology

---

## 1. EBU BWF: Broadcast Wave Format (EBU Tech 3285)

### 1.1 Overview & Architecture
Broadcast Wave Format (BWF) is an extension of the Microsoft RIFF WAVE specification (`.wav`). BWF introduces dedicated metadata chunks to store sample-accurate timecode offsets, production notes, originator details, and loudness metrics directly within the audio binary header without altering PCM audio data compatibility.

```
+-------------------------------------------------------------------+
|  RIFF Header ("RIFF" / "WAVE")                                    |
+-------------------------------------------------------------------+
|  Format Chunk ("fmt ") - Sample rate, bit depth, channel count   |
+-------------------------------------------------------------------+
|  Broadcast Extension Chunk ("bext") <--- EBU Tech 3285 Core       |
+-------------------------------------------------------------------+
|  XML Metadata Chunk ("iXML" / "axml")                             |
+-------------------------------------------------------------------+
|  Audio Data Chunk ("data") - Linear PCM or MPEG Audio Payload     |
+-------------------------------------------------------------------+
```

### 1.2 The `bext` (Broadcast Extension) Chunk Structure

The `bext` chunk is a 602+ byte binary structure inserted prior to the audio PCM payload:

| Field Name | Size (Bytes) | Data Type | Description |
| :--- | :---: | :--- | :--- |
| `Description` | 256 | ASCII | Free-text scene / track description |
| `Originator` | 32 | ASCII | Producer / Sound recordist / Software name |
| `OriginatorReference` | 32 | ASCII | Unique reference ID / Serial number |
| `OriginationDate` | 10 | ASCII | `YYYY-MM-DD` date stamp |
| `OriginationTime` | 8 | ASCII | `HH:MM:SS` time stamp |
| `TimeReferenceLow` | 4 | uint32 | Low 32-bits of sample count since midnight |
| `TimeReferenceHigh` | 4 | uint32 | High 32-bits of sample count since midnight |
| `Version` | 2 | uint16 | BWF version indicator (v0, v1, v2) |
| `UMID` | 64 | binary | SMPTE ST 330 Unique Material Identifier |
| `LoudnessValue` | 2 | int16 | Integrated Loudness in LUFS \(\times 100\) (v2) |
| `LoudnessRange` | 2 | int16 | Loudness Range (LRA) in LU \(\times 100\) (v2) |
| `MaxTruePeakLevel` | 2 | int16 | Max True Peak in dBTP \(\times 100\) (v2) |
| `Reserved` | 180 | binary | Future expansion padding |
| `CodingHistory` | Variable | ASCII | Free-form coding history string (`A=PCM,F=44100,W=24...`) |

> [!NOTE]
> `TimeReference` stores the exact 64-bit integer sample offset from midnight. For a 48 kHz recording starting at 01:00:00.000, `TimeReference` equals \(1 \times 3600 \times 48000 = 172,800,000\) samples.

---

## 2. EBU R128: Loudness Normalization & Metering

### 2.1 The Paradigm Shift
Historically, audio normalization relied on **Peak Metering (PPM/Quasi-Peak)**, which measured absolute electrical voltage spikes. Peak metering ignored human perceptual audition and led to the "Loudness War" — heavy dynamic compression resulting in listener fatigue.

**EBU R128** introduced **Perceived Loudness Normalization**, measuring energy integrated across a frequency-weighted filter network (**K-Weighting**).

### 2.2 K-Weighting Filter & Signal Pipeline

```mermaid
graph LR
    Input["Input Audio Ch i"] --> PreFilter["Stage 1: High-Shelf Filter (+4 dB @ 1.5 kHz)"]
    PreFilter --> RLBFilter["Stage 2: High-Pass Filter (RLB Cut @ 38 Hz)"]
    RLBFilter --> MeanSquare["Mean Square Integration (Window T)"]
    MeanSquare --> ChannelWeight["Channel Weighting (z_i)"]
    ChannelWeight --> Summation["Summation & Log Scale (LUFS)"]
```

1. **Stage 1 (Pre-Filter)**: High-shelf filter boosting frequencies above 1.5 kHz to simulate acoustic head-shadowing.
2. **Stage 2 (RLB Filter)**: Revised Low-frequency B-weighting high-pass filter rolling off below 38 Hz.
3. **Channel Weighting**: Left (\(L=1.0\)), Right (\(R=1.0\)), Center (\(C=1.0\)), Left Surround (\(Ls=1.41\)), Right Surround (\(Rs=1.41\)), LFE (\(0.0\)).

### 2.3 Key Parameters & Target Specifications

$$\text{Loudness (LUFS)} = -0.691 + 10 \log_{10} \left( \sum_{i} w_i \cdot z_i \right)$$

| Parameter | EBU R128 Target | Commercial Streaming Target |
| :--- | :--- | :--- |
| **Integrated Loudness ($I$)** | **-23.0 LUFS** ($\pm 0.5\text{ LU}$) | **-14.0 LUFS** (Spotify/Apple/YouTube) |
| **Maximum True Peak ($S_{TP}$)** | **-1.0 dBTP** | **-1.0 to -2.0 dBTP** |
| **Loudness Range ($LRA$)** | Program Dependent (Typically 4–12 LU) | 5–10 LU |
| **Short-Term Window ($S$)** | 3.0 Seconds (un-gated) | 3.0 Seconds |
| **Momentary Window ($M$)** | 400 Milliseconds (un-gated) | 400 Milliseconds |

---

## 3. EBU ADM: Audio Definition Model (EBU Tech 3364)

### 3.1 Overview
The **Audio Definition Model (ADM)** is a standardized XML metadata schema used to describe **Next Generation Audio (NGA)** formats, including object-based 3D audio, multi-channel beds, higher-order Ambisonics (HOA), and direct speakers.

### 3.2 ADM Hierarchy Model

```
+-------------------------------------------------------------------+
|  audioProject                                                     |
+-------------------------------------------------------------------+
  |
  +--> audioProgramme (e.g., "English Feature Film")
        |
        +--> audioContent (e.g., "Dialogue", "Music", "SFX")
              |
              +--> audioObject (e.g., "Lead Actor Voice Object")
                    |
                    +--> audioTrackUID (Links metadata to BWF PCM track)
                    |
                    +--> audioPackFormat (e.g., 3D Object Grouping)
                          |
                          +--> audioChannelFormat (3D Coordinates)
                                |
                                +--> audioBlockFormat (Time-varying X,Y,Z)
```

### 3.3 Example ADM XML Payload (`axml` Chunk in BWF)

```xml
<admCode xmlns="http://www.ebu.ch/metadata/schemas/adm">
  <audioProgramme audioProgrammeID="APR_1001" audioProgrammeName="3D Film Mix">
    <audioContentIDRef>ACO_1001</audioContentIDRef>
  </audioProgramme>
  <audioContent audioContentID="ACO_1001" audioContentName="Dialogue">
    <audioObjectIDRef>AOB_1001</audioObjectIDRef>
  </audioContent>
  <audioObject audioObjectID="AOB_1001" audioObjectName="Vocal Object 1">
    <audioTrackUIDRef>ATU_00000001</audioTrackUIDRef>
    <audioPackFormatIDRef>APK_1001</audioPackFormatIDRef>
  </audioObject>
  <audioChannelFormat audioChannelID="ACH_1001" typeDefinition="Objects">
    <audioBlockFormat blockID="ABF_0001" lfeCell="0">
      <outputChannelIDRef>ACH_1001</outputChannelIDRef>
      <position coordinate="azimuth">30.0</position>
      <position coordinate="elevation">15.0</position>
      <position coordinate="distance">1.0</position>
      <gain>1.0</gain>
    </audioBlockFormat>
  </audioChannelFormat>
</admCode>
```

---

## 4. EBU Core: Semantic Media Metadata Ontology (EBU Tech 3293)

**EBU Core** is a metadata set based on Dublin Core, designed for TV/Radio broadcasters, digital archives, and Media Asset Management (MAM) systems.

### 4.1 Core Metadata Categories
- **Identification**: Material Identifiers, ISAN, EIDR, ISRC, UMID.
- **Title & Description**: Series, Episode, Scene, Cut, Key Frame descriptions.
- **Publication & Rights**: Broadcast windows, geoblocking, copyright holder info.
- **Technical Attributes**: Codec, aspect ratio, frame rate, sample rate, bit depth, loudness profiles.

---

## 5. Summary Matrix of EBU Audio Specifications

| Standard | Full Reference | Primary Function | Key Output |
| :--- | :--- | :--- | :--- |
| **BWF** | EBU Tech 3285 | Audio File Container & Header | `.wav` with `bext` timecode & production metadata |
| **EBU R128** | EBU Tech 3341 / 3342 | Loudness Measurement & Normalization | -23 LUFS Target, -1 dBTP ceiling, LUFS/LRA metrics |
| **EBU ADM** | EBU Tech 3364 | Immersive 3D / Object-Based Audio | XML metadata (`axml`) encoding 3D audio trajectories |
| **EBU Core** | EBU Tech 3293 | Broadcast MAM Semantic Ontology | XML/RDF schema for asset archival & cataloging |
