window.SeqControls = ({
    recording, toggleRecording,
    clickVol, setClickVol,
    isPlaying, togglePlayback,
    bpm, setBpm, tapping, tapTempo,
    steps, setSteps, doubleTo,
    rendering, renderLoop,
    savePattern, clearPattern,
    configOpen, setConfigOpen
}) => {
    const SeqButton = window.SeqButton;
    const SeqKnob = window.SeqKnob;
    const STEP_OPTIONS = [4, 8, 16, 32, 64];
    const [footerNode, setFooterNode] = React.useState(null);
    const [configBtnNode, setConfigBtnNode] = React.useState(null);
    // The grid size is a plain global, so read it back through the hook that
    // re-renders on a change rather than holding a second copy of it.
    const padLayout = window.useOaPadGrid() && window.OA_PAD_LAYOUT;
    const setPadLayout = (key) => window.oaSetPadLayout(key);
    React.useEffect(() => {
        setFooterNode(document.getElementById('seq-footer-slot'));
        setConfigBtnNode(document.getElementById('config-footer-slot'));
    }, []);

    // ---- Cached app files -------------------------------------------------
    // The service worker (sw.js) holds the entire machine — the bundle, the
    // vendored React, the whole sample library — so a running instance never
    // waits on the network. The cost is that a bad or stale copy of the shell
    // stays put, and the only way out used to be clearing the browser's
    // history, which is a blunt instrument that also signs the user out of
    // everything else. This button is the targeted version.
    //
    // It deletes CACHE STORAGE ONLY. Patterns, kits, samples and every mixer
    // setting live in localStorage and are deliberately left alone — this is a
    // "re-download the app" button, not a "throw my work away" button.
    const [cacheBusy, setCacheBusy] = React.useState(false);
    const [cacheMsg, setCacheMsg] = React.useState(null);
    const [cacheHeld, setCacheHeld] = React.useState(null);

    // What the browser is currently holding, so the button says something more
    // useful than "clear cache" — a number is what tells you it is worth doing.
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (!navigator.storage || !navigator.storage.estimate) return;
                const { usage } = await navigator.storage.estimate();
                if (alive && usage) setCacheHeld(usage);
            } catch (e) {}
        })();
        return () => { alive = false; };
    }, []);

    const mb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

    const clearCache = async () => {
        const ok = window.confirm(
            'Clear the cached app files?\n\n'
            + 'The app re-downloads itself and reloads.\n\n'
            + 'Your patterns, kits, samples and mixer settings are stored separately '
            + 'and are NOT touched.'
        );
        if (!ok) return;
        setCacheBusy(true);
        setCacheMsg('Clearing…');
        try {
            let n = 0;
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
                n = keys.length;
            }
            // Unregister the worker too. Deleting its caches alone leaves the
            // old worker installed and it simply refills them on the next load,
            // which looks exactly like the button doing nothing.
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
            }
            setCacheMsg(`Cleared ${n} cache${n === 1 ? '' : 's'} — reloading…`);
            // A beat so the message is readable, then straight back to the
            // network: with no worker and no caches, an ordinary reload is a
            // cold start. (reload(true) is ignored by every current browser.)
            setTimeout(() => window.location.reload(), 500);
        } catch (e) {
            setCacheBusy(false);
            setCacheMsg('Could not clear: ' + ((e && e.message) || 'unknown error'));
        }
    };

    // Every footer button shares this footprint so the row reads as one set of controls.
    const FOOTER_BTN = window.OA_FOOTER_BTN;

    const playbackControls = (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SeqButton
                label={recording ? '● Rec ●' : '● Rec'}
                onClick={toggleRecording}
                active={recording}
                color="#5a1f1f" activeColor="#d32f2f" textColor="#fff"
                title="Record: while playing, hit the Sampler pads to write them into the pattern at their velocity"
                style={Object.assign({}, FOOTER_BTN, { border: recording ? '1px solid #ff8a80' : '1px solid #722', boxShadow: recording ? '0 0 8px rgba(211,47,47,0.85)' : 'none' })}
            />
            <SeqButton
                label={isPlaying ? '■ Stop' : '► Play'}
                onClick={togglePlayback}
                color={isPlaying ? '#ffb300' : '#388e3c'} textColor="#fff"
                style={Object.assign({}, FOOTER_BTN, { border: 'none' })}
            />
            <SeqButton label="TAP" onClick={tapTempo} active={tapping} title="Tap to set tempo" style={Object.assign({}, FOOTER_BTN)} />
            <SeqButton
                label="⭳ Save Pattern"
                onClick={savePattern}
                color="#1565c0" textColor="#fff"
                style={Object.assign({}, FOOTER_BTN, { border: 'none' })}
            />
        </div>
    );

    // Picking something in the drop-up is a decision, so the panel closes once
    // it is made. Continuous controls (the tempo slider) deliberately do not.
    const chose = (fn) => (...args) => { fn(...args); setConfigOpen(false); };

    // Config lives alone at the far right of the footer.
    const configButton = (
        <SeqButton
            label={configOpen ? "✖ Close" : "⚙ Config"}
            onClick={() => setConfigOpen(!configOpen)}
            active={configOpen}
            color="#444" textColor="#fff"
            style={Object.assign({}, FOOTER_BTN, { border: '1px solid #666' })}
        />
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '10px' }}>
            {footerNode
                ? ReactDOM.createPortal(playbackControls, footerNode)
                : playbackControls}
            {configBtnNode && ReactDOM.createPortal(configButton, configBtnNode)}

            {/* Tempo heads the config panel — a full-width slider, not a thumbnail knob. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>Tempo</span>
                <input
                    type="range" min={40} max={300} step={1} value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    title="Drag to set the tempo"
                    style={{ flex: 1, minWidth: 0, width: '320px', accentColor: tapping ? '#fff' : '#f4902c', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: tapping ? '#fff' : '#f4902c', fontVariantNumeric: 'tabular-nums', minWidth: '54px', textAlign: 'right' }}>
                    {bpm} <span style={{ fontSize: '9px', color: '#888' }}>BPM</span>
                </span>
            </div>

            {/* How many pads the kit has. One choice resizes the pad grid, the
                mixer strips and the sequencer rows together — they are all one
                voice list. Growing appends voices; shrinking only hides the
                tail, so anything loaded onto pad 25 is still there if the grid
                comes back. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>Pads</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {window.OA_PAD_LAYOUTS.map((l) => (
                        <SeqButton
                            key={l.key}
                            label={l.label}
                            onClick={() => setPadLayout(l.key)}
                            active={padLayout === l.key}
                            title={`${l.cols * l.rows} pads, mixer channels and sequencer tracks`}
                            style={{ padding: '5px 10px' }}
                        />
                    ))}
                </div>
            </div>

            {/* Cached app files. Sits at the bottom of the drop-up because it
                reloads the page — it is the last thing you want to hit by
                accident while reaching for the tempo. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>Storage</span>
                <SeqButton
                    label={cacheBusy ? '⟳ Clearing…' : '⟳ Clear Cache'}
                    onClick={clearCache}
                    disabled={cacheBusy}
                    title="Delete the app files this browser has cached and reload. Patterns, kits, samples and mixer settings are kept."
                    style={{ padding: '5px 10px' }}
                />
                <span style={{ fontSize: '10px', color: cacheMsg ? '#f4902c' : '#777' }}>
                    {cacheMsg
                        || (cacheHeld != null
                            ? `holding ${mb(cacheHeld)} — clears the app files only, your work is kept`
                            : 'clears the app files only, your work is kept')}
                </span>
            </div>

            {/* Steps, Render and Clear now live in the Patterns section of SONG
                (see SeqLibrary) — they belong beside the patterns they act on. */}
        </div>
    );
};
