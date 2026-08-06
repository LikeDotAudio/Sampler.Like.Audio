const Mixer = () => {
    const { trackVol, setTrackVol, trackPan, setTrackPan, mutes, toggleMute, solos, toggleSolo, clearSolos, masterVol, setMasterVol, clickVol, setClickVol, recording, bpm } = window.useSeqState('Pattern Sequencer', 16, window.OA_DRUM_KIT || []);
    const tracks = window.OA_DRUM_KIT || [];
    // One strip per pad — a bigger grid grows the mixer with it.
    window.useOaPadGrid();

    // Sixteen near-neighbours of the accent, so adjacent channel strips are
    // distinguishable without any of them looking like a different theme.
    // Built as tints and shades of var(--accent) rather than fixed oranges:
    // pick a blue in Config and the whole rack turns blue together.
    const PALETTE = ["var(--accent)", "var(--accent-t15)", "var(--accent-s15)", "var(--accent)",
                     "var(--accent-t25)", "var(--accent-s25)", "var(--accent)", "var(--accent-s15)",
                     "var(--accent-t15)", "var(--accent)", "var(--accent-s25)", "var(--accent-t25)",
                     "var(--accent)", "var(--accent-t15)", "var(--accent-s15)", "var(--accent)"];

    const isAnySolo = solos.some(v => v);

    const meterRefs = React.useRef([]);
    const clickMeterRef = React.useRef(null);

    // Which channel's SYNTH panel is open, and a re-render when samples change
    // so a channel that just got a sample loses its SYNTH button.
    const [synthPad, setSynthPad] = React.useState(null);
    const [drivePad, setDrivePad] = React.useState(null);
    const [compPad, setCompPad] = React.useState(null);
    const [larcUnit, setLarcUnit] = React.useState(null);
    const [tapeUnit, setTapeUnit] = React.useState(null);
    const [chorusUnit, setChorusUnit] = React.useState(null);
    const [, forceSamples] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
        const onSample = () => forceSamples();
        // The Sequencer's track names open the same editor — the Mixer hosts it
        // because it is always mounted, and the panel portals to <body>.
        const onOpen = (e) => { if (e.detail && e.detail.idx != null) { setDrivePad(null); setCompPad(null); setSynthPad(e.detail.idx); } };
        window.addEventListener('oa-sample-changed', onSample);
        window.addEventListener('oa-open-synth', onOpen);
        return () => {
            window.removeEventListener('oa-sample-changed', onSample);
            window.removeEventListener('oa-open-synth', onOpen);
        };
    }, []);
    const hasSample = (i) => !!(window.OA_DRUM_SAMPLES && window.OA_DRUM_SAMPLES[i] && window.OA_DRUM_SAMPLES[i].buffer);

    // Every effect return, in strip order: the two reverbs, then the four tape
    // delays. One list drives the send knobs, the meters and the return strips,
    // so the three can never disagree about what exists.
    const FX = React.useMemo(() => [
        ...window.OA_REVERB_UNITS.map((m, i) => ({
            kind: 'rv', i, key: `rv${i}`, name: m.name, color: m.color,
            short: 'R' + String.fromCharCode(65 + i),
        })),
        ...window.OA_DELAY_UNITS.map((m, i) => ({
            kind: 'dl', i, key: `dl${i}`, name: m.name, color: m.color,
            short: 'D' + (i + 1),
        })),
    ], []);

    const sendOf = (fx, ch) => {
        const unit = fx.kind === 'rv' ? window.oaReverbUnit(fx.i) : window.oaDelayUnit(fx.i);
        return (unit.sends && unit.sends[ch]) || 0;
    };
    const setSend = (fx, ch, v) => (fx.kind === 'rv' ? window.oaSetReverbSend : window.oaSetDelaySend)(fx.i, ch, v);
    const busOf = (ctx, fx) => (fx.kind === 'rv' ? ctx.__oaReverbs : ctx.__oaDelays) || [];

    // The effect state lives outside React (the audio graph reads it directly),
    // so mirror its changes back into a render.
    const [, forceFx] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
        const onFx = () => forceFx();
        window.addEventListener('oa-reverb-changed', onFx);
        window.addEventListener('oa-delay-changed', onFx);
        window.addEventListener('oa-drive-changed', onFx);
        window.addEventListener('oa-comp-changed', onFx);
        return () => {
            window.removeEventListener('oa-reverb-changed', onFx);
            window.removeEventListener('oa-delay-changed', onFx);
            window.removeEventListener('oa-drive-changed', onFx);
            window.removeEventListener('oa-comp-changed', onFx);
        };
    }, []);

    // A head locked to the grid is stored as a count of 16ths, so a tempo change
    // has to re-derive its time. The Mixer is where the two meet: it is always
    // mounted and it already reads the transport.
    React.useEffect(() => { window.oaResyncDelays(bpm); }, [bpm]);

    // A tail and a tape repeat decay on their own schedule, so unlike the
    // per-hit track meters these are polled from each bus's analysers.
    const fxMeterRefs = React.useRef({});
    // The gain-reduction readout on each channel's COMPRESS button.
    const grRefs = React.useRef({});
    React.useEffect(() => {
        let raf = null;
        const buf = new Float32Array(1024);
        const peaks = {};
        const tick = () => {
            const ctx = window.OA_AUDIO_CTX;
            if (ctx) {
                // Only channels whose compressor has actually been built have a
                // number to show; everything else is a wire and stays blank.
                const comps = ctx.__oaComps || [];
                Object.keys(grRefs.current).forEach((k) => {
                    const el = grRefs.current[k];
                    if (!el) return;
                    const gr = comps[k] ? window.oaCompGR(k | 0) : 0;
                    const text = gr > 0.15 ? '-' + gr.toFixed(1) : '';
                    if (el.textContent !== text) el.textContent = text;
                });
                FX.forEach((fx) => {
                    const bus = busOf(ctx, fx)[fx.i];
                    const els = fxMeterRefs.current[fx.key];
                    if (!bus || !bus.analysers || !els) return;
                    const p = peaks[fx.key] || (peaks[fx.key] = [0, 0]);
                    bus.analysers.forEach((an, ch) => {
                        const el = els[ch];
                        if (!el) return;
                        an.getFloatTimeDomainData(buf);
                        let peak = 0;
                        for (let i = 0; i < buf.length; i++) {
                            const a = Math.abs(buf[i]);
                            if (a > peak) peak = a;
                        }
                        // Fall away smoothly so the tail reads as a decay, not a flicker.
                        p[ch] = Math.max(peak, p[ch] * 0.86);
                        el.style.height = `${Math.max(0, (1 - Math.min(1, p[ch])) * 100)}%`;
                    });
                });
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [FX]);

    const masterRefs = React.useRef([null, null]);
    const masterPeaks = React.useRef({ L: 0, R: 0, pending: false });

    const stateRef = React.useRef({ trackVol, mutes, solos, isAnySolo, trackPan });
    React.useEffect(() => {
        stateRef.current = { trackVol, mutes, solos, isAnySolo, trackPan };
    }, [trackVol, mutes, solos, isAnySolo, trackPan]);

    React.useEffect(() => {
        // The meters follow every voice trigger, wherever it came from:
        //   oa-drum-play — sequencer steps
        //   oa-drum-hit  — pad strikes (mouse, keyboard, MIDI)
        //   oa-tone-hit  — tone-mode strikes, metered on their root track
        const onPlay = (e) => {
            const d = e.detail || {};
            const idx = d.idx != null ? d.idx : d.rootIdx;
            if (idx == null) return;
            const el = meterRefs.current[idx];
            if (!el) return;

            const { trackVol: tVol, mutes: tMutes, solos: tSolos, isAnySolo: tAnySolo } = stateRef.current;
            const vol = tVol[idx] == null ? 1 : tVol[idx];

            if (tMutes[idx] || (tAnySolo && !tSolos[idx]) || vol === 0) return;

            const i = Math.max(0, Math.min(1, ((e.detail.velocity || 0) / 100) * vol));
            const targetHeight = (1 - i) * 100;

            el.style.transition = 'none';
            el.style.height = `${targetHeight}%`;

            // 1. Animate Individual Track Meter
            el.style.transition = 'none';
            el.style.height = `${targetHeight}%`;
            void el.offsetHeight;
            el.style.transition = 'height 0.3s cubic-bezier(0.2, 1, 0.3, 1)';
            el.style.height = '100%';

            // 2. Accumulate Master Meter Peaks
            const tPan = stateRef.current.trackPan[idx] || 0;
            // Simple equal power panning approximation
            const lFactor = Math.cos((tPan + 1) * Math.PI / 4);
            const rFactor = Math.sin((tPan + 1) * Math.PI / 4);
            const hitVol = ((e.detail.velocity || 0) / 100) * vol;

            masterPeaks.current.L = Math.min(1.05, masterPeaks.current.L + hitVol * lFactor * 0.9);
            masterPeaks.current.R = Math.min(1.05, masterPeaks.current.R + hitVol * rFactor * 0.9);

            if (!masterPeaks.current.pending) {
                masterPeaks.current.pending = true;
                requestAnimationFrame(() => {
                    [masterRefs.current[0], masterRefs.current[1]].forEach((mel, c) => {
                        if (!mel) return;
                        const peak = c === 0 ? masterPeaks.current.L : masterPeaks.current.R;
                        const mTarget = Math.max(0, (1 - peak) * 100);
                        mel.style.transition = 'none';
                        mel.style.height = `${mTarget}%`;
                        void mel.offsetHeight;
                        mel.style.transition = 'height 0.4s cubic-bezier(0.2, 1, 0.3, 1)';
                        mel.style.height = '100%';
                    });
                    masterPeaks.current = { L: 0, R: 0, pending: false };
                });
            }
        };
        // The click track gets its own meter — it bypasses the track strips entirely.
        const onClick = (e) => {
            const el = clickMeterRef.current;
            if (!el) return;
            const i = Math.max(0, Math.min(1, ((e.detail && e.detail.velocity) || 0) / 100));
            el.style.transition = 'none';
            el.style.height = `${(1 - i) * 100}%`;
            void el.offsetHeight;
            el.style.transition = 'height 0.3s cubic-bezier(0.2, 1, 0.3, 1)';
            el.style.height = '100%';
        };

        const EVENTS = ['oa-drum-play', 'oa-drum-hit', 'oa-tone-hit'];
        EVENTS.forEach(name => window.addEventListener(name, onPlay));
        window.addEventListener('oa-click', onClick);
        return () => {
            EVENTS.forEach(name => window.removeEventListener(name, onPlay));
            window.removeEventListener('oa-click', onClick);
        };
    }, []);

    const panLabel = v => Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" + Math.round(-v * 100) : "R" + Math.round(v * 100));

    // A pair of meter bars for one effect return, gradient-tinted to the unit.
    const fxMeters = (fx) => (
        <React.Fragment>
            {[0, 1].map((ch) => (
                <div key={ch} style={{
                    width: '6px', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #0008',
                    background: `linear-gradient(to top, #1e2430 0%, ${fx.color} 74%, ${fx.color} 88%, #ffffff 100%)`
                }}>
                    <i ref={(el) => {
                        const slot = fxMeterRefs.current[fx.key] || (fxMeterRefs.current[fx.key] = [null, null]);
                        slot[ch] = el;
                    }}
                       style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '100%', background: '#15171b' }}></i>
                </div>
            ))}
        </React.Fragment>
    );

    return (
        <div className="chunky-scrollbar" style={{ display: 'flex', gap: 0, padding: 0, overflowX: 'auto', alignItems: 'stretch', justifyContent: 'safe center', backgroundColor: 'var(--bg)' }}>
            {tracks.map((track, i) => {
                const color = PALETTE[i % PALETTE.length];
                const isMuted = mutes[i];
                const isSolo = solos[i];
                const vol = trackVol[i] == null ? 1 : trackVol[i];
                const pan = trackPan[i] || 0;

                // If solos are active, mute non-soloed tracks locally in UI (fader opacity)
                const mutedBySolo = isAnySolo && !isSolo;

                return (
                    <div key={i} style={{
                        // Strips butt up against each other — a single rule line is the only separator.
                        background: 'var(--strip)', border: 'none', borderRight: '1px solid #3a3f49', borderRadius: 0,
                        width: '76px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '0 3px 8px', overflow: 'hidden'
                    }}>

                        {/* The channel name IS the ON button — lit means the track is live. Solo sits under it. */}
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '3px', marginTop: '6px', marginBottom: '8px' }}>
                            <button
                                onClick={() => toggleMute(i)}
                                title={`${track.name || 'Track'} — click to ${isMuted ? 'unmute' : 'mute'}`}
                                style={{
                                    // Twice the height of an ordinary strip button — this one
                                    // is the channel's on/off, and it is hit constantly.
                                    width: '100%', minWidth: 0, padding: '12px 2px', textAlign: 'center', borderRadius: '4px',
                                    border: `1px solid ${!isMuted ? 'var(--on)' : '#444b57'}`,
                                    background: !isMuted ? 'var(--accent-s70)' : '#353b45',
                                    cursor: 'pointer', fontSize: '9px', fontWeight: '700',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                    overflow: 'hidden'
                                }}
                            >
                                <span style={{ color: !isMuted ? color : 'var(--muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                                <span style={{ color: !isMuted ? 'var(--accent-t60)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name || 'Track'}</span>
                            </button>
                            <button
                                onClick={() => toggleSolo(i)}
                                style={{
                                    width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                    border: `1px solid ${isSolo ? 'var(--solo)' : '#444b57'}`,
                                    background: isSolo ? '#6b5014' : '#353b45',
                                    color: isSolo ? '#fff3c4' : 'var(--muted)',
                                    cursor: 'pointer', fontSize: '9px', fontWeight: '600'
                                }}
                            >
                                S
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch', height: '180px', opacity: mutedBySolo ? 0.4 : 1, transition: 'opacity 0.2s', width: '100%', justifyContent: 'center', marginBottom: '6px' }}>
                            <div style={{
                                width: '6px', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #0008',
                                background: 'linear-gradient(to top, var(--accent-s25) 0%, var(--accent-s15) 74%, var(--accent) 78%, var(--accent-t15) 88%, var(--accent-t40) 93%, var(--accent-t60) 100%)'
                            }}>
                                <i ref={el => meterRefs.current[i] = el} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '100%', background: '#15171b' }}></i>
                            </div>
                            <SvgFader
                                value={vol} color={color} width={36} height={180}
                                onChange={(v) => setTrackVol((prev) => { const n = [...prev]; n[i] = v; return n; })}
                            />
                        </div>

                        {/* No sample loaded means this voice is synthesized — let them shape it. */}
                        {!hasSample(i) && (
                            <button
                                onClick={() => { setDrivePad(null); setCompPad(null); setSynthPad(synthPad === i ? null : i); }}
                                title={`Edit the ${track.name || 'Track'} synth voice`}
                                style={{
                                    width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                    border: `1px solid ${synthPad === i ? 'var(--accent)' : '#444b57'}`,
                                    background: synthPad === i ? 'var(--accent-s70)' : '#2a2f38',
                                    color: synthPad === i ? 'var(--accent-t60)' : '#9aa3ae',
                                    cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.5px',
                                    marginBottom: '4px'
                                }}
                            >
                                SYNTH
                            </button>
                        )}

                        {/* The pedal in front of this channel. Unlit means the
                            mix is at 0 and no distortion is in the graph at all. */}
                        {(() => {
                            const dUnit = window.oaDriveUnit(i);
                            const dOn = dUnit.mix > window.OA_DRIVE_EPSILON;
                            const dColor = window.oaDriveMode(dUnit.mode).color;
                            const dOpen = drivePad === i;
                            return (
                                <button
                                    onClick={() => { setSynthPad(null); setCompPad(null); setDrivePad(dOpen ? null : i); }}
                                    title={`${track.name || 'Track'} — distortion pedal${dOn ? ` (${window.oaDriveMode(dUnit.mode).label}, ${Math.round(dUnit.mix * 100)}% mix)` : ''}`}
                                    style={{
                                        width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                        border: `1px solid ${dOpen || dOn ? dColor : '#444b57'}`,
                                        background: dOpen ? '#4a2418' : (dOn ? '#33201a' : '#2a2f38'),
                                        color: dOpen || dOn ? dColor : '#9aa3ae',
                                        cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.5px',
                                        marginBottom: '4px'
                                    }}
                                >
                                    DRIVE{dOn ? ` ${Math.round(dUnit.mix * 100)}` : ''}
                                </button>
                            );
                        })()}

                        {/* The limiting amplifier on the end of this channel.
                            When it is in, the button carries the live gain
                            reduction — the number that says whether the setting
                            is doing anything at all. */}
                        {(() => {
                            const cUnit = window.oaCompUnit(i);
                            const cOn = window.oaCompActive(i);
                            const cRatio = window.oaCompRatio(cUnit.ratio);
                            const cOpen = compPad === i;
                            const cColor = window.OA_COMP_COLOR;
                            return (
                                <button
                                    onClick={() => { setSynthPad(null); setDrivePad(null); setCompPad(cOpen ? null : i); }}
                                    title={`${track.name || 'Track'} — limiting amplifier${cOn ? ` (${cRatio.label}${cRatio.key === 'all' ? '' : ':1'})` : ''}`}
                                    style={{
                                        width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                        border: `1px solid ${cOpen || cOn ? cColor : '#444b57'}`,
                                        background: cOpen ? '#4a3218' : (cOn ? '#33280f' : '#2a2f38'),
                                        color: cOpen || cOn ? cColor : '#9aa3ae',
                                        cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.3px',
                                        marginBottom: '4px', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', gap: '3px', overflow: 'hidden'
                                    }}
                                >
                                    <span>COMPRESS</span>
                                    {/* Written straight into the DOM by the meter
                                        loop above — a number that moves at 60fps
                                        must not re-render sixteen strips to do it. */}
                                    <i ref={(el) => { grRefs.current[i] = el; }}
                                       style={{ fontStyle: 'normal', fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}></i>
                                </button>
                            );
                        })()}

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <SvgKnob
                                value={pan} min={-1} max={1} defaultVal={0} bipolar={true} color={color} size={32}
                                onChange={(v) => setTrackPan((pprev) => { const n = [...pprev]; n[i] = v; return n; })}
                            />
                            <div style={{ fontSize: '8px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{panLabel(pan)}</div>
                        </div>

                        {/* Sends — how much of this channel feeds each shared effect.
                            Two reverbs on the top row, then the four tape delays. */}
                        <div style={{
                            width: '100%', marginTop: '6px', paddingTop: '5px', borderTop: '1px solid #3a3f49',
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 2px', justifyItems: 'center'
                        }}>
                            {FX.map((fx) => {
                                const amount = sendOf(fx, i);
                                return (
                                    <div key={fx.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                        <SvgKnob
                                            value={amount} min={0} max={1} defaultVal={0} color={fx.color} size={26}
                                            onChange={(v) => setSend(fx, i, v)}
                                        />
                                        <div title={`${track.name || 'Track'} → ${fx.name}`} style={{
                                            fontSize: '7px', letterSpacing: '.2px', fontVariantNumeric: 'tabular-nums',
                                            color: amount > 0.001 ? fx.color : 'var(--muted)'
                                        }}>
                                            {fx.short} {Math.round(amount * 100)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                );
            })}

            {/* Click Strip */}
            <div style={{
                background: 'var(--strip)', border: 'none', borderRight: '1px solid #3a3f49', borderRadius: 0,
                width: '60px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 3px 8px', gap: '8px',
                boxShadow: recording ? '0 0 10px rgba(211,47,47,0.5)' : 'none'
            }}>
                <div style={{ fontSize: '10px', color: recording ? '#ff8a80' : '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: recording ? 'bold' : 'normal' }}>Click</div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch', height: '180px', justifyContent: 'center' }}>
                    <div style={{
                        width: '6px', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #0008',
                        background: 'linear-gradient(to top, #8a8a8a 0%, #c9c9c9 74%, #e0e0e0 88%, #fff 100%)'
                    }}>
                        <i ref={clickMeterRef} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '100%', background: '#15171b' }}></i>
                    </div>
                    <SvgFader value={clickVol} color={recording ? "#d32f2f" : "#aaa"} width={36} height={180} onChange={(v) => setClickVol(v)} />
                </div>

                <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums', marginTop: '23px' }}>{Math.round(clickVol * 100)}</div>
            </div>

            {/* Reverb Returns — the wet paths everything sends into */}
            {window.OA_REVERB_UNITS.map((meta, u) => {
                const fx = FX[u];
                const unit = window.oaReverbUnit(u);
                return (
                    <div key={fx.key} style={{
                        background: 'var(--strip)', border: 'none', borderRight: '1px solid #3a3f49', borderRadius: 0,
                        width: '78px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '8px 4px 8px', gap: '8px'
                    }}>
                        <div style={{ fontSize: '10px', color: meta.color, letterSpacing: '1px', textTransform: 'uppercase' }}>{meta.name}</div>

                        {/* The two dropdowns that used to sit here — a tone and a
                            size, four choices each — are now the LARC. The strip
                            just reports which program is loaded and opens the
                            remote; everything else about the room is edited there. */}
                        {(() => {
                            const open = larcUnit === u;
                            return (
                                <button
                                    onClick={() => setLarcUnit(open ? null : u)}
                                    title={`${meta.name} — open the LARC (${window.oaReverbBank(unit.bank).name}: ${window.oaReverbProgramName(u)})`}
                                    style={{
                                        width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                        border: `1px solid ${open ? meta.color : '#444b57'}`,
                                        background: open ? '#1e3a3c' : '#2a2f38',
                                        color: open ? meta.color : '#9aa3ae',
                                        cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.5px'
                                    }}
                                >
                                    LARC
                                </button>
                            );
                        })()}

                        {/* Program number and name, the way the machine's own
                            display carries it. A dot means it has been edited
                            away from the stored program. */}
                        <div style={{ width: '100%', textAlign: 'center', lineHeight: 1.25, minHeight: '26px' }}>
                            <div style={{
                                fontSize: '8px', color: meta.color, fontWeight: '700',
                                fontVariantNumeric: 'tabular-nums'
                            }}>
                                {unit.prog + 1}·{window.oaReverbProgramName(u)}{unit.edited ? ' *' : ''}
                            </div>
                            <div style={{ fontSize: '7px', color: 'var(--muted)', letterSpacing: '.3px' }}>
                                {window.oaReverbBank(unit.bank).name}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '3px', alignItems: 'stretch', height: '140px', justifyContent: 'center' }}>
                            {fxMeters(fx)}
                            <SvgFader
                                value={unit.ret} color={meta.color} width={36} height={140}
                                onChange={(v) => window.oaSetReverb(u, 'ret', v)}
                            />
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(unit.ret * 100)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>RETURN</div>
                    </div>
                );
            })}

            {/* Tape Delay Returns — a Space Echo per strip. TAPE opens the heads. */}
            {window.OA_DELAY_UNITS.map((meta, u) => {
                const fx = FX[window.OA_REVERB_COUNT + u];
                const unit = window.oaDelayUnit(u);
                const open = tapeUnit === u;
                const chOpen = chorusUnit === u;
                const chMode = unit.chorus || 0;
                const thrown = unit.toRv
                    .map((v, r) => (v > 0.005 ? `${window.OA_REVERB_UNITS[r].name.replace('RV ', 'R')} ${Math.round(v * 100)}` : null))
                    .filter(Boolean);
                return (
                    <div key={fx.key} style={{
                        background: 'var(--strip)', border: 'none', borderRight: '1px solid #3a3f49', borderRadius: 0,
                        width: '74px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '8px 4px 8px', gap: '6px'
                    }}>
                        <div style={{ fontSize: '10px', color: meta.color, letterSpacing: '1px', textTransform: 'uppercase' }}>{meta.name}</div>

                        <button
                            onClick={() => { setChorusUnit(null); setTapeUnit(open ? null : u); }}
                            title={`${meta.name} — heads, wow, flutter and tape drive`}
                            style={{
                                width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                border: `1px solid ${open ? meta.color : '#444b57'}`,
                                background: open ? '#332c55' : '#2a2f38',
                                color: open ? meta.color : '#9aa3ae',
                                cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.5px'
                            }}
                        >
                            TAPE
                        </button>

                        {/* Next box in the chain. Lit means a Dimension mode is
                            in — the number says which. */}
                        <button
                            onClick={() => { setTapeUnit(null); setChorusUnit(chOpen ? null : u); }}
                            title={`${meta.name} — Dimension chorus after the tape${chMode ? `, mode ${chMode}` : ''}`}
                            style={{
                                width: '100%', padding: '3px 0', textAlign: 'center', borderRadius: '4px',
                                border: `1px solid ${chOpen || chMode ? meta.color : '#444b57'}`,
                                background: chOpen ? '#332c55' : (chMode ? '#26223d' : '#2a2f38'),
                                color: chOpen || chMode ? meta.color : '#9aa3ae',
                                cursor: 'pointer', fontSize: '9px', fontWeight: '700', letterSpacing: '.5px'
                            }}
                        >
                            CHORUS{chMode ? ` ${chMode}` : ''}
                        </button>

                        <div style={{ fontSize: '8px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(unit.timeL * 1000)}/{Math.round(unit.timeR * 1000)} ms
                        </div>

                        <div style={{ display: 'flex', gap: '3px', alignItems: 'stretch', height: '140px', justifyContent: 'center' }}>
                            {fxMeters(fx)}
                            <SvgFader
                                value={unit.ret} color={meta.color} width={36} height={140}
                                onChange={(v) => window.oaSetDelay(u, 'ret', v)}
                            />
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(unit.ret * 100)}
                        </div>
                        {/* Where this tape's repeats end up besides the output. */}
                        <div style={{ fontSize: '8px', color: thrown.length ? '#7fd4d6' : 'var(--muted)', textAlign: 'center', minHeight: '10px' }}>
                            {thrown.length ? `→ ${thrown.join(' ')}` : 'RETURN'}
                        </div>
                    </div>
                );
            })}

            {/* Master Strip */}
            <div style={{
                background: 'var(--strip)', border: 'none', borderRadius: 0,
                width: '64px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 3px 8px', gap: '8px'
            }}>
                <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Master</div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch', height: '180px' }}>
                    {/* L Meter */}
                    <div style={{
                        width: '6px', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #0008',
                        background: 'linear-gradient(to top, var(--accent-s25) 0%, var(--accent-s15) 74%, var(--accent) 78%, var(--accent-t15) 88%, var(--accent-t40) 93%, var(--accent-t60) 100%)'
                    }}>
                        <i ref={el => masterRefs.current[0] = el} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '100%', background: '#15171b', transition: 'height 0.05s linear' }}></i>
                    </div>
                    {/* Master Fader */}
                    <SvgFader value={masterVol} color="#aaa" width={36} height={180} onChange={(v) => setMasterVol(v)} />
                    {/* R Meter */}
                    <div style={{
                        width: '6px', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #0008',
                        background: 'linear-gradient(to top, var(--accent-s25) 0%, var(--accent-s15) 74%, var(--accent) 78%, var(--accent-t15) 88%, var(--accent-t40) 93%, var(--accent-t60) 100%)'
                    }}>
                        <i ref={el => masterRefs.current[1] = el} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '100%', background: '#15171b', transition: 'height 0.05s linear' }}></i>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '22px', fontSize: '9px', color: '#777' }}>
                    <span>L</span><span>R</span>
                </div>

                <button
                    onClick={clearSolos}
                    style={{
                        width: '56px', padding: '5px 0', textAlign: 'center', borderRadius: '5px',
                        border: `1px solid ${isAnySolo ? '#fff3c4' : '#5a4a14'}`,
                        background: isAnySolo ? 'var(--solo)' : '#2a2a2a',
                        color: isAnySolo ? '#3a2c00' : '#6a6a6a',
                        cursor: 'pointer', fontSize: '10px', fontWeight: '700', letterSpacing: '.5px', opacity: isAnySolo ? 1 : 0.5
                    }}
                >
                    SOLO
                </button>
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>OUT</div>
            </div>

            {synthPad != null && window.DrumSynthEditor && ReactDOM.createPortal(
                <window.DrumSynthEditor
                    idx={synthPad}
                    name={(tracks[synthPad] && tracks[synthPad].name) || `Track ${synthPad + 1}`}
                    onClose={() => setSynthPad(null)}
                />,
                document.body
            )}

            {drivePad != null && window.DriveEditor && ReactDOM.createPortal(
                <window.DriveEditor
                    idx={drivePad}
                    name={(tracks[drivePad] && tracks[drivePad].name) || `Track ${drivePad + 1}`}
                    onClose={() => setDrivePad(null)}
                />,
                document.body
            )}

            {larcUnit != null && window.LarcRemote && ReactDOM.createPortal(
                <window.LarcRemote u={larcUnit} onClose={() => setLarcUnit(null)} />,
                document.body
            )}

            {compPad != null && window.CompressorEditor && ReactDOM.createPortal(
                <window.CompressorEditor
                    idx={compPad}
                    name={(tracks[compPad] && tracks[compPad].name) || `Track ${compPad + 1}`}
                    onClose={() => setCompPad(null)}
                />,
                document.body
            )}

            {tapeUnit != null && window.TapeDelayEditor && ReactDOM.createPortal(
                <window.TapeDelayEditor u={tapeUnit} bpm={bpm} onClose={() => setTapeUnit(null)} />,
                document.body
            )}

            {chorusUnit != null && window.ChorusEditor && ReactDOM.createPortal(
                <window.ChorusEditor u={chorusUnit} onClose={() => setChorusUnit(null)} />,
                document.body
            )}
        </div>
    );
};

window.Mixer = Mixer;
