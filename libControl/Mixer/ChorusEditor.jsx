// The front panel of an SDD-320: a bypass switch, five interlocking buttons,
// and nothing else. The original had no rate, depth or mix control — choosing
// a number IS the whole interface, and that constraint is the reason the box
// is so hard to make sound bad.

// One button on the faceplate. OFF is the red one, the four modes are ivory,
// and the pressed button sits down in its well.
const DimButton = ({ mode, active, color, onPress }) => {
    const off = mode === 0;
    const face = active
        ? (off ? '#e8402c' : color)
        : (off ? '#7a2418' : '#d9d4c8');
    return (
        <button
            onClick={() => onPress(mode)}
            title={off ? 'Chorus off' : `Dimension mode ${mode}`}
            style={{
                width: '38px', height: '30px', borderRadius: '2px', cursor: 'pointer',
                background: active
                    ? `linear-gradient(to bottom, ${face} 0%, ${face} 60%, #00000055 100%)`
                    : `linear-gradient(to bottom, ${face} 0%, #00000030 100%)`,
                border: '1px solid #000',
                boxShadow: active
                    ? 'inset 0 2px 5px rgba(0,0,0,0.65)'
                    : '0 2px 0 #000, 0 3px 4px rgba(0,0,0,0.6)',
                transform: active ? 'translateY(2px)' : 'none',
                color: off ? '#fff' : '#2a2a2a',
                fontSize: off ? '9px' : '12px', fontWeight: '700', letterSpacing: '.5px',
                padding: 0, transition: 'transform .06s, box-shadow .06s',
            }}
        >
            {off ? 'OFF' : mode}
        </button>
    );
};

/**
 * The CHORUS panel for one delay return. It writes straight to the live bus, so
 * a button lands on the repeats already circulating in the tape loop.
 */
window.ChorusEditor = ({ u, onClose }) => {
    // The chorus is an insert inside a tape delay, but this panel does not need
    // to know that: it asks the 'chorus' plugin for unit u. Which delay it lives
    // in, and how the two are wired, is the back end's business.
    const state = window.useOaState('chorus', u);

    const meta = window.OA_DELAY_UNITS[u];
    const mode = (state && state.chorus) || 0;
    const on = mode > 0;

    // Interlocked, like the mechanical buttons: one goes down and the last one
    // pops up. Pressing the lit mode releases it back to OFF.
    const press = (m) => window.oaPluginSet('chorus', u, 'chorus', m === mode ? 0 : m);

    return (
        <div style={{
            position: 'fixed', bottom: '46px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--panel)', border: '1px solid #444', borderRadius: '8px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.7)', zIndex: 1200,
            padding: '14px 16px', width: 'min(420px, 92vw)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: meta.color, fontWeight: 'bold', letterSpacing: '1px' }}>
                    {meta.name} — CHORUS
                </span>
                <span style={{ fontSize: '9px', color: '#666' }}>after the tape</span>
                <div style={{ marginLeft: 'auto' }}>
                    <window.SeqButton label="✖ Close" onClick={onClose} style={{ padding: '4px 10px' }} />
                </div>
            </div>

            {/* The faceplate itself — brushed black, with the mode row across it. */}
            <div style={{
                background: 'linear-gradient(to bottom, #24262a 0%, #17181b 100%)',
                border: '1px solid #000', borderRadius: '4px',
                boxShadow: 'inset 0 1px 0 #ffffff12',
                padding: '12px 14px 10px'
            }}>
                <div style={{
                    fontSize: '8px', color: '#8f9299', letterSpacing: '2px',
                    textAlign: 'center', marginBottom: '8px'
                }}>
                    DIMENSION MODE
                </div>

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'flex-end' }}>
                    {window.OA_CHORUS_MODES.map((m, i) => (
                        <DimButton key={i} mode={i} active={mode === i} color={meta.color} onPress={press} />
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '10px' }}>
                    <span style={{
                        width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block',
                        background: on ? '#ff3b2f' : '#3a1a16',
                        boxShadow: on ? '0 0 6px #ff3b2f' : 'inset 0 1px 2px #000'
                    }}></span>
                    <span style={{ fontSize: '8px', color: '#8f9299', letterSpacing: '1.5px' }}>
                        {on ? 'ON' : 'BYPASS'}
                    </span>
                </div>
            </div>

            <div style={{ fontSize: '9px', color: '#666', marginTop: '10px', lineHeight: 1.5 }}>
                Not a warble — the sweep is kept far too shallow to hear as pitch. The
                two sides sweep in opposite directions and the wet copy is inverted
                across the pair, so it mostly cancels in mono and the ear reads what
                is left as width. 1 is a gentle shimmer; 4 is as far as the box goes.
            </div>
        </div>
    );
};
