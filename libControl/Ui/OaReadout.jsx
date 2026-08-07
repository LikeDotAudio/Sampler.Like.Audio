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

/**
 * Header: OaReadout.jsx
 * Purpose: The big value overlay that stands beside a control while it is moving.
 * Description: The sequencer grid has had one of these from the start — hold a
 *   step and a large VELOCITY column appears next to your finger. It exists
 *   because on a phone the thing being adjusted is underneath the hand adjusting
 *   it, and an 8px number engraved under a knob is unreadable at the moment it
 *   matters most. Every other control on the desk had the same problem and none
 *   of them said anything.
 *
 *   So the sequencer's overlay is generalised here and every control shares it.
 *   A control calls useOaReadout() with what it would like shown and reports the
 *   pointer once, at the start of the drag; the hook watches the window for the
 *   rest. That last part is the important one — the release is caught on the
 *   window in the capture phase, so however a control handles pointer capture,
 *   and wherever the finger ends up when it lifts, the overlay cannot be left
 *   stranded on screen.
 *
 *   ONE overlay exists, not one per control: the value lives in a module
 *   variable and the component subscribes to it, so a knob mid-drag can push a
 *   new reading without owning the thing that draws it.
 */

let CURRENT = null;
const SUBS = new Set();
const publish = () => { SUBS.forEach((fn) => fn(CURRENT)); };

/** Show/replace the reading. `info` is { label, display, pct, color, bipolar, x, y }. */
window.oaReadoutShow = function (info) { CURRENT = info; publish(); };

/**
 * Take it down. Safe to call when nothing is up. Pass the `owner` a control was
 * publishing under and the reading only comes down if it is still that control's
 * — a knob unmounting somewhere else on the page (a strip re-keyed, a panel
 * closed) must not pull the reading out from under the finger that is dragging.
 */
window.oaReadoutHide = function (owner) {
    if (!CURRENT) return;
    if (owner && CURRENT.owner !== owner) return;
    CURRENT = null;
    publish();
};

/**
 * Attach a readout to one control.
 *
 * `info` is re-read on every render, so a control that redraws as its value
 * changes — which is all of them — updates the overlay for free. All a control
 * has to do is call begin() when its drag starts.
 */
window.useOaReadout = function (info) {
    const [at, setAt] = React.useState(null);
    // This control's identity, so it can only ever take down its own reading.
    const me = React.useRef({});

    // No dependency array on purpose. While a drag is live the value changes on
    // every render and the overlay has to follow it; the rest of the time `at`
    // is null and this does nothing.
    React.useEffect(() => {
        if (at) window.oaReadoutShow({ ...info, owner: me, x: at.x, y: at.y });
    });

    React.useEffect(() => {
        if (!at) return undefined;
        const move = (e) => setAt({ x: e.clientX, y: e.clientY });
        const end = () => { setAt(null); window.oaReadoutHide(me); };
        // Capture phase, on the window: a control that captured the pointer
        // delivers its own pointerup to itself, and one that did not may see the
        // release land on some other element entirely. Listening here catches
        // both, which is what keeps the overlay from sticking.
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', end, true);
        return () => {
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            window.removeEventListener('pointercancel', end, true);
        };
    }, [!!at]);

    // A panel closed under the finger would otherwise leave its reading up.
    React.useEffect(() => () => window.oaReadoutHide(me), []);

    return {
        begin: (e) => setAt({ x: e.clientX, y: e.clientY }),
        end: () => { setAt(null); window.oaReadoutHide(me); },
    };
};

/**
 * The overlay itself. Mounted once, by App — it is one panel for the whole desk,
 * not one per control.
 */
window.OaReadout = () => {
    const [info, setInfo] = React.useState(CURRENT);
    React.useEffect(() => {
        SUBS.add(setInfo);
        setInfo(CURRENT);
        return () => { SUBS.delete(setInfo); };
    }, []);

    if (!info) return null;

    const pct = Math.max(0, Math.min(100, Number(info.pct) || 0));
    const color = info.color || 'var(--accent)';
    // A bipolar control fills from the centre out, the way a pan pot's own arc
    // does. Filling from the bottom would say "hard left is empty".
    const fill = info.bipolar
        ? { bottom: `${Math.min(50, pct)}%`, height: `${Math.abs(pct - 50)}%` }
        : { bottom: 0, height: `${pct}%` };

    const panel = (
        <div style={{
            position: 'fixed', zIndex: 10000, pointerEvents: 'none',
            // Beside the finger, never under it, and never off the edge.
            left: Math.min(info.x + 16, window.innerWidth - 108),
            top: Math.min(Math.max(info.y - 130, 8), window.innerHeight - 260),
            minWidth: '78px', maxWidth: '150px',
            background: '#1c1c1c', border: '1px solid var(--accent)', borderRadius: '6px',
            padding: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
        }}>
            <div style={{
                fontSize: '20px', fontWeight: 'bold', color, lineHeight: 1,
                whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'
            }}>
                {info.display}
            </div>
            <div style={{
                position: 'relative', width: '30px', height: '200px', background: '#0a0a0a',
                border: '1px solid #444', borderRadius: '3px', overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', left: 0, right: 0, ...fill,
                    background: `linear-gradient(to top, color-mix(in srgb, ${color} 55%, #000), ${color})`
                }} />
                <div style={{
                    position: 'absolute', left: '-2px', right: '-2px',
                    bottom: `calc(${pct}% - 2px)`, height: '4px', background: '#fff', borderRadius: '1px'
                }} />
            </div>
            {info.label ? (
                <div style={{
                    fontSize: '9px', color: '#888', letterSpacing: '0.5px',
                    textAlign: 'center', lineHeight: 1.25
                }}>
                    {String(info.label).toUpperCase()}
                </div>
            ) : null}
        </div>
    );

    // Portalled to <body>: several panels that carry knobs are themselves
    // transformed (translateX(-50%) to centre them), and a fixed child inside a
    // transformed ancestor is positioned against THAT box rather than the
    // viewport — the overlay would land somewhere near the panel instead of
    // near the finger.
    return ReactDOM.createPortal(panel, document.body);
};
