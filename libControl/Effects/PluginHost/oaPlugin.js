/**
 * Header: oaPlugin.js
 * Purpose: The line between an audio plugin's BACK END and its FRONT PANEL, and
 *   the binary frame that is the only thing allowed to cross it.
 * Description: Every effect in this app used to be read by its editor directly.
 *   The compressor panel reached into ctx.__oaComps[idx].analyser, pulled a
 *   thousand floats out of it every frame and worked out a needle position; the
 *   Mixer reached into the same analyser and did the same arithmetic again for
 *   its own strip. Two consequences, both bad:
 *
 *     THE UI KNEW THE DSP. A panel that names `ctx.__oaComps` cannot be moved,
 *     reskinned or tested without an AudioContext, and the back end cannot
 *     change its node graph without breaking a display that had no business
 *     knowing about it.
 *
 *     THE WORK WAS DONE TWICE, PER FRAME, WITH A FRESH ARRAY EACH TIME. Two
 *     readers meant two 1024-float allocations sixty times a second, per
 *     channel. That is a megabyte a second of garbage on a quiet machine, and
 *     the collector pauses it causes land on the audio thread as a dropout.
 *
 *   So: the back end measures ONCE, into a Float32Array it allocated at startup
 *   and never replaces, and the front end reads numbers out of that array by
 *   index. No node graph, no analysers, no allocation, no arithmetic. A meter
 *   becomes `frame[LAYOUT.PEAK_L]`, which is as simple as a display gets.
 *
 *   THE FRAME. Fixed-length, per unit, allocated once:
 *
 *     [0] SEQ      pump pass counter — a display can tell a frozen frame from a
 *                  quiet one, which a bare zero cannot
 *     [1] ACTIVE   1 when the unit is in circuit, 0 when it is a wire
 *     [2] PEAK_L   output peak, 0..1, left
 *     [3] PEAK_R   output peak, 0..1, right
 *     [4…] whatever the plugin declares in its own layout
 *
 *   The first four are the same everywhere ON PURPOSE: the Mixer can meter any
 *   plugin's return without knowing which plugin it is.
 *
 *   ONE PUMP. A single rAF loop fills every frame for every plugin, and it only
 *   runs while something is attached. Sixteen panels open cost one pass, not
 *   sixteen.
 */

// ---------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------

/** Slots every plugin has, whatever else it declares. */
window.OA_SLOT = {
    SEQ: 0,
    ACTIVE: 1,
    PEAK_L: 2,
    PEAK_R: 3,
    /** First slot a plugin may use for itself. */
    USER: 4,
};

const REG = {};                  // id -> backend descriptor
const FRAMES = {};               // id -> [Float32Array] one per unit

/**
 * The scratch array every analyser read borrows. One buffer for the whole app,
 * reused for ever — the old code allocated a new one per meter per frame, which
 * is the allocation this file exists to delete.
 */
let SCRATCH = null;
const scratch = function (n) {
    if (!SCRATCH || SCRATCH.length < n) SCRATCH = new Float32Array(n);
    return SCRATCH;
};

/**
 * Peak of an analyser's current window, 0..1. The only place in the app that
 * touches getFloatTimeDomainData — deliberately, so nothing in a display does.
 */
window.oaAnalyserPeak = function (analyser) {
    if (!analyser || !analyser.getFloatTimeDomainData) return 0;
    const n = analyser.fftSize || 1024;
    const buf = scratch(n);
    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < n; i++) {
        const a = buf[i] < 0 ? -buf[i] : buf[i];
        if (a > peak) peak = a;
    }
    return peak;
};

/**
 * A meter that rises instantly and falls smoothly. The fall has to be applied
 * where the number is WRITTEN rather than where it is read, or two displays
 * reading the same frame would decay it twice as fast as one.
 */
const FALL = 0.86;
window.oaWritePeak = function (frame, slot, peak) {
    const prev = frame[slot];
    frame[slot] = peak > prev ? peak : prev * FALL;
};

// ---------------------------------------------------------------------------
// Registration — the BACK END interface
// ---------------------------------------------------------------------------

/**
 * A plugin's back end declares itself here. Everything a front panel is allowed
 * to know is in this descriptor; anything not in it is private to the DSP.
 *
 *   id        short stable key, used by every frontend call
 *   label     what a panel puts on its title bar
 *   units     () => how many instances exist (channels, or buses)
 *   params    the front-panel schema: { key,label,min,max,def,fmt,hint,ticks }
 *   state     (i) => the unit's current settings, as plain data
 *   set       (i,key,value) => void, clamps and persists
 *   presets   { name: { label, ...values } }
 *   preset    (i,name) => void
 *   slots     how long this plugin's frame is (>= OA_SLOT.USER)
 *   layout    { NAME: slotIndex } for everything past the shared four
 *   read      (ctx,i,frame) => void — fill the frame. BACK END ONLY.
 *   dispose   (ctx) => void — tear every node this plugin built out of ctx
 *   save      () => plain JSON — everything this effect would need to come back
 *   load      (data, opts) => void — put it back
 */
/**
 * A plugin keeps its own vocabulary — the reverb's schema calls a slider's name
 * `name` because that is what the VARC engraves next to it, and the compressor
 * calls it `label`. The contract promises a front panel a `label`, so fill one
 * in rather than making every plugin rename a field it has good reason to keep.
 * Anything else the plugin declares is passed through untouched.
 */
const normaliseParams = function (params) {
    return (params || []).map(function (p) {
        if (typeof p.label === 'string') return p;
        return Object.assign({}, p, { label: p.name || p.short || p.key });
    });
};

window.oaRegisterPlugin = function (backend) {
    if (!backend || !backend.id) throw new Error('oaRegisterPlugin: a plugin needs an id');
    const slots = Math.max(window.OA_SLOT.USER, backend.slots || window.OA_SLOT.USER);
    const p = Object.assign({}, backend, {
        slots: slots,
        layout: Object.assign({}, window.OA_SLOT, backend.layout || {}),
        units: backend.units || function () { return 1; },
        params: normaliseParams(backend.params),
        presets: backend.presets || {},
    });
    if (backend.paramsFor) {
        p.paramsFor = function (i) { return normaliseParams(backend.paramsFor(i)); };
    }
    REG[p.id] = p;
    FRAMES[p.id] = [];
    return p;
};

window.oaPlugin = function (id) { return REG[id] || null; };
window.oaPluginIds = function () { return Object.keys(REG); };

// ---------------------------------------------------------------------------
// The FRONT END interface. Everything a display is allowed to call.
// ---------------------------------------------------------------------------

/**
 * The live binary frame for one unit. The SAME Float32Array every time — a
 * display holds onto it and reads it, it is never handed a new one.
 */
window.oaPluginFrame = function (id, idx) {
    const p = REG[id];
    if (!p) return null;
    const i = Math.max(0, idx | 0);
    const frames = FRAMES[id];
    if (!frames[i]) frames[i] = new Float32Array(p.slots);
    return frames[i];
};

/** Slot names for a plugin's frame: { SEQ, ACTIVE, PEAK_L, PEAK_R, ...own }. */
window.oaPluginLayout = function (id) { return REG[id] ? REG[id].layout : window.OA_SLOT; };

/**
 * The other half of the binary handoff. A frame carries the numbers that change
 * every frame; a CURVE carries the ones that change when a knob moves — a
 * distortion transfer function, a reverb's decay envelope, a rendered waveform.
 *
 * These are the shapes a panel DRAWS, and they were being recomputed in the
 * editors: DriveEditor evaluated the pedal's own maths a second time, in JSX, to
 * plot it. Two implementations of one curve is one too many, and the copy in
 * the display was always the one that drifted. Now the back end bakes it once —
 * it needs the table for its WaveShaper anyway — and the panel plots the array
 * it is handed without knowing what is in it.
 *
 * Returns a Float32Array the BACK END owns. Read it, plot it, do not write it.
 */
window.oaPluginCurve = function (id, idx, kind) {
    const p = REG[id];
    if (!p || !p.curve) return null;
    try { return p.curve(idx, kind) || null; } catch (e) { return null; }
};

/**
 * The front-panel schema. Most plugins have one fixed faceplate and `params` is
 * that; the drum synth does not — its knobs depend on which engine the pad is
 * running — so a backend may declare `paramsFor(i)` and generate them per unit.
 * A panel calls this either way and never has to know which kind it is talking
 * to, which is the entire point of putting the question here.
 */
window.oaPluginParams = function (id, idx) {
    const p = REG[id];
    if (!p) return [];
    if (p.paramsFor) {
        try { return p.paramsFor(idx | 0) || []; } catch (e) { return []; }
    }
    return p.params;
};
window.oaPluginPresets = function (id) { return REG[id] ? REG[id].presets : {}; };
window.oaPluginUnits = function (id) { return REG[id] ? REG[id].units() : 0; };

window.oaPluginState = function (id, idx) {
    const p = REG[id];
    return p && p.state ? p.state(idx) : null;
};

window.oaPluginSet = function (id, idx, key, value) {
    const p = REG[id];
    if (p && p.set) p.set(idx, key, value);
};

window.oaPluginPreset = function (id, idx, name) {
    const p = REG[id];
    if (p && p.preset) p.preset(idx, name);
};

/**
 * Told when a unit's SETTINGS change — a knob moved, a preset landed. Not for
 * metering: metering is the frame, and the frame is polled, because an event
 * per meter per frame is the thing this design is getting rid of.
 */
window.oaPluginSubscribe = function (id, fn) {
    const p = REG[id];
    if (!p || !p.event) return function () {};
    const handler = function (e) { fn(e.detail || {}); };
    window.addEventListener(p.event, handler);
    return function () { window.removeEventListener(p.event, handler); };
};

// ---------------------------------------------------------------------------
// Save and restore
//
// A song export used to name each effect by hand: oaSongFile.js read
// OA_REVERB, OA_DELAY and OA_DRUM_SYNTH out of the audio layer, wrote them into
// three top-level keys, and had a matching block to put each one back. Two
// consequences, and both of them shipped:
//
//   THE PEDAL AND THE COMPRESSOR WERE NEVER IN A SONG AT ALL. They were added
//   after that list was written, nothing pointed at them, and an exported song
//   quietly came back with every channel clean. Nothing failed — the settings
//   simply were not in the file.
//
//   THE RESTORE LOGIC LIVED IN THE SEQUENCER. How to put a reverb back — program
//   first, then the edits on top, then the sends — is the REVERB's business, and
//   it was three hundred lines away from the reverb in a file about song files.
//
// So an effect now declares how it is saved, next to the thing being saved, and
// the song file asks every plugin at once. An effect added tomorrow is in the
// export the moment it registers, without the exporter knowing it exists.
// ---------------------------------------------------------------------------

/**
 * Every plugin's settings, as one plain object keyed by plugin id. Anything
 * without a save() is skipped — the voice counter has nothing to remember.
 */
window.oaSavePlugins = function () {
    const out = {};
    Object.keys(REG).forEach(function (id) {
        const p = REG[id];
        if (!p.save) return;
        try {
            const data = p.save();
            // A plugin that returns nothing is saying "I have no state", which
            // is different from an empty object and should not land in the file.
            if (data != null) out[id] = JSON.parse(JSON.stringify(data));
        } catch (e) {
            console.warn('⚠️ [' + id + '] could not be saved:', e && e.message);
        }
    });
    return out;
};

/**
 * Put those settings back. `opts` carries what a plugin cannot work out for
 * itself — the song's tempo, which the tape delay needs before it can re-derive
 * a head that was locked to the grid.
 *
 * A plugin that throws is skipped and reported rather than taking the rest of
 * the import down with it: a song that restores five effects out of six is
 * worth far more than an import that fails at the first one.
 *
 * Returns the ids that actually loaded, so the caller can tell the user.
 */
window.oaLoadPlugins = function (data, opts) {
    const done = [];
    if (!data || typeof data !== 'object') return done;
    Object.keys(REG).forEach(function (id) {
        const p = REG[id];
        if (!p.load || data[id] == null) return;
        try {
            p.load(data[id], opts || {});
            done.push(id);
        } catch (e) {
            console.warn('⚠️ [' + id + '] could not be restored:', e && e.message);
        }
    });
    return done;
};

/** Which plugins can be saved at all — used by the tests and the export UI. */
window.oaSaveablePlugins = function () {
    return Object.keys(REG).filter(function (id) { return !!REG[id].save; });
};

// ---------------------------------------------------------------------------
// The pump
// ---------------------------------------------------------------------------

let pumpHandle = null;
let attached = 0;

/**
 * One pass: every plugin, every unit, one frame each. A backend that throws is
 * skipped rather than allowed to kill the loop — a broken meter must not take
 * the other fifteen down with it.
 */
const pumpOnce = function () {
    const ctx = window.OA_AUDIO_CTX;
    const ids = Object.keys(REG);
    for (let k = 0; k < ids.length; k++) {
        const p = REG[ids[k]];
        if (!p.read) continue;
        const n = p.units();
        for (let i = 0; i < n; i++) {
            const frame = window.oaPluginFrame(p.id, i);
            frame[window.OA_SLOT.SEQ] += 1;
            try {
                p.read(ctx, i, frame);
            } catch (e) {
                frame[window.OA_SLOT.ACTIVE] = 0;
            }
        }
    }
};
window.oaPumpPluginsOnce = pumpOnce;

const loop = function () {
    pumpOnce();
    pumpHandle = window.requestAnimationFrame(loop);
};

/**
 * A display says "I am reading frames now" and gets back the way to say it has
 * stopped. The pump runs only between the first attach and the last detach, so
 * a closed panel costs nothing at all.
 */
window.oaPluginAttach = function () {
    attached++;
    if (attached === 1 && !pumpHandle && window.requestAnimationFrame) {
        pumpHandle = window.requestAnimationFrame(loop);
    }
    let released = false;
    return function () {
        if (released) return;          // a double-detach must not unbalance the count
        released = true;
        attached = Math.max(0, attached - 1);
        if (attached === 0 && pumpHandle) {
            window.cancelAnimationFrame(pumpHandle);
            pumpHandle = null;
        }
    };
};

window.oaPluginAttachCount = function () { return attached; };

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

/**
 * Every plugin lets go of everything it built inside `ctx`. Called when a
 * context is closed, and by the leak tests — a plugin that cannot be torn down
 * cleanly in a test is a plugin that will not be torn down cleanly in a browser.
 */
window.oaDisposePlugins = function (ctx) {
    if (!ctx) return;
    Object.keys(REG).forEach(function (id) {
        const p = REG[id];
        if (!p.dispose) return;
        try { p.dispose(ctx); } catch (e) { /* a failed teardown must not block the rest */ }
    });
    Object.keys(FRAMES).forEach(function (id) {
        FRAMES[id].forEach(function (f) { f.fill(0); });
    });
};

/**
 * Disconnect a node and everything it feeds, once. Plugins hand their teardown
 * lists to this rather than each writing the same try/catch fifteen times.
 */
window.oaDisconnectAll = function (nodes) {
    (nodes || []).forEach(function (n) {
        if (!n) return;
        try { n.disconnect(); } catch (e) {}
        // A source that is still running holds its whole chain alive; stopping
        // it is what actually releases the graph.
        if (typeof n.stop === 'function') { try { n.stop(); } catch (e) {} }
    });
};
