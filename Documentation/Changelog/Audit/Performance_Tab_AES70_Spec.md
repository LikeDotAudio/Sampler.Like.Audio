# Sampler.Like.Audio — Performance Tab & Performance Extractor Specification (AES70 / OCA Architecture)

## 1. Executive Summary: Live Song Performance via Performance Extractor
The **Performance Extractor** inside **Sampler.Like.Audio** makes it possible to take any full audio composition or song, automatically extract its structural components into **10 Resistor-Color-Coded Slices (Chunks 1–10 / Digits 0–9)**, and **re-play, re-arrange, and perform the song live** across tactile pads, chromatic keys, and AES70 control surfaces.

By unifying real-time Audio Feature Extraction with **The Big Eye in the Center** (Space, Time, Meaning) and outgoing MIDI/AES70 streams, the sampler acts not just as a static playback engine, but as an interactive **Song Performance Instrument**.

---

## 2. Interface Architecture: The 4-Quadrant Visual Stage

```
+-----------------------------------------------------------------------------------+
|               TOP LEFT: SPACE              |           TOP RIGHT: TIME            |
|          (3D Spatial Visualization)        |       (Time Domain & Clock Sync)     |
|    * EBU ADM 3D Spatial Orbit & Panning    |   * AES31 ADL Clock & Time Markers   |
+--------------------------------------------+--------------------------------------+
|                                                                                   |
|                           (( THE BIG EYE IN THE CENTER ))                         |
|                       * Central Pupil & Iris Telemetry Eye                        |
|                       * Color-Coded Resistor Focus Iris                           |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                           BOTTOM: MEANING (HORIZONTAL WAVEFORM)                   |
|  [1:BLK] [2:BRN] [3:RED] [4:ORG] [5:YEL] [6:GRN] [7:BLU] [8:VIO] [9:GRY] [10:WHT]  |
|  ~~~~/\/\/\/\-------------------|---/\/\/\------------------------/\/\/\/\~~~~~~  |
|  * 10 Resistor Color-Coded Waveform Slices & Overlayed AES60/iXML Metadata        |
+-----------------------------------------------------------------------------------+
|                   PLAYABLE RESISTOR COLOR CHUNK PADS (CHUNKS 1-10)                |
|  [ 1 BLACK ] [ 2 BROWN ] [ 3 RED ] [ 4 ORANGE ] [ 5 YELLOW ] ... [ 10 WHITE ]     |
+-----------------------------------------------------------------------------------+
|                     OUTGOING MIDI & AES70 TELEMETRY BUS                           |
|  * Note On/Off (C1-C2) | CC 80 Sample Start | CC 74 Filter Cutoff | LUFS / Freq Out |
+-----------------------------------------------------------------------------------+
```

---

## 3. Resistor Color Code Chunk Mapping (Digits 0–9)

The 10 extracted song chunks are color-coded using the standard electronic resistor color code sequence:

| Chunk | Color Code | Hex Code | Digit | Song Component Example |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Black** | `#1C1917` | 0 | Song Intro / Count-in Transient |
| **2** | **Brown** | `#854D0E` | 1 | Main Drum Groove / Kick-Snare |
| **3** | **Red** | `#DC2626` | 2 | Bassline Drop / Sub Frequency |
| **4** | **Orange** | `#EA580C` | 3 | Vocal Chop / Hook Segment |
| **5** | **Yellow** | `#CA8A04` | 4 | Synth Riff / Chord Stabs |
| **6** | **Green** | `#16A34A` | 5 | Percussion Fill / Shaker Loop |
| **7** | **Blue** | `#2563EB` | 6 | Bridge / Transition FX |
| **8** | **Violet** | `#9333EA` | 7 | Solo / Harmonic Counter-Melody |
| **9** | **Grey** | `#52525B` | 8 | Breakdown / Filtered Drop |
| **10** | **White** | `#F8FAFC` | 9 | Outro / Reverb Tail |

---

## 4. Live Song Performance Mechanics

1. **Instant Song Slice Import & Extraction**:
   - The Audio Extractor parses a full track, performing zero-crossing detection and transient analysis to slice the song into 10 musical chunks (Chunks 1–10).
2. **Real-Time Re-Arrangement on Pads & Keys**:
   - Striking Chunk Pads 1–10 or triggering keys C1–C2 instantly plays the corresponding song segment, moving the Meaning Waveform playhead in real time.
3. **Continuous Performance Modulation**:
   - Binds **Note Repeat**, **16 Levels**, and **Flex Beat FX Drops** (Tape Stop, 12-Bit Bitcrush, Stutter, Reverse Drop) to live performance triggers.
4. **Bi-Directional MIDI & AES70 Network Broadcast**:
   - As the song is played, outgoing MIDI streams (Note On/Off, CC 80 Offset, CC 74 Cutoff, Aftertouch) and AES70 OCA objects (`OcaMatrix`, `OcaGain`) broadcast live performance telemetry to external hardware synths, mixers, and visual engines.

---
*Sampler.Like.Audio — Performance Extractor & Song Performance Specification.*
