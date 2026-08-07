# Web Sampler & Sequencer

A fully-featured, standalone, open-source drum sampler and sequencer that runs entirely in your web browser. 

Designed to mimic the classic 16-pad sampler workflow, this project leverages modern web APIs to deliver a professional music production experience without needing any backend server, installation, or build tools. Just open `index.html` and start making beats.

## Features

- **Standalone Execution**: Zero dependencies. No Node.js, no Webpack, no server required. The app is entirely static HTML, CSS, and client-side JavaScript, running React natively in the browser via standalone Babel.
- **Classic Drum Pads**: A classic 4x4 pad layout of 16 voices, switchable to 5x5 / 25 in the ⚙ Config panel — the pad grid, the mixer channels and the sequencer tracks all resize together. Supports velocity sensitivity (center vs. edge click) and triggers realistic glow animations.
- **Advanced Step Sequencer**: A multi-track sequencer offering granular control over step velocity, per-track volume/pan/pitch, and swing (shuffle). Pattern options include 4, 8, 16, 32, and 64 steps.
- **Local File System Integration**: Utilizes the modern **File System Access API** (Chromium-based browsers) to let you select a local folder of samples. It recursively scans your files and builds a visual, searchable thumbnail grid directly in the browser—without uploading any of your files to a server.
- **Broad Audio Format Support**: Easily loads and decodes WAV, MP3, OGG, FLAC, and AAC files via the native Web Audio API. Also includes a custom pure-JavaScript AIFF/AIFC decoder for classic sample libraries.
- **Web MIDI Support**: Plug in any class-compliant USB MIDI controller (any class-compliant pad controller) and start finger-drumming immediately. The app automatically maps incoming MIDI notes to the pads and captures velocity data.
- **Offline Persistence**: Drum kit presets, sequencer patterns, and favored samples are saved locally in the browser using `localStorage` and `IndexedDB`.
- **Tone Mode (Chromatic Pitching)**: Hold `CTRL` and click a pad to enter Tone Mode, mapping a single sample chromatically across every pad to play melodies and basslines.
- **A Full Effects Rack**: Every channel has a distortion pedal (overdrive, tube, fuzz, transistor starve and an octave-up rectifier) in front of the fader and a FET limiting amplifier after it, and feeds two convolution reverbs and four tape-echo delays. Everything sums into a master bus with a console-style VCA buss compressor across it — negative ratios, a two-stage auto release, a side-chain filter and a timed console fade.
- **Mixer Sends**: The delays are tape-echo models — a circular buffer as the tape, two stereo playback heads, wow and flutter from an LFO on the head spacing, and tape saturation folded into the feedback. Each head can be dialled in milliseconds or locked to the grid (1/16 up to bars), in which case it follows the tempo. Delay returns can feed either reverb, and each carries a dimensional width box.
- **Deep Preset Libraries**: 110 reverb programs in eleven banks, 22 tape settings, 28 distortion pedals, 27 channel-compressor settings, 12 width-box combinations and a 76-voice drum synth library — all of it plain data in its own file per effect, so a fork can replace the lot without touching a line of DSP.
- **Songs Carry Everything**: An exported `.json` holds the patterns, the arrangement, the kit, the mixer levels *and* every effect's settings — each effect declares its own save/load next to the state it owns, so nothing gets left out of a song by being forgotten.

## How to Use

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Google Chrome or Microsoft Edge recommended for full File System Access API support).
3. **Load Samples**: Click the `🎛 Pad Browser` or `ALT+Click` any pad to choose a folder on your computer containing audio samples. The app will quickly scan them. 
4. **Assign Sounds**: Click on audio files in the browser to map them to your drum pads.
5. **Sequence Beats**: Open the Sequencer panel, set your BPM, and click steps on the grid to create a drum pattern. Press **Play**.

## Architecture Docs

Every effect lives in its own folder under `libControl/Effects/`, with its DSP, its
front panel, its preset data and a README that walks the code in pseudocode and
explains *why* it works the way it does. Start at
[libControl/Effects/README.EFFECTS.MD](libControl/Effects/README.EFFECTS.MD).

## Philosophy & Architecture

This project strictly adheres to a modular, lightweight, and transparent design philosophy:
- **No file over 200 lines**: The entire codebase is meticulously broken down into single-responsibility hooks and components, making the logic incredibly easy to read, audit, and modify for open-source contributors.
- **No compilation steps**: Open source should be accessible. Anyone can right-click, "View Source", and immediately understand how the app works or tweak the code with a simple text editor. 

## Open Source — Free to Use, Fork, and Modify

This project is 100% open-source and always will be. There is no paid tier, no license key, no account, no telemetry, and no server collecting your samples or your patterns. Everything runs locally in your browser.

You are free to:

- **Use it** — for anything, including commercial music production and paid releases. Beats you make with it are yours; you owe nothing.
- **Download it** — clone the repo or grab a ZIP and run it offline, forever. No internet connection required after the first download.
- **Fork it** — build your own version, rename it, redesign it, strip out what you don't need.
- **Modify it** — there's no build step and no compilation, so you can edit the source in any text editor and reload the page to see the change. See [Philosophy & Architecture](#philosophy--architecture) for why the code is structured to make this easy.
- **Redistribute it** — share it, host it, bundle it into your own project, under the terms of the MIT License.

Contributions are welcome but never required. Whether you're a web developer curious about the Web Audio API or a beatmaker who just wants a free, portable drum machine, dive in.

## Browser Compatibility

- **Google Chrome / Microsoft Edge / Brave / Opera**: Full support (includes File System Access API for seamless local folder browsing and Web MIDI).
- **Firefox / Safari**: Supported, but folder browsing relies on the standard multi-file picker fallback due to lack of File System Access API support. Web MIDI requires a polyfill or extension on Safari.

## License

**[MIT License](LICENSE)** — free to use, modify, and distribute. All of it, for
everyone, for ever. There is no paid tier and never will be.

Written by **Anthony P. Kuzub** — i @ Like . audio — <https://Sampler.Like.audio>

Every source file in this repository carries that notice at the top, so a file
copied out on its own takes its licence and its attribution with it.

### On the interfaces

Every visual representation in this project — every faceplate, knob, meter, lamp,
switch, engraved legend and colour scheme — is an **homage** to classic audio
equipment. They are drawn from scratch in SVG and CSS, and they are here for one
reason: they are the interfaces working engineers already know how to read, and
an instrument you can already read is an instrument you can play.

There is **no affiliation** with, sponsorship by, endorsement by, or connection of
any kind to the original designers or manufacturers of the equipment these panels
resemble. No original artwork, firmware, circuit, sample or measurement has been
copied. Every trademark and product name belongs to its respective owner, and
where such a name appears in this repository it appears only descriptively — to
say what a control is modelled on, so that someone reading the code can look up
what it is meant to do.

The DSP is an independent implementation written from published descriptions of
how such devices behave. It approximates a well-understood class of audio
processing; it does not reproduce any particular manufacturer's product, and it
should not be mistaken for one.

---

<sub>Part of **[Sampler.Like.Audio](https://Sampler.Like.audio)** · Written by Anthony P. Kuzub · i @ Like . audio ·
Released under the **MIT Licence** — free, for everyone, for ever ([LICENSE](./LICENSE)).
Every visual representation in this project is an homage to classic hardware; there is no affiliation with, or
endorsement by, any of the original designers or manufacturers, and their layouts are used only because they are
familiar interfaces.</sub>
