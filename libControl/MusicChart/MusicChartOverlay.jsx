// ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
// https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
//
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MUSIC CHART & LYRIC OVERLAY UI
 *
 * Renders an interactive music chart timeline displaying:
 * - Structural song sections (Intro, Verse, Chorus, Bridge, Outro)
 * - Interactive chord progression blocks
 * - Note pitch contour & key changes
 * - Synchronized Karaoke / Lyric subtitle overlay
 */

window.MusicChartOverlay = ({ chartData, audioBuffer, trim, setTrimPoint, headPos, onPlayChord }) => {
    const [activeTab, setActiveTab] = React.useState('chart'); // 'chart' | 'lyrics' | 'chords'
    const [scanning, setScanning] = React.useState(false);
    const [data, setData] = React.useState(chartData || null);

    React.useEffect(() => {
        if (chartData) setData(chartData);
    }, [chartData]);

    const runDeepScan = async () => {
        if (!audioBuffer) return;
        setScanning(true);
        try {
            const res = await window.oaDeepScanAudio(audioBuffer);
            setData(res);
        } catch (e) {
            console.error("Deep Scan failed:", e);
        }
        setScanning(false);
    };

    const dur = audioBuffer ? audioBuffer.duration : (data ? data.duration_seconds : 1);
    const pc = (sec) => (dur ? Math.max(0, Math.min(100, (sec / dur) * 100)) : 0);

    return (
        <div style={{ background: '#121212', border: '1px solid #333', borderRadius: '6px', padding: '10px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', letterSpacing: '1px' }}>
                    📊 MUSIC CHART & LYRIC OVERLAY
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={runDeepScan} disabled={scanning || !audioBuffer}
                        style={{
                            fontSize: '10px', padding: '3px 8px', background: 'var(--accent)', color: '#111',
                            border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer'
                        }}>
                        {scanning ? 'Scanning…' : '⚡ Deep Scan Song'}
                    </button>
                    <button onClick={() => {
                        if (audioBuffer && window.oaChopSongToPads) {
                            window.oaChopSongToPads(audioBuffer, "01 Track 01.m4a", data);
                        }
                    }} disabled={!audioBuffer}
                        style={{
                            fontSize: '10px', padding: '3px 8px', background: '#388e3c', color: '#fff',
                            border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer'
                        }} title="Map song chunks directly onto pads 1..16 as a sample bank!">
                        🎛️ Chop to 16 Pads
                    </button>
                    <button onClick={() => setActiveTab('chart')}
                        style={{
                            fontSize: '10px', padding: '3px 6px', background: activeTab === 'chart' ? '#333' : '#222',
                            color: activeTab === 'chart' ? 'var(--accent)' : '#aaa', border: '1px solid #444', borderRadius: '3px'
                        }}>
                        Chart Timeline
                    </button>
                    <button onClick={() => setActiveTab('notes')}
                        style={{
                            fontSize: '10px', padding: '3px 6px', background: activeTab === 'notes' ? '#333' : '#222',
                            color: activeTab === 'notes' ? 'var(--accent)' : '#aaa', border: '1px solid #444', borderRadius: '3px'
                        }}>
                        Notes & Pitch
                    </button>
                    <button onClick={() => setActiveTab('lyrics')}
                        style={{
                            fontSize: '10px', padding: '3px 6px', background: activeTab === 'lyrics' ? '#333' : '#222',
                            color: activeTab === 'lyrics' ? 'var(--accent)' : '#aaa', border: '1px solid #444', borderRadius: '3px'
                        }}>
                        Lyrics & Vocals
                    </button>
                </div>
            </div>

            {!data ? (
                <div style={{ fontSize: '11px', color: '#777', padding: '12px', textAlign: 'center', background: '#0a0a0a', borderRadius: '4px' }}>
                    Press <b>⚡ Deep Scan Song</b> to generate key change, chord progression, and lyric word chart.
                </div>
            ) : (
                <div>
                    {/* CHART TIMELINE OVERLAY */}
                    {activeTab === 'chart' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* SECTION CHUNKS LANE */}
                            <div style={{ position: 'relative', height: '24px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px', overflow: 'hidden' }}>
                                {data.sections && data.sections.map((sec, idx) => (
                                    <div key={idx} onClick={() => {
                                        if (setTrimPoint) {
                                            setTrimPoint('in', sec.start_seconds);
                                            setTrimPoint('out', sec.end_seconds);
                                        }
                                    }} style={{
                                        position: 'absolute', left: `${pc(sec.start_seconds)}%`, width: `${pc(sec.duration_seconds)}%`,
                                        top: 0, bottom: 0, background: idx % 2 === 0 ? 'rgba(76,175,80,0.25)' : 'rgba(33,150,243,0.25)',
                                        borderLeft: '1px solid var(--accent)', padding: '2px 4px', fontSize: '9px', color: '#fff',
                                        cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }} title={`Click to Chop ${sec.label} (${sec.key_center})`}>
                                        {sec.label} ({sec.key_center})
                                    </div>
                                ))}
                            </div>

                            {/* CHORD PROGRESSION LANE */}
                            <div style={{ position: 'relative', height: '26px', background: '#181818', border: '1px solid #333', borderRadius: '3px', overflowX: 'auto', display: 'flex', alignItems: 'center', padding: '2px' }}>
                                {data.chords && data.chords.map((ch, idx) => (
                                    <button key={idx} onClick={() => {
                                        if (setTrimPoint) setTrimPoint('in', ch.timestamp_seconds);
                                        if (onPlayChord) onPlayChord(ch.chord);
                                    }} style={{
                                        fontSize: '9px', padding: '2px 5px', background: '#262626', color: 'var(--accent)',
                                        border: '1px solid #444', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', whiteSpace: 'nowrap'
                                    }} title={`Chord ${ch.chord} @ ${ch.timestamp_seconds}s`}>
                                        🎼 {ch.chord}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* NOTES & PITCH CONTOUR VIEW */}
                    {activeTab === 'notes' && (
                        <div style={{ background: '#0a0a0a', padding: '8px', borderRadius: '4px', border: '1px solid #333', maxHeight: '120px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '4px', fontWeight: 'bold' }}>
                                🎵 Root Notes & Pitch Map
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {data.notes && data.notes.map((nt, idx) => (
                                    <span key={idx} onClick={() => {
                                        if (setTrimPoint) setTrimPoint('in', nt.timestamp_seconds);
                                    }} style={{
                                        fontSize: '10px', padding: '2px 5px', background: '#1c1c1c', color: 'var(--accent)',
                                        border: '1px solid #333', borderRadius: '3px', cursor: 'pointer'
                                    }} title={`Jump to Note ${nt.root_note} @ ${nt.timestamp_seconds}s`}>
                                        🎶 {nt.root_note} <span style={{ fontSize: '8px', color: '#666' }}>({nt.timestamp_seconds}s)</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LYRIC & VOCAL SUBTITLE OVERLAY */}
                    {activeTab === 'lyrics' && (
                        <div style={{ background: '#0a0a0a', padding: '8px', borderRadius: '4px', border: '1px solid #333', maxHeight: '120px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '4px', fontWeight: 'bold' }}>
                                🎤 Synchronized Vocal & Lyric Alignment Map
                            </div>
                            {data.lyrics && data.lyrics.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {data.lyrics.map((ly, idx) => (
                                        <span key={idx} onClick={() => {
                                            if (setTrimPoint) setTrimPoint('in', ly.timestamp_seconds);
                                        }} style={{
                                            fontSize: '10px', padding: '2px 5px', background: '#222', color: '#e0e0e0',
                                            border: '1px solid #333', borderRadius: '3px', cursor: 'pointer'
                                        }} title={`Jump to vocal @ ${ly.timestamp_seconds}s`}>
                                            {ly.word} <span style={{ fontSize: '8px', color: '#777' }}>({ly.timestamp_seconds}s)</span>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '10px', color: '#666' }}>No vocal lyrics detected in this scan.</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
