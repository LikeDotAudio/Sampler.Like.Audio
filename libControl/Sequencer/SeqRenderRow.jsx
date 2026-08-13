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

// Dedicated row component for Render loops/stems and clear pattern buttons
window.SeqRenderRow = ({ rendering, renderLoop, renderStems, clearPattern }) => {
    const SeqButton = window.SeqButton;

    return (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <SeqButton
                label={rendering ? '…rendering' : '⭳ RENDER 1 LOOP'}
                onClick={() => renderLoop(1)}
                disabled={rendering}
                color="#7b1fa2" textColor="#fff"
                title="Render one pass of this pattern to a loopable WAV file"
                style={{ padding: '6px 12px', border: 'none', cursor: rendering ? 'wait' : 'pointer' }}
            />
            <SeqButton
                label={rendering ? '…rendering' : '⭳ RENDER 8 LOOPS'}
                onClick={() => renderLoop(8)}
                disabled={rendering}
                color="#4a148c" textColor="#fff"
                title="Render eight passes of this pattern to a WAV file"
                style={{ padding: '6px 12px', border: 'none', cursor: rendering ? 'wait' : 'pointer' }}
            />
            <SeqButton
                label={rendering ? '…rendering' : '📦 RENDER STEMS'}
                onClick={() => renderStems && renderStems(1)}
                disabled={rendering}
                color="#00695c" textColor="#fff"
                title="Export every track as isolated WAV stem files in a .zip archive (includes compression and drive, excludes reverb/delay)"
                style={{ padding: '6px 12px', border: 'none', cursor: rendering ? 'wait' : 'pointer' }}
            />
            <SeqButton
                label="Clear"
                onClick={() => {
                    if (window.confirm("Are you sure you want to clear the entire pattern?")) {
                        clearPattern();
                    }
                }}
                style={{ padding: '6px 12px', border: 'none' }}
            />
        </div>
    );
};
