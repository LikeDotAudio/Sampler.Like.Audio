/**
 * Header: oaSongFile.js
 * Purpose: Export/import a whole song — patterns, arrangement, kit, mixer, synth.
 * Description: One portable .json carrying every saved pattern, the current
 *   arrangement, which sample sits on each track (and how it is tuned/trimmed),
 *   every mixer level, and every synth voice's parameters. Sample AUDIO is not
 *   embedded — each track records the file's name and folder, and the audio is
 *   re-read from the chosen sound folder on import.
 */

window.OA_SONG_FILE_VERSION = 2;

// The per-track sample fields worth carrying. Deliberately excludes `buffer` and
// `cachedBuffer` (decoded audio — not JSON) and `idx` (implied by position).
const SAMPLE_FIELDS = ['name', 'folder', 'pitch', 'sampleRoot', 'offset', 'end', 'loop', 'fade'];

// idx -> serializable sample meta, or null for a track running the synth.
window.oaSnapshotKit = function () {
    const src = window.OA_DRUM_SAMPLES || {};
    const kit = [];
    for (let i = 0; i < 16; i++) {
        const e = src[i];
        if (!e || !e.name) { kit.push(null); continue; }
        const out = {};
        SAMPLE_FIELDS.forEach((k) => { if (e[k] !== undefined) out[k] = e[k]; });
        kit.push(out);
    }
    return kit;
};

window.oaExportSong = function (library, song, name, mixer) {
    const doc = {
        format: 'sampler.like.audio/song',
        version: window.OA_SONG_FILE_VERSION,
        exported: new Date().toISOString(),
        patterns: library || [],
        song: song || [],
        kit: window.oaSnapshotKit(),
        // Levels live in React/MQTT state, so the caller hands them over.
        mixer: mixer || null,
        // These two are plain globals — read them straight from the audio layer.
        synth: JSON.parse(JSON.stringify(window.OA_DRUM_SYNTH || {})),
        reverb: JSON.parse(JSON.stringify(window.OA_REVERB || {})),
        delay: JSON.parse(JSON.stringify(window.OA_DELAY || {})),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(name || 'song').replace(/[^\w\- ]+/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Parse a file's text into { patterns, song }, or throw with a readable reason.
window.oaParseSongFile = function (text) {
    let doc;
    try { doc = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    if (!doc || typeof doc !== 'object') throw new Error('That file is not a song export.');

    // Accept a bare array of patterns too — an older or hand-made export.
    const patterns = Array.isArray(doc) ? doc : (doc.patterns || []);
    const song = Array.isArray(doc) ? [] : (doc.song || []);
    if (!Array.isArray(patterns)) throw new Error('No patterns found in that file.');

    const clean = patterns.filter((p) => p && typeof p.name === 'string' && Array.isArray(p.data));
    // A song with no patterns is still worth importing if it carries a kit,
    // mixer or synth settings — only a file with nothing at all is an error.
    const hasState = doc.kit || doc.mixer || doc.synth || doc.reverb || doc.delay;
    if (!clean.length && !hasState) throw new Error('No usable patterns found in that file.');
    return {
        patterns: clean,
        song: song.filter((n) => typeof n === 'string'),
        // Absent in a v1 file — every consumer treats these as optional.
        kit: Array.isArray(doc.kit) ? doc.kit : null,
        mixer: doc.mixer && typeof doc.mixer === 'object' ? doc.mixer : null,
        synth: doc.synth && typeof doc.synth === 'object' ? doc.synth : null,
        reverb: doc.reverb && typeof doc.reverb === 'object' ? doc.reverb : null,
        delay: doc.delay && typeof doc.delay === 'object' ? doc.delay : null,
    };
};

// Restore everything that lives outside React: synth patches, reverb, and the
// samples themselves. Async because re-reading the audio hits the filesystem.
// Returns a short report so the caller can tell the user what actually landed.
window.oaApplySongState = async function (parsed) {
    const report = { synth: 0, reverb: false, delay: false, samples: 0, sampleNote: '' };

    if (parsed.synth) {
        for (let i = 0; i < 16; i++) {
            const p = parsed.synth[i];
            if (p) { window.oaSetSynthPatch(i, p); report.synth++; }
        }
    }

    if (parsed.reverb) {
        // A v1 export carried one flat reverb; it lands on unit A.
        const units = Array.isArray(parsed.reverb.units) ? parsed.reverb.units : [parsed.reverb];
        units.slice(0, window.OA_REVERB_COUNT).forEach((rv, u) => {
            if (!rv) return;
            if (Array.isArray(rv.sends)) rv.sends.forEach((v, i) => window.oaSetReverbSend(u, i, v));
            ['tone', 'size', 'ret'].forEach((k) => { if (rv[k] !== undefined) window.oaSetReverb(u, k, rv[k]); });
        });
        report.reverb = true;
    }

    if (parsed.delay && Array.isArray(parsed.delay.units)) {
        parsed.delay.units.slice(0, window.OA_DELAY_COUNT).forEach((dl, u) => {
            if (!dl) return;
            if (Array.isArray(dl.sends)) dl.sends.forEach((v, i) => window.oaSetDelaySend(u, i, v));
            if (Array.isArray(dl.toRv)) dl.toRv.forEach((v, r) => window.oaSetDelayToReverb(u, r, v));
            window.OA_DELAY_PARAMS.forEach((p) => {
                if (dl[p.key] !== undefined) window.oaSetDelay(u, p.key, Math.max(p.min, Math.min(p.max, Number(dl[p.key]))));
            });
            if (dl.ret !== undefined) window.oaSetDelay(u, 'ret', Number(dl.ret) || 0);
        });
        report.delay = true;
    }

    if (parsed.kit && parsed.kit.some(Boolean)) {
        // oaRestoreKit re-reads the audio; the per-track tuning and trim it does
        // not know about get re-applied on top once the buffers are in.
        const meta = {};
        parsed.kit.forEach((e, i) => { if (e && e.name) meta[i] = { name: e.name, folder: e.folder || '' }; });
        let res = { ok: false, reason: 'unavailable' };
        try { res = await window.oaRestoreKit(meta); } catch (e) { res = { ok: false, reason: 'error' }; }
        if (res && res.ok) {
            report.samples = res.restored || 0;
            parsed.kit.forEach((e, i) => {
                if (!e || !window.OA_DRUM_SAMPLES[i]) return;
                const patch = {};
                ['pitch', 'sampleRoot', 'offset', 'end', 'loop', 'fade'].forEach((k) => {
                    if (e[k] !== undefined) patch[k] = e[k];
                });
                window.oaUpdateDrumSample(i, patch);
            });
        } else {
            report.sampleNote = (res && res.reason) === 'no-folder'
                ? 'Samples were skipped — no sound folder is connected. Pick your folder, then import again.'
                : 'Samples could not be re-read from your sound folder.';
        }
    }

    return report;
};

// Merge imported patterns into the library. Same-named patterns are kept side
// by side under a suffixed name rather than silently overwriting existing work.
window.oaMergePatterns = function (library, incoming) {
    const out = [...(library || [])];
    const renamed = {};
    incoming.forEach((p) => {
        let name = p.name;
        if (out.some((e) => e.name === name)) {
            let n = 2;
            while (out.some((e) => e.name === `${p.name} (${n})`)) n++;
            name = `${p.name} (${n})`;
            renamed[p.name] = name;
        }
        out.push(Object.assign({}, p, { name }));
    });
    return { library: out, renamed };
};
