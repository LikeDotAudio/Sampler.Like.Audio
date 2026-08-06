/**
 * Header: harness.mjs
 * Purpose: Load the real plugin sources into a fake browser so the tests drive
 *   the shipping code, not a copy of it.
 * Description: build.mjs concatenates every source into one bundle, each file
 *   wrapped in its own IIFE so top-level `const`s in different files cannot
 *   collide, and cross-file sharing happens through window.* alone. This does
 *   exactly the same thing with `new Function`, one file at a time, against a
 *   window object the test owns.
 *
 *   `new Function` rather than node:vm ON PURPOSE. A vm context is a separate
 *   realm with its own intrinsics, so a Float32Array built inside it fails
 *   `instanceof Float32Array` out here — and half of what these plugins hand
 *   around is Float32Array. Same realm, same intrinsics, no surprises.
 *
 *   THE WORKLET TRICK. A plugin ships its DSP as a source string and registers
 *   it from a Blob URL, because the whole app is one bundle and a worklet module
 *   has to be separately fetchable. That means the source passes through
 *   URL.createObjectURL on its way — so the fake URL here keeps the text, and
 *   addModule() can EVALUATE it against a fake AudioWorkletProcessor. The tests
 *   then run the actual process() function over actual arrays. The compressor's
 *   ballistics are tested for real, not asserted about.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    FakeAudioContext,
    FakeOfflineAudioContext,
    FakeWorkletNode,
} from './fakeAudio.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every backend module, in dependency order. This is the subset of sources.json
 * that has no React in it — the audio layer on its own, which is exactly what
 * the plugin tests want to load.
 */
export const BACKEND_SOURCES = [
    'libControl/SoundSynth/oaPadGrid.js',
    'libControl/SoundSynth/oaPlugin.js',
    'libControl/SoundSynth/oaDrumSynthEngines.js',
    'libControl/SoundSynth/oaDrumSynthPatches.js',
    'libControl/SoundSynth/oaReverb.js',
    'libControl/SoundSynth/oaChorus.js',
    'libControl/SoundSynth/oaTapeDelay.js',
    'libControl/SoundSynth/oaDrive.js',
    'libControl/SoundSynth/oaCompressor.js',
    'libControl/SoundSynth/oaFxBus.js',
    'libControl/SoundSynth/oaDrumkitAudio.js',
    'libControl/SoundSynth/oaDrumkitStorage.js',
    'libControl/SoundSynth/oaDrumkitSynth.js',
    'libControl/SoundSynth/SoundSynth.js',
];

// ---------------------------------------------------------------------------
// The bits of a browser these modules actually touch
// ---------------------------------------------------------------------------

class FakeCustomEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
        this.defaultPrevented = false;
    }
    preventDefault() { this.defaultPrevented = true; }
}

class FakeBlob {
    constructor(parts, opts = {}) {
        this.__text = (parts || []).join('');
        this.type = opts.type || '';
        this.size = this.__text.length;
    }
    text() { return Promise.resolve(this.__text); }
}

const makeLocalStorage = () => {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        clear: () => map.clear(),
        key: (i) => Array.from(map.keys())[i] ?? null,
        get length() { return map.size; },
        __map: map,
    };
};

/**
 * A fake AudioWorkletGlobalScope. Runs a processor's source for real and keeps
 * the class, so a test can instantiate it and call process() over live arrays.
 */
const evaluateWorklet = (source, sampleRate) => {
    const registered = new Map();

    class AudioWorkletProcessor {
        constructor() {
            this.port = {
                onmessage: null,
                __sent: [],
                postMessage(m) { this.__sent.push(m); },
            };
        }
    }
    const registerProcessor = (name, cls) => { registered.set(name, cls); };

    const fn = new Function(
        'AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentTime',
        `"use strict";\n${source}`,
    );
    fn(AudioWorkletProcessor, registerProcessor, sampleRate, 0);
    return registered;
};

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

/**
 * Build a fresh fake browser and load `sources` into it.
 *
 * Returns everything a test needs to poke at:
 *   window     the shared global the plugins hang themselves off
 *   ctx        a live FakeAudioContext, already set as window.OA_AUDIO_CTX
 *   events     every CustomEvent dispatched, in order
 *   processors name -> the real worklet class, once addModule has run
 *   flush()    drain pending microtasks and timers
 */
export async function createWorld(opts = {}) {
    const sources = opts.sources || BACKEND_SOURCES;
    const sampleRate = opts.sampleRate || 48000;

    const events = [];
    const listeners = new Map();
    const processors = new Map();
    const timers = new Set();

    // Blob URL -> source text, so addModule can find the processor it was given.
    const blobs = new Map();
    let blobSeq = 0;

    const FakeURL = {
        createObjectURL(blob) {
            const url = `blob:oa-test/${++blobSeq}`;
            blobs.set(url, blob && blob.__text ? blob.__text : '');
            return url;
        },
        revokeObjectURL(url) { blobs.delete(url); },
    };

    const window = {
        // Filled in by the sources themselves as they load.
    };

    window.window = window;
    window.self = window;
    window.localStorage = makeLocalStorage();
    window.CustomEvent = FakeCustomEvent;
    window.Blob = FakeBlob;
    window.URL = FakeURL;
    window.AudioWorkletNode = null;   // set below, needs ctx-aware construction
    window.performance = { now: () => 0 };
    window.innerWidth = 1280;
    window.innerHeight = 900;
    window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });

    // Just enough DOM for the mount point to find a container and for a panel
    // to set a style on a ref. Nothing here lays anything out — a panel that
    // depends on a measured size is asking a question this cannot answer, and
    // should be reading it from a frame instead.
    const makeElement = (tag) => ({
        tagName: (tag || 'div').toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        textContent: '',
        offsetHeight: 0,
        offsetWidth: 0,
        appendChild(c) { this.children.push(c); return c; },
        removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
        setAttribute() {},
        getAttribute: () => null,
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 }),
    });
    window.document = {
        documentElement: makeElement('html'),
        body: makeElement('body'),
        createElement: makeElement,
        getElementById: () => makeElement('div'),
        querySelector: () => makeElement('div'),
        querySelectorAll: () => [],
        addEventListener() {},
        removeEventListener() {},
    };

    window.addEventListener = (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
    };
    window.removeEventListener = (type, fn) => {
        const l = listeners.get(type);
        if (l) listeners.set(type, l.filter((f) => f !== fn));
    };
    window.dispatchEvent = (ev) => {
        events.push(ev);
        (listeners.get(ev.type) || []).slice().forEach((f) => f(ev));
        return true;
    };

    // The app's meter pump asks for frames; tests drive it by hand instead, so
    // the callback is recorded and never fires on its own.
    const frames = [];
    window.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
    window.cancelAnimationFrame = (id) => { frames[id - 1] = null; };

    const setTimeoutShim = (fn, ms) => {
        const id = setTimeout(fn, ms);
        timers.add(id);
        return id;
    };
    const clearTimeoutShim = (id) => { timers.delete(id); clearTimeout(id); };

    // -- the audio side -----------------------------------------------------

    // Every context built in this world, so a test can inspect an offline one
    // the plugin made on its own.
    const contexts = [];

    const wireContext = (c) => {
        contexts.push(c);
        const addModule = c.audioWorklet.addModule.bind(c.audioWorklet);
        c.audioWorklet.addModule = async (url) => {
            const src = blobs.get(url);
            if (src == null) throw new Error(`addModule: unknown URL ${url}`);
            const registered = evaluateWorklet(src, c.sampleRate);
            registered.forEach((cls, name) => {
                processors.set(name, cls);
                // parameterDescriptors is a static getter on the real class —
                // read it once so FakeWorkletNode can build matching params.
                const descriptors = (cls.parameterDescriptors || []);
                c.__modules.set(name, descriptors);
            });
            return undefined;
        };
        return c;
    };

    class TestAudioContext extends FakeAudioContext {
        constructor(o) { super(Object.assign({ sampleRate }, o)); wireContext(this); }
    }
    class TestOfflineAudioContext extends FakeOfflineAudioContext {
        constructor(ch, len, rate) { super(ch, len, rate); wireContext(this); }
    }

    window.AudioContext = TestAudioContext;
    window.webkitAudioContext = TestAudioContext;
    window.OfflineAudioContext = TestOfflineAudioContext;
    window.webkitOfflineAudioContext = TestOfflineAudioContext;
    window.AudioWorkletNode = FakeWorkletNode;

    // -- load the sources ---------------------------------------------------

    for (const rel of sources) {
        let code = readFileSync(join(ROOT, rel), 'utf8');
        // The display sources are JSX, so they need the same Babel pass the
        // bundle gets before `new Function` will look at them. Loaded lazily so
        // a backend-only test never pays for it.
        if (rel.endsWith('.jsx')) {
            const { transformSync } = await import('@babel/core');
            code = transformSync(code, {
                filename: rel,
                presets: [['@babel/preset-react', { runtime: 'classic' }]],
                compact: false,
                babelrc: false,
                configFile: false,
            }).code;
        }
        let fn;
        try {
            fn = new Function(
                'window', 'self', 'localStorage', 'CustomEvent', 'Blob', 'URL',
                'AudioWorkletNode', 'AudioContext', 'OfflineAudioContext',
                'requestAnimationFrame', 'cancelAnimationFrame',
                'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
                'console', 'performance', 'React', 'ReactDOM', 'document', 'navigator',
                // `with (window)` because that is genuinely how the bundle
                // resolves names in a browser, and nothing else reproduces it.
                //
                // build.mjs gives each source its own IIFE, so a component
                // declared `const SvgFader = …` in one file is NOT in lexical
                // scope in another. The files export by assigning window.X, and
                // the browser then resolves a bare `SvgFader` elsewhere by
                // walking the scope chain out to the real global object — where
                // window.X is a property, because in a browser window IS the
                // global. Here `window` is an ordinary object, so that last hop
                // does not exist and every cross-file reference would fail.
                //
                // `with` puts it back exactly. The cost is that this cannot be
                // strict-mode code; the alternative is node:vm, which is a
                // separate realm and would break `instanceof Float32Array` on
                // every array these modules hand around — a far worse trade for
                // an audio codebase.
                `with (window) {\n${code}\n}\n//# sourceURL=${rel}`,
            );
        } catch (e) {
            throw new Error(`${rel}: failed to parse — ${e.message}`);
        }
        try {
            fn(
                window, window, window.localStorage, FakeCustomEvent, FakeBlob, FakeURL,
                FakeWorkletNode, TestAudioContext, TestOfflineAudioContext,
                window.requestAnimationFrame, window.cancelAnimationFrame,
                setTimeoutShim, clearTimeoutShim, setInterval, clearInterval,
                console, window.performance, opts.React || null, opts.ReactDOM || null, window.document, { userAgent: 'oa-test' },
            );
        } catch (e) {
            throw new Error(`${rel}: threw while loading — ${e.stack}`);
        }
    }

    const ctx = new TestAudioContext();
    window.OA_AUDIO_CTX = ctx;

    const flush = async () => {
        // Two turns: one for the addModule promise chain, one for whatever it
        // scheduled on resolution.
        await Promise.resolve();
        await new Promise((r) => setImmediate(r));
        await Promise.resolve();
    };

    return {
        window,
        ctx,
        contexts,
        events,
        processors,
        frames,
        blobs,
        flush,
        /** Run every pending rAF callback once, the way a browser frame would. */
        tick() {
            const due = frames.splice(0, frames.length).filter(Boolean);
            due.forEach((f) => f(0));
            return due.length;
        },
        /** Events of one type, newest last. */
        eventsOf(type) { return events.filter((e) => e.type === type); },
        cleanup() {
            timers.forEach((t) => clearTimeout(t));
            timers.clear();
        },
    };
}

/**
 * The common opening move: a world with the effects warmed up, so the worklets
 * are registered and every bus exists before the first voice.
 */
export async function createWarmWorld(opts = {}) {
    const w = await createWorld(opts);
    if (w.window.oaWarmFx) await w.window.oaWarmFx(w.ctx);
    await w.flush();
    return w;
}
