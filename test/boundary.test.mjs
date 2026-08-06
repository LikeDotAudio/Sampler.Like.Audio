/**
 * Header: boundary.test.mjs
 * Purpose: Keep the front end and the back end apart, permanently.
 * Description: A separation like this survives exactly as long as something
 *   checks it. Nothing about the code stops an editor from reaching into
 *   ctx.__oaComps again next month — it would work, it would look local and
 *   reasonable in review, and the coupling would be back.
 *
 *   So this reads the display sources and fails if they name anything on the
 *   audio side. It is a lint, not a unit test, and it is the only kind of test
 *   that can defend an architectural boundary rather than a behaviour.
 *
 *   The rule: A FILE THAT DRAWS MAY NOT NAME AN AUDIO NODE.
 *
 *   What a display is allowed to say instead is the short list in
 *   useOaPlugin.js: ask for a frame, read a slot, set a parameter, plot a curve.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every .jsx in the app — the files whose job is to draw. */
const displayFiles = () => {
    const out = [];
    const walk = (dir) => {
        for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) walk(rel);
            else if (e.name.endsWith('.jsx')) out.push(rel);
        }
    };
    walk('libControl');
    return out;
};

/**
 * Things only the audio layer may say.
 *
 * Each entry explains what to do instead, because a bare "forbidden pattern"
 * failure tells whoever hits it that they are wrong without telling them what
 * right looks like.
 */
const FORBIDDEN = [
    {
        re: /__oa(Comps|Reverbs|Delays|Retire|WorkletOk|FxReady)\b/,
        instead: 'the plugin frame — window.useOaFrame(id, idx, …) — not the context\'s private bus lists',
    },
    {
        re: /\bcreate(Gain|Oscillator|BufferSource|BiquadFilter|WaveShaper|Convolver|Delay|StereoPanner|ChannelSplitter|ChannelMerger|DynamicsCompressor|Analyser)\s*\(/,
        instead: 'nothing — a display does not build audio nodes',
    },
    {
        re: /getFloat(TimeDomain|Frequency)Data|getByte(TimeDomain|Frequency)Data/,
        instead: 'frame[LAYOUT.PEAK_L] — the back end measures once for every display',
    },
    {
        re: /\bnew\s+AudioWorkletNode\b|\baudioWorklet\b/,
        instead: 'nothing — worklets are the back end\'s business',
    },
    {
        re: /\.analysers?\b/,
        instead: 'the frame\'s PEAK_L / PEAK_R slots',
    },
];

/**
 * Files that are allowed to hold an AudioContext, because managing audio IS
 * their job. Everything else that draws must go through the plugin interface.
 */
const AUDIO_OWNERS = new Set([
    // Recording from a microphone is device work, not effect work: it has its
    // own stream, its own node chain and no plugin behind it.
    'libControl/SoundBrowser/SoundRecorder.jsx',
    // The level meter on the browser's preview player, likewise — it meters a
    // one-shot audition source that no plugin owns.
    'libControl/SoundBrowser/OaLevelMeter.jsx',
]);

describe('the front end does not reach into the back end', () => {
    test('no display file names an audio node', () => {
        const offences = [];

        for (const file of displayFiles()) {
            if (AUDIO_OWNERS.has(file)) continue;
            const src = readFileSync(join(ROOT, file), 'utf8');

            src.split('\n').forEach((line, i) => {
                // Comments are where this boundary gets explained, so they are
                // allowed to name the thing they are explaining.
                const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
                FORBIDDEN.forEach(({ re, instead }) => {
                    const hit = code.match(re);
                    if (hit) {
                        offences.push(`${file}:${i + 1}  "${hit[0]}"\n      use ${instead}`);
                    }
                });
            });
        }

        assert.deepEqual(
            offences, [],
            `A display is reaching into the audio layer:\n\n    ${offences.join('\n    ')}\n`,
        );
    });

    test('every plugin has a panel that can find it', () => {
        // A backend nobody can open is dead weight, and a panel naming a plugin
        // that does not exist renders nothing and says nothing about why.
        const sources = JSON.parse(readFileSync(join(ROOT, 'sources.json'), 'utf8'));
        const all = sources.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');

        const registered = [...all.matchAll(/oaRegisterPlugin\(\{\s*\n\s*id:\s*'([^']+)'/g)]
            .map((m) => m[1]);
        assert.ok(registered.length >= 7, `only found ${registered.length} registrations: ${registered}`);

        // Every id a display asks for must be one that registers.
        const asked = new Set(
            [...all.matchAll(/(?:useOaFrame|useOaState|useOaParams|useOaCurve|oaPlugin(?:Set|State|Frame|Params|Preset|Presets|Curve|Layout|Units))\(\s*'([^']+)'/g)]
                .map((m) => m[1]),
        );
        asked.forEach((id) => {
            assert.ok(
                registered.includes(id),
                `a panel asks for plugin "${id}", which nothing registers`,
            );
        });
    });

    test('the audio layer does not import React', () => {
        // The other direction of the same boundary. A backend that touches
        // React cannot run in the offline renderer, cannot be tested headlessly,
        // and has quietly become a component.
        const sources = JSON.parse(readFileSync(join(ROOT, 'sources.json'), 'utf8'));
        const backends = sources.filter(
            (f) => f.startsWith('libControl/SoundSynth/') && !f.includes('useOaPlugin'),
        );

        backends.forEach((f) => {
            const src = readFileSync(join(ROOT, f), 'utf8');
            src.split('\n').forEach((line, i) => {
                const code = line.replace(/\/\/.*$/, '');
                assert.ok(
                    !/\bReact\./.test(code),
                    `${f}:${i + 1} — the audio layer is using React: ${line.trim()}`,
                );
            });
        });
    });
});
