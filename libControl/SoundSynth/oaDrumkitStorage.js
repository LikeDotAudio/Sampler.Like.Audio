// ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
// https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
//
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// Every visual representation in this project is an HOMAGE to classic hardware.
// There is no affiliation with, or endorsement by, any of the original designers
// or manufacturers; their layouts appear here only because they are familiar
// interfaces, and every name they are known by remains the property of its owner.
// ─────────────────────────────────────────────────────────────────────────────

// ---- Sample persistence (revert samples on reload) --------------------------
// A tiny IndexedDB kv-store to keep the last-picked directory handle (File
// System Access handles are structured-cloneable), so samples can be re-loaded
// next session from their MQTT-stored {name, folder}.
window.oaIdbSet = function (key, val) {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open('oaSound', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
        r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); };
        r.onerror = () => reject(r.error);
    });
};
window.oaIdbGet = function (key) {
    return new Promise((resolve) => {
        const r = indexedDB.open('oaSound', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
        r.onsuccess = () => { const tx = r.result.transaction('kv', 'readonly'); const g = tx.objectStore('kv').get(key); g.onsuccess = () => resolve(g.result); g.onerror = () => resolve(null); };
        r.onerror = () => resolve(null);
    });
};

// Walk a persisted root directory handle to a file. folderPath's first segment
// is the root's own name (skipped); the rest are sub-folders.
async function oaNavigateToFile(root, folderPath, name) {
    const parts = (folderPath || '').split('/').filter(Boolean);
    let dir = root;
    for (let i = 1; i < parts.length; i++) dir = await dir.getDirectoryHandle(parts[i]);
    return await dir.getFileHandle(name);
}

// ---------------------------------------------------------------------------
// Kits that were renamed under someone's feet.
//
// The eight factory sample folders were renamed, and a song saved before that
// stores the OLD folder against every pad. Nothing about the restore path fails
// loudly when a folder is missing — it is a `catch` that skips the pad, because
// a sample the user moved or deleted has to be survivable — so without this the
// symptom is a song that opens with silent pads and no explanation at all.
//
// The saved name is tried FIRST and this is only the fallback: someone who kept
// their own folder under the old name, or who has both, keeps working, and the
// alias never overrides a folder that actually exists.
// ---------------------------------------------------------------------------
const OA_KIT_ALIASES = {
    'Akai Linndrum':         'APK 404',
    'Akai MPC-60':           'APK 414',
    'Alesis SR-16':          'APK 424',
    'Boss DR-550':           'APK 434',
    'Oberheim DMX':          'APK 454',
    'Roland CompuRhythm-78': 'APK 464',
    'Roland TR-808':         'APK 474',
    'Roland TR-909':         'APK 484',
};

/** The same path with a renamed kit folder swapped in, or null if none applies. */
window.oaAliasKitFolder = function (folderPath) {
    const parts = (folderPath || '').split('/');
    const last = parts[parts.length - 1];
    const alias = OA_KIT_ALIASES[last];
    if (!alias) return null;
    parts[parts.length - 1] = alias;
    return parts.join('/');
};

/**
 * Find a file, trying the folder as it was saved and then under its new name.
 * Throws only when neither is there, so the caller's skip-and-carry-on still
 * means what it meant.
 */
async function oaOpenSampleFile(root, folderPath, name) {
    try {
        return await oaNavigateToFile(root, folderPath, name);
    } catch (e) {
        const alias = window.oaAliasKitFolder(folderPath);
        if (!alias) throw e;
        return await oaNavigateToFile(root, alias, name);
    }
}

// A pad whose sample came from the recorder carries the synthetic folder name
// instead of a path on disk. Those come out of IndexedDB and need neither a
// picked folder nor a permission prompt.
const oaIsRecMeta = (m) => !!m && m.folder === window.OA_REC_FOLDER;

// Re-load samples from the persisted folder using per-pad {name, folder} meta.
// MUST be called from a user gesture — may prompt for folder read permission.
window.oaRestoreKit = async function (metaByIdx) {
    const metas = Object.keys(metaByIdx).map((i) => metaByIdx[i]).filter((m) => m && m.name);
    const wantsDisk = metas.some((m) => !oaIsRecMeta(m));
    const wantsRecs = metas.some(oaIsRecMeta);

    // The folder is only fetched, and only prompted for, if something actually
    // needs it — a kit built entirely from recordings must restore on a machine
    // that has never picked a folder at all.
    let root = wantsDisk ? await window.oaIdbGet('oaRootDir') : null;
    if (wantsDisk && !root && !wantsRecs) return { ok: false, reason: 'no-folder', restored: 0 };
    if (root && root.queryPermission) {
        let p = await root.queryPermission({ mode: 'read' });
        if (p !== 'granted' && root.requestPermission) p = await root.requestPermission({ mode: 'read' });
        // Refused, but there are still recordings to put back — restore those
        // rather than reporting total failure over the pads it cannot reach.
        if (p !== 'granted') {
            if (!wantsRecs) return { ok: false, reason: 'permission', restored: 0 };
            root = null;
        }
    }

    let restored = 0;
    for (const idx in metaByIdx) {
        const m = metaByIdx[idx]; if (!m || !m.name) continue;
        try {
            let file = null;
            if (oaIsRecMeta(m)) file = window.oaRecFile ? await window.oaRecFile(m.name) : null;
            else if (root) file = await (await oaOpenSampleFile(root, m.folder, m.name)).getFile();
            if (!file) continue;
            const buf = await window.oaDecodeAudio(window.oaAudioCtx(), await file.arrayBuffer());
            window.oaSetDrumSample(Number(idx), buf, { name: m.name, folder: m.folder || '' });
            restored++;
        } catch (e) { /* file moved/renamed/deleted — skip */ }
    }
    return { ok: true, restored };
};

// Ensure read permission on the persisted root folder (call from a user gesture).
window.oaEnsureRootPermission = async function () {
    const root = window.OA_SOUND_DIR || await window.oaIdbGet('oaRootDir');
    if (!root) return false;
    if (root.queryPermission) {
        let p = await root.queryPermission({ mode: 'read' });
        if (p !== 'granted' && root.requestPermission) p = await root.requestPermission({ mode: 'read' });
        if (p !== 'granted') return false;
    }
    window.OA_SOUND_DIR = root;
    return true;
};

// Resolve a File from {folder, name} using the persisted root (if permitted).
window.oaResolveFile = async function (folderPath, name) {
    // Recordings are not on disk — this is the one folder name that resolves
    // out of IndexedDB, which is what lets a take be favorited like any file.
    if (folderPath === window.OA_REC_FOLDER && window.oaRecFile) return await window.oaRecFile(name);
    const root = window.OA_SOUND_DIR || await window.oaIdbGet('oaRootDir');
    if (!root) return null;
    if (root.queryPermission) { const p = await root.queryPermission({ mode: 'read' }); if (p !== 'granted') return null; }
    try { const fh = await oaOpenSampleFile(root, folderPath, name); return await fh.getFile(); } catch (e) { return null; }
};
