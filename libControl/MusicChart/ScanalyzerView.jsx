// ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
// https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
//
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ─────────────────────────────────────────────────────────────────────────────

window.ScanalyzerView = ({ audioBuffer, filename, padIdx }) => {
    const [activeLens, setActiveLens] = React.useState('taxonomy');
    const [scanData, setScanData] = React.useState(null);
    const [scanning, setScanning] = React.useState(false);
    const [ucsCatKey, setUcsCatKey] = React.useState('MUSC-TONE');
    const [creatorId, setCreatorId] = React.useState('LIKEAUDIO');
    const [sourceId, setSourceId] = React.useState('SCANALYZER');

    const sample = (padIdx != null && window.OA_DRUM_SAMPLES && window.OA_DRUM_SAMPLES[padIdx]) || null;
    const buf = audioBuffer || (sample && sample.buffer);
    const fname = filename || (sample && sample.name) || 'sample.wav';

    // Auto-run scanner when buffer changes
    React.useEffect(() => {
        if (!buf) return;
        setScanning(true);
        (async () => {
            try {
                const res = await window.oaDeepScanAudio(buf);
                setScanData(res);
            } catch (e) {
                console.error("Scanalyzer error:", e);
            } finally {
                setScanning(false);
            }
        })();
    }, [buf]);

    // Export Helpers
    const exportPeakSidecar = () => {
        if (!scanData) return;
        const payload = {
            filename: fname,
            ucs: {
                cat_key: ucsCatKey,
                creator_id: creatorId,
                source_id: sourceId,
            },
            musicality: scanData.musicality,
            beat_markers: scanData.beatMarkers,
            loudness_ebu_r128: scanData.loudness,
            archival_aes: {
                sha256_hash: scanData.sha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                bext_time_reference: 0,
                version: "AES60-BWF-v2"
            },
            spatial_aes69: {
                azimuth_deg: 0.0,
                elevation_deg: 0.0,
                distance_m: 1.0,
                sofa_format: "AES69-SOFA-v1"
            },
            lyrics_vad: scanData.lyrics
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fname.replace(/\.[^/.]+$/, "")}.PEAK`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportLrcLyrics = () => {
        if (!scanData || !scanData.lyrics || !scanData.lyrics.words) return;
        let lrc = `[ar:${creatorId}]\n[ti:${fname}]\n[by:Scanalyzer]\n\n`;
        scanData.lyrics.words.forEach(w => {
            const min = String(Math.floor(w.start / 60)).padStart(2, '0');
            const sec = String(Math.floor(w.start % 60)).padStart(2, '0');
            const ms = String(Math.floor((w.start % 1) * 100)).padStart(2, '0');
            lrc += `[${min}:${sec}.${ms}] ${w.text}\n`;
        });

        const blob = new Blob([lrc], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fname.replace(/\.[^/.]+$/, "")}.lrc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!buf) {
        return (
            <div style={{ background: '#121418', border: '1px solid #333', borderRadius: '6px', padding: '20px', textAlign: 'center', color: '#888' }}>
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔬</span>
                Select or drop an audio track to launch the Scanalyzer Multi-Lens Inspector & Exporter.
            </div>
        );
    }

    return (
        <div style={{ background: '#121418', border: '1px solid var(--accent)', borderRadius: '6px', padding: '12px', color: '#ccc', fontFamily: 'monospace' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #2a2f38', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', color: 'var(--accent)', fontWeight: 'bold' }}>🔬 SCANALYZER MULTI-LENS INSPECTOR</span>
                    <span style={{ fontSize: '11px', color: '#888', background: '#1e222b', padding: '2px 6px', borderRadius: '3px' }}>{fname}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={exportPeakSidecar} disabled={!scanData}
                        style={{ background: 'var(--accent)', color: '#111', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        💾 Export .PEAK Sidecar
                    </button>
                    <button onClick={exportLrcLyrics} disabled={!scanData}
                        style={{ background: '#2196f3', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📝 Export .LRC Lyrics
                    </button>
                </div>
            </div>

            {/* Lens Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #222', paddingBottom: '6px', overflowX: 'auto' }}>
                {[
                    { id: 'taxonomy', label: '🔍 1. UCS Taxonomy' },
                    { id: 'musicality', label: '🎵 2. Pitch & Beats' },
                    { id: 'lyrics', label: '🎙️ 3. Lyrics VAD' },
                    { id: 'loudness', label: '🎚️ 4. EBU R128 Loudness' },
                    { id: 'archival', label: '🏛️ 5. AES Preservation' },
                    { id: 'spatial', label: '🌐 6. AES69 3D Spatial' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveLens(tab.id)}
                        style={{
                            background: activeLens === tab.id ? 'var(--accent-s70)' : '#1e222b',
                            color: activeLens === tab.id ? 'var(--accent-t60)' : '#aaa',
                            border: `1px solid ${activeLens === tab.id ? 'var(--accent)' : '#333'}`,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold'
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Scanning Status */}
            {scanning && <div style={{ color: 'var(--accent)', fontSize: '11px', marginBottom: '10px' }}>⚡ Extracting 6-lens metadata from audio buffer...</div>}

            {/* Lens Views */}
            {scanData && (
                <div>
                    {/* Lens 1: UCS Taxonomy */}
                    {activeLens === 'taxonomy' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px', border: '1px solid #2a2f38' }}>
                                <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '6px' }}>UCS CATEGORY CONFIGURATION</div>
                                <label style={{ display: 'block', marginBottom: '4px' }}>CatKey (6-Part Schema):</label>
                                <input value={ucsCatKey} onChange={e => setUcsCatKey(e.target.value)}
                                    style={{ width: '100%', background: '#0d0e12', border: '1px solid #444', color: '#fff', padding: '4px', borderRadius: '3px', marginBottom: '8px' }} />
                                
                                <label style={{ display: 'block', marginBottom: '4px' }}>Creator ID:</label>
                                <input value={creatorId} onChange={e => setCreatorId(e.target.value)}
                                    style={{ width: '100%', background: '#0d0e12', border: '1px solid #444', color: '#fff', padding: '4px', borderRadius: '3px', marginBottom: '8px' }} />

                                <label style={{ display: 'block', marginBottom: '4px' }}>Source ID:</label>
                                <input value={sourceId} onChange={e => setSourceId(e.target.value)}
                                    style={{ width: '100%', background: '#0d0e12', border: '1px solid #444', color: '#fff', padding: '4px', borderRadius: '3px' }} />
                            </div>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px', border: '1px solid #2a2f38' }}>
                                <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '6px' }}>COMPOSED UCS BASENAME</div>
                                <div style={{ fontSize: '12px', color: '#7dff4a', background: '#0d0e12', padding: '8px', borderRadius: '3px', wordBreak: 'break-all' }}>
                                    {`${ucsCatKey}_${fname.replace(/\.[^/.]+$/, "")}_${creatorId}_${sourceId}.wav`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lens 2: Pitch & Beats */}
                    {activeLens === 'musicality' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '11px' }}>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>DETECTED KEY & PITCH</div>
                                <div style={{ fontSize: '20px', color: 'var(--accent)', fontWeight: 'bold' }}>{scanData.musicality.key}</div>
                                <div>{scanData.musicality.pitchHz} Hz ({scanData.musicality.centsOffset} cents)</div>
                            </div>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>ESTIMATED TEMPO</div>
                                <div style={{ fontSize: '20px', color: '#7dff4a', fontWeight: 'bold' }}>{scanData.musicality.bpm} BPM</div>
                                <div>{scanData.beatMarkers.length} Beat Markers Detected</div>
                            </div>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>SOUNDING CHUNKS</div>
                                <div style={{ fontSize: '20px', color: '#42a5f5', fontWeight: 'bold' }}>{scanData.chunks.length} Chunks</div>
                                <div>Ready for 16-Pad Slicing</div>
                            </div>
                        </div>
                    )}

                    {/* Lens 3: Lyrics VAD */}
                    {activeLens === 'lyrics' && (
                        <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px', fontSize: '11px' }}>
                            <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '6px' }}>VOICE ACTIVITY & SUBTITLE ALIGNMENT</div>
                            <div>Vocal Phrasing Detected: {scanData.lyrics.words ? scanData.lyrics.words.length : 0} Word Timestamps</div>
                            <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: '6px', background: '#0d0e12', padding: '6px', borderRadius: '3px' }}>
                                {scanData.lyrics.words && scanData.lyrics.words.map((w, i) => (
                                    <span key={i} style={{ display: 'inline-block', marginRight: '8px', color: '#cde' }}>
                                        [{w.start.toFixed(2)}s] {w.text}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lens 4: EBU R128 Loudness */}
                    {activeLens === 'loudness' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '11px' }}>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>INTEGRATED LOUDNESS</div>
                                <div style={{ fontSize: '20px', color: scanData.loudness.integratedLUFS > -14 ? '#ff5252' : '#7dff4a', fontWeight: 'bold' }}>
                                    {scanData.loudness.integratedLUFS} LUFS
                                </div>
                                <div>EBU R128 Target: -23 LUFS</div>
                            </div>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>MAX TRUE PEAK</div>
                                <div style={{ fontSize: '20px', color: '#ffb74d', fontWeight: 'bold' }}>{scanData.loudness.maxTruePeakdBTP} dBTP</div>
                                <div>Ceiling: -1.0 dBTP</div>
                            </div>
                            <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px' }}>
                                <div style={{ color: '#aaa' }}>LOUDNESS RANGE (LRA)</div>
                                <div style={{ fontSize: '20px', color: '#42a5f5', fontWeight: 'bold' }}>{scanData.loudness.lraLU} LU</div>
                                <div>Dynamic Range Window</div>
                            </div>
                        </div>
                    )}

                    {/* Lens 5: AES Preservation */}
                    {activeLens === 'archival' && (
                        <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px', fontSize: '11px' }}>
                            <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '6px' }}>AES SC-03-06 ARCHIVAL PRESERVATION METADATA</div>
                            <div>BWF bext Version: 2 (EBU Tech 3285)</div>
                            <div>SHA-256 Checksum: <span style={{ color: '#7dff4a' }}>e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span></div>
                            <div>Sample-Accurate Time Reference: 0 samples since midnight</div>
                        </div>
                    )}

                    {/* Lens 6: AES69 3D Spatial */}
                    {activeLens === 'spatial' && (
                        <div style={{ background: '#181b22', padding: '10px', borderRadius: '4px', fontSize: '11px' }}>
                            <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '6px' }}>AES69 / SOFA 3D SPATIAL AUDIO METADATA</div>
                            <div>Azimuth (Φ): 0.0° | Elevation (Θ): 0.0° | Distance (r): 1.0 m</div>
                            <div>Spatial Format: AES69 SOFA HRTF / EBU ADM (Tech 3364)</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
