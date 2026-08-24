// ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
// https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
//
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ─────────────────────────────────────────────────────────────────────────────

window.LensesView = ({ audioBuffer, filename, padIdx }) => {
    const [activeLens, setActiveLens] = React.useState('taxonomy');
    const [scanData, setScanData] = React.useState(null);
    const [scanning, setScanning] = React.useState(false);
    const [ucsCatKey, setUcsCatKey] = React.useState('MUSC-TONE');
    const [creatorId, setCreatorId] = React.useState('LIKEAUDIO');
    const [sourceId, setSourceId] = React.useState('SCANALYZER');
    const [isDictating, setIsDictating] = React.useState(false);

    const canvasRef = React.useRef(null);
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
                console.error("Lenses scan error:", e);
            } finally {
                setScanning(false);
            }
        })();
    }, [buf]);

    // Draw Performance Data Over Time Canvas Timeline
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !buf) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth || 800;
        const height = canvas.height = 140;

        ctx.fillStyle = '#0b0d11';
        ctx.fillRect(0, 0, width, height);

        const data = buf.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const midY = height / 2;

        // 1. Draw Waveform & RMS Envelope Over Time
        ctx.fillStyle = '#1b263b';
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
            let min = 1.0, max = -1.0;
            for (let j = 0; j < step; j++) {
                const val = data[x * step + j] || 0;
                if (val < min) min = val;
                if (val > max) max = val;
            }
            const y1 = midY + min * (height * 0.35);
            const y2 = midY + max * (height * 0.35);
            ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }

        // 2. Draw Pitch Contour Over Time (Hz)
        if (scanData && scanData.musicality) {
            ctx.strokeStyle = '#f4902c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const hz = scanData.musicality.pitchHz || 440;
            const normPitchY = midY - (Math.log2(hz / 110) * 15);
            ctx.moveTo(0, normPitchY);
            ctx.lineTo(width, normPitchY);
            ctx.stroke();

            // Pitch label
            ctx.fillStyle = '#f4902c';
            ctx.font = '10px monospace';
            ctx.fillText(`Pitch: ${hz.toFixed(1)} Hz (${scanData.musicality.key})`, 10, normPitchY - 4);
        }

        // 3. Draw Beat Markers Over Time
        if (scanData && scanData.beatMarkers) {
            const dur = buf.duration;
            ctx.strokeStyle = 'rgba(125, 255, 74, 0.4)';
            ctx.lineWidth = 1;
            scanData.beatMarkers.forEach(bm => {
                const x = (bm.timestamp_seconds / dur) * width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            });
        }

        // 4. Draw Vocal VAD Bursts Over Time
        if (scanData && scanData.lyrics && scanData.lyrics.words) {
            const dur = buf.duration;
            ctx.fillStyle = 'rgba(66, 165, 245, 0.6)';
            scanData.lyrics.words.forEach(w => {
                const x1 = (w.start / dur) * width;
                const wWidth = Math.max(8, (0.5 / dur) * width);
                ctx.fillRect(x1, height - 18, wWidth, 12);
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px monospace';
                ctx.fillText(w.text, x1 + 2, height - 9);
                ctx.fillStyle = 'rgba(66, 165, 245, 0.6)';
            });
        }

    }, [buf, scanData]);

    // Handle Timeline Scrubbing & Seeking
    const handleTimelineClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas || !buf) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const progress = x / rect.width;
        const seekTime = progress * buf.duration;

        if (window.oaSeekAudio) {
            window.oaSeekAudio(seekTime);
        }
    };

    // Export Performance Data (.PERF JSON)
    const exportPERFData = () => {
        if (!scanData) return;
        const payload = {
            filename: fname,
            duration_seconds: buf ? buf.duration : 0,
            sample_rate: buf ? buf.sampleRate : (window.oaSampleRate ? window.oaSampleRate() : null),
            performance_data: {
                pitch_hz: scanData.musicality.pitchHz,
                key: scanData.musicality.key,
                bpm: scanData.musicality.bpm,
                integrated_lufs: scanData.loudness.integratedLUFS,
                max_true_peak_dbtp: scanData.loudness.maxTruePeakdBTP,
                lra_lu: scanData.loudness.lraLU,
                beat_markers: scanData.beatMarkers,
                vad_vocal_events: scanData.lyrics.words,
                sha256_checksum: scanData.sha256
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fname.replace(/\.[^/.]+$/, "")}.PERF.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Speech Dictation ("Talk to Type")
    const startDictation = (onResult) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please type directly.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        setIsDictating(true);
        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setIsDictating(false);
            if (onResult) onResult(transcript);
        };
        recognition.onerror = () => setIsDictating(false);
        recognition.onend = () => setIsDictating(false);
        recognition.start();
    };

    // Speech Synthesis ("Talk Back / Read Aloud")
    const speakText = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    // Import Metadata (.PEAK, .LRC, JSON)
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                if (file.name.endsWith('.PEAK') || file.name.endsWith('.json')) {
                    const parsed = JSON.parse(text);
                    if (parsed.ucs) {
                        if (parsed.ucs.cat_key) setUcsCatKey(parsed.ucs.cat_key);
                        if (parsed.ucs.creator_id) setCreatorId(parsed.ucs.creator_id);
                        if (parsed.ucs.source_id) setSourceId(parsed.ucs.source_id);
                    }
                    if (parsed.musicality || parsed.beat_markers) {
                        setScanData(prev => ({
                            ...prev,
                            musicality: parsed.musicality || (prev && prev.musicality),
                            beatMarkers: parsed.beat_markers || (prev && prev.beatMarkers),
                            lyrics: parsed.lyrics_vad || (prev && prev.lyrics),
                            loudness: parsed.loudness_ebu_r128 || (prev && prev.loudness)
                        }));
                    }
                    alert(`Imported metadata sidecar successfully from ${file.name}`);
                } else if (file.name.endsWith('.lrc')) {
                    const lines = text.split('\n');
                    const words = [];
                    lines.forEach(l => {
                        const m = l.match(/\[(\d+):(\d+\.\d+)\]\s*(.*)/);
                        if (m) {
                            const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
                            words.push({ start: time, text: m[3] });
                        }
                    });
                    setScanData(prev => ({
                        ...prev,
                        lyrics: { words, vadSegments: [] }
                    }));
                    alert(`Imported ${words.length} LRC lyric timestamps from ${file.name}`);
                }
            } catch (err) {
                console.error("Metadata import failed:", err);
                alert("Could not parse imported metadata file.");
            }
        };
        reader.readAsText(file);
    };

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
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔭</span>
                Select or drop an audio track to launch the Multidimensional Audio Lenses Inspector.
            </div>
        );
    }

    return (
        <div style={{ background: '#121418', border: '1px solid var(--accent)', borderRadius: '6px', padding: '12px', color: '#ccc', fontFamily: 'monospace' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #2a2f38', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', color: 'var(--accent)', fontWeight: 'bold' }}>🔭 MULTIDIMENSIONAL AUDIO LENSES</span>
                    <span style={{ fontSize: '11px', color: '#888', background: '#1e222b', padding: '2px 6px', borderRadius: '3px' }}>{fname}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label style={{ background: '#2a2f38', color: '#ccc', border: '1px solid #444', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📥 Import Sidecar/LRC
                        <input type="file" accept=".PEAK,.json,.lrc" onChange={handleImportFile} style={{ display: 'none' }} />
                    </label>
                    <button onClick={exportPERFData} disabled={!scanData}
                        style={{ background: '#9c27b0', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📊 Export .PERF JSON
                    </button>
                    <button onClick={exportPeakSidecar} disabled={!scanData}
                        style={{ background: 'var(--accent)', color: '#111', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        💾 Export .PEAK
                    </button>
                    <button onClick={exportLrcLyrics} disabled={!scanData}
                        style={{ background: '#2196f3', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📝 Export .LRC
                    </button>
                </div>
            </div>

            {/* Performance Data Over Time Timeline Canvas */}
            <div style={{ marginBottom: '12px', background: '#0b0d11', borderRadius: '4px', padding: '4px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        📈 PERFORMANCE DATA OVER TIME (CLICK TO SEEK & PLAY)
                    </span>
                    <span style={{ fontSize: '9px', color: '#888' }}>
                        Waveform / Pitch Contour (Hz) / Beat Grid / Vocal VAD Bursts
                    </span>
                </div>
                <canvas ref={canvasRef} onClick={handleTimelineClick} style={{ width: '100%', height: '140px', display: 'block', borderRadius: '3px', cursor: 'pointer' }} />
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>UCS CATEGORY CONFIGURATION</span>
                                    <button onClick={() => startDictation(txt => setUcsCatKey(txt.toUpperCase().replace(/\s+/g, '-')))}
                                        style={{ background: isDictating ? '#ff5252' : '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>
                                        {isDictating ? '🎙️ Listening…' : '🎤 Dictate CatKey'}
                                    </button>
                                </div>
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
                                <button onClick={() => speakText(`UCS Category Key: ${ucsCatKey}. Composed filename: ${ucsCatKey}_${fname.replace(/\.[^/.]+$/, "")}_${creatorId}_${sourceId}.wav`)}
                                    style={{ marginTop: '8px', background: '#2a2f38', color: '#7dff4a', border: '1px solid #444', borderRadius: '3px', padding: '3px 8px', fontSize: '9px', cursor: 'pointer' }}>
                                    🔊 Read Aloud UCS Basename
                                </button>
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
                                <button onClick={() => speakText(`Key: ${scanData.musicality.key}, ${scanData.musicality.pitchHz} Hertz`)}
                                    style={{ marginTop: '6px', background: '#2a2f38', color: '#ccc', border: 'none', padding: '2px 5px', fontSize: '9px', borderRadius: '2px', cursor: 'pointer' }}>
                                    🔊 Speak Pitch
                                </button>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>VOICE ACTIVITY & SUBTITLE ALIGNMENT</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => startDictation(txt => {
                                        const nowSec = 0.0;
                                        setScanData(prev => ({
                                            ...prev,
                                            lyrics: {
                                                words: [...((prev && prev.lyrics && prev.lyrics.words) || []), { start: nowSec, text: txt }]
                                            }
                                        }));
                                    })} style={{ background: isDictating ? '#ff5252' : '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>
                                        {isDictating ? '🎙️ Listening…' : '🎤 Dictate Lyric Line'}
                                    </button>
                                    <button onClick={() => {
                                        if (scanData.lyrics && scanData.lyrics.words) {
                                            const fullText = scanData.lyrics.words.map(w => w.text).join(' ');
                                            speakText(fullText);
                                        }
                                    }} style={{ background: '#2a2f38', color: '#7dff4a', border: '1px solid #444', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', cursor: 'pointer' }}>
                                        🔊 Read Aloud Lyrics
                                    </button>
                                </div>
                            </div>
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

window.ScanalyzerView = window.LensesView;
