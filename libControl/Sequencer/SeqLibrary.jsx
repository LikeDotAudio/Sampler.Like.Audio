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

window.SeqLibrary = ({ library, loadPattern, deletePattern, setSongItems, song,
                       steps, setSteps, doubleTo, rendering, renderLoop, renderStems, clearPattern }) => {
    return (
        <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                Patterns Library
            </div>

            {/* Order inverted upside down as requested */}
            {window.SeqPatternChipsRow && (
                <window.SeqPatternChipsRow
                    library={library}
                    loadPattern={loadPattern}
                    deletePattern={deletePattern}
                    setSongItems={setSongItems}
                    song={song}
                />
            )}

            <div style={{ marginTop: '10px' }}>
                {window.SeqRenderRow && (
                    <window.SeqRenderRow
                        rendering={rendering}
                        renderLoop={renderLoop}
                        renderStems={renderStems}
                        clearPattern={clearPattern}
                    />
                )}
            </div>

            {window.SeqStepsRow && (
                <window.SeqStepsRow
                    steps={steps}
                    setSteps={setSteps}
                    doubleTo={doubleTo}
                />
            )}
        </div>
    );
};
