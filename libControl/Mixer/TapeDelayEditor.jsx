// The rhythmic partner to a head's millisecond fader. Same underlying time,
// stepped in 16th notes at the current tempo — and the step it lands on is
// remembered, so the head follows the BPM instead of drifting off the grid.
// Its range is clamped to whole 16ths inside the head's own min/max, so it can
// never push the time out of bounds.
const BeatFader = ({ u, side, spec, value, bpm, locked, color }) => {
    const step = window.OA_DELAY_SIXTEENTH(bpm);
    const lo = Math.max(1, Math.ceil(spec.min / step));
    const hi = Math.floor(spec.max / step);
    if (hi <= lo) return null;                       // no whole 16th fits

    // Round for display so a millisecond nudge does not show a fractional
    // division, but keep the slider on the true position — otherwise it jumps
    // under the cursor.
    const exact = value / step;
    const nearest = Math.max(lo, Math.min(hi, Math.round(exact)));
    const onGrid = locked && Math.abs(exact - nearest) < 0.002;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '9px', color: '#666', minWidth: '78px', textAlign: 'right', paddingRight: '2px' }}>
                beat
            </span>
            <input
                type="range" min={lo} max={hi} step={1} value={nearest}
                onChange={(e) => window.oaSetDelaySync(u, side, Number(e.target.value), bpm)}
                title={`Lock head ${side} to the grid at ${bpm} BPM`}
                style={{ flex: 1, minWidth: '70px', accentColor: onGrid ? color : '#5a6472', cursor: 'pointer' }}
            />
            <span style={{
                fontSize: '10px', minWidth: '62px', textAlign: 'right',
                color: onGrid ? color : '#5a6472', fontVariantNumeric: 'tabular-nums'
            }}>
                {window.oaBeatLabel(nearest)}
                {!onGrid ? <span style={{ color: '#666', fontSize: '9px' }}> ~</span> : null}
            </span>
        </div>
    );
};

/**
 * The TAPE panel for one delay return. Every fader writes straight through to
 * the live bus — the tape is already running, so a move is heard on the repeats
 * that are still in the loop rather than only on the next hit.
 */
window.TapeDelayEditor = ({ u, bpm, onClose }) => {
    const [, force] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
        const onChange = (e) => { if (e.detail && e.detail.unit === u) force(); };
        window.addEventListener('oa-delay-changed', onChange);
        return () => window.removeEventListener('oa-delay-changed', onChange);
    }, [u]);

    // Taken once per unit, so ABORT goes back to however the tape sounded when
    // the panel was opened — not to the factory preset.
    const opened = React.useRef(null);
    React.useEffect(() => {
        opened.current = JSON.parse(JSON.stringify(window.oaDelayUnit(u)));
    }, [u]);

    const unit = window.oaDelayUnit(u);
    const meta = window.OA_DELAY_UNITS[u];
    const params = window.OA_DELAY_PARAMS;

    const dirty = !!opened.current && params.some((p) => opened.current[p.key] !== unit[p.key]);
    const abort = () => {
        if (!opened.current) return;
        params.forEach((p) => window.oaSetDelay(u, p.key, opened.current[p.key]));
    };

    const label = { fontSize: '10px', color: '#aaa', letterSpacing: '0.3px' };

    return (
        <div style={{
            position: 'fixed', bottom: '46px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--panel)', border: '1px solid #444', borderRadius: '8px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.7)', zIndex: 1200,
            padding: '14px 16px', width: 'min(560px, 92vw)', maxHeight: '70vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: meta.color, fontWeight: 'bold', letterSpacing: '1px' }}>
                    {meta.name} — TAPE ECHO
                </span>
                <span style={{ fontSize: '9px', color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                    {bpm} BPM
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <window.SeqButton label="⟲ Abort" onClick={abort} disabled={!dirty}
                        color={dirty ? '#b71c1c' : undefined} textColor={dirty ? '#fff' : undefined}
                        title="Back to how this tape sounded when the panel was opened"
                        style={{ padding: '4px 10px', border: 'none' }} />
                    <window.SeqButton label="✖ Close" onClick={onClose} style={{ padding: '4px 10px' }} />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
                <span style={label}>Machine</span>
                <select
                    value=""
                    onChange={(e) => { if (e.target.value) window.oaApplyDelayPreset(u, e.target.value); }}
                    style={{ background: '#222', color: meta.color, border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '3px 6px' }}
                >
                    <option value="">Load a setting…</option>
                    {Object.keys(window.OA_DELAY_PRESETS).map((k) => (
                        <option key={k} value={k}>{window.OA_DELAY_PRESETS[k].label}</option>
                    ))}
                </select>
                <span style={{ fontSize: '10px', color: '#777', fontStyle: 'italic' }}>
                    heads on a tape loop — wow, flutter and saturation on every lap
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {params.map((p) => {
                    // The two heads carry a second fader that snaps to the grid.
                    const side = p.key === 'timeL' ? 'L' : (p.key === 'timeR' ? 'R' : null);
                    return (
                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ ...label, minWidth: '78px' }}>{p.label}</span>
                                <input
                                    type="range" min={p.min} max={p.max} step={p.step} value={unit[p.key]}
                                    onChange={(e) => window.oaSetDelay(u, p.key, Number(e.target.value))}
                                    style={{ flex: 1, minWidth: '70px', accentColor: meta.color, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '10px', color: meta.color, minWidth: '62px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {p.fmt(unit[p.key])}
                                </span>
                            </div>
                            {side && (
                                <BeatFader
                                    u={u} side={side} spec={p} value={unit[p.key]} bpm={bpm}
                                    locked={!!unit['sync' + side]} color={meta.color}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Aux out of an aux: throw the repeats into a room. */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #3a3f49' }}>
                <div style={{ ...label, marginBottom: '6px' }}>Feed the reverbs</div>
                {window.OA_REVERB_UNITS.map((rvMeta, r) => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ ...label, minWidth: '78px', color: rvMeta.color }}>→ {rvMeta.name}</span>
                        <input
                            type="range" min={0} max={1} step={0.01} value={unit.toRv[r] || 0}
                            onChange={(e) => window.oaSetDelayToReverb(u, r, Number(e.target.value))}
                            style={{ flex: 1, minWidth: '70px', accentColor: rvMeta.color, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '10px', color: (unit.toRv[r] || 0) > 0.005 ? rvMeta.color : '#777', minWidth: '62px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round((unit.toRv[r] || 0) * 100)}%
                        </span>
                    </div>
                ))}
            </div>

            <div style={{ fontSize: '9px', color: '#666', marginTop: '10px', lineHeight: 1.5 }}>
                Intensity past ~100% self-oscillates: the loop feeds itself faster than the
                tape can shed it, and the repeats build until the saturation holds them.
            </div>
        </div>
    );
};
