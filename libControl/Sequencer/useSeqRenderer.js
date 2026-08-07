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

// yyyymmddhhmm, in local time, for the front of a rendered filename. Every
// bounce of the same pattern otherwise lands on the same name and the browser
// quietly files them as "beat.wav", "beat (1).wav", "beat (2).wav" — which
// sorts by nothing and tells you nothing about which take is which. With the
// stamp first, the folder sorts itself into the order the takes were made.
//
// Local time rather than UTC on purpose: it has to agree with the clock on the
// wall of the room the take was rendered in, which is the only thing anyone
// reads it against. Minutes is the finest it goes — two bounces inside the same
// minute are the same session, and the browser's own suffix separates them.
const oaRenderStamp = () => {
    const d = new Date();
    const p2 = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
         + `${p2(d.getHours())}${p2(d.getMinutes())}`;
};

window.useSeqRenderer = (pattern, steps, mutes, bpm, safeLabel) => {
    const [rendering, setRendering] = React.useState(false);
    const velOf = (c) => (typeof c === 'number' ? c : (c ? 100 : 0));

    // How many times the pattern is laid down. One for a single loop to drop
    // into a DAW, eight for something long enough to play against.
    const renderLoop = async (loops = 1) => {
        const LOOPS = Math.max(1, loops | 0);
        setRendering(true);
        try {
            const secPerStep = 0.25 * 60 / (bpm || 120);   // 16th note
            const totalSteps = steps * LOOPS;
            const dur = totalSteps * secPerStep;
            // The app's rate — the bounce has to print the same tape head
            // spacing and reverb tail the user was monitoring.
            const rate = window.oaSampleRate();
            const tailSec = 2.0;
            const offline = window.oaOfflineContext(2, dur + tailSec, rate);
            const TRACKS = window.OA_DRUM_KIT || [];

            // Reverbs and tape delays print with the pattern. The tape worklet
            // has to be registered on THIS context before any voice asks for a
            // send, because scheduling and rendering happen in one tick.
            if (window.oaWarmFx) { try { await window.oaWarmFx(offline); } catch (e) {} }

            for (let step = 0; step < totalSteps; step++) {
                const t = step * secPerStep;
                pattern.forEach((track, trkIdx) => {
                    const v = velOf(track[step % steps]);
                    if (v > 0 && !mutes[trkIdx]) {
                        const vol = v / 100;
                        const entry = window.OA_DRUM_SAMPLES && window.OA_DRUM_SAMPLES[trkIdx];
                        if (entry && entry.buffer && window.oaPlayDrumSample) window.oaPlayDrumSample(offline, Object.assign({}, entry, { loop: false }), t, vol);
                        else if (window.oaPlayDrumVoice) window.oaPlayDrumVoice(offline, { idx: trkIdx }, t, vol);
                    }
                });
            }
            const rendered = await offline.startRendering();
            const loopLen = Math.max(1, Math.round(dur * rate));
            const loopBuf = window.oaAudioCtx().createBuffer(2, loopLen, rate);
            for (let ch = 0; ch < 2; ch++) {
                const src = rendered.getChannelData(ch);
                const dst = loopBuf.getChannelData(ch);
                for (let i = 0; i < loopLen; i++) dst[i] = src[i] || 0;
                for (let j = 0; j + loopLen < src.length && j < loopLen; j++) dst[j] += src[loopLen + j]; // wrap tail
            }
            const blob = new Blob([window.oaEncodeWav(loopBuf)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            // Stamped here rather than at the top of the render, so the name
            // agrees with the file's own modified time once it is on disk.
            a.href = url;
            a.download = `${oaRenderStamp()}_${safeLabel}_${bpm}bpm_${steps}steps_x${LOOPS}.wav`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) { console.error('🛑 [Sequencer] render failed:', e); }
        setRendering(false);
    };

    return { rendering, renderLoop };
};
