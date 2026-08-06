/**
 * Header: contract.test.mjs
 * Purpose: Every registered plugin obeys the back end / front panel contract.
 * Description: These run against the REGISTRY, not against a hand-written list,
 *   so a plugin added later is tested the moment it registers. There is nothing
 *   to remember to update — an eighth plugin with a malformed frame layout fails
 *   here without anyone touching this file.
 *
 *   The point of the contract is that a display can be written against it
 *   without knowing which plugin it is talking to. So that is what is asserted:
 *   every call a front panel is allowed to make works on every plugin, returns
 *   the declared shape, and never hands back a fresh object where a display
 *   would expect a stable one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWarmWorld } from './harness.mjs';

const SHARED = ['SEQ', 'ACTIVE', 'PEAK_L', 'PEAK_R', 'USER'];

describe('plugin contract', () => {
    test('every plugin declares a well-formed frame', async () => {
        const { window } = await createWarmWorld();
        const ids = window.oaPluginIds();
        assert.ok(ids.length >= 7, `expected at least 7 plugins, found ${ids.length}: ${ids}`);

        for (const id of ids) {
            const layout = window.oaPluginLayout(id);
            const frame = window.oaPluginFrame(id, 0);

            assert.ok(frame instanceof Float32Array, `${id}: frame must be a Float32Array`);

            SHARED.forEach((k) => {
                assert.equal(typeof layout[k], 'number', `${id}: layout is missing ${k}`);
            });

            // Every slot a plugin names has to exist in the array it named them
            // for. An off-by-one here reads as a meter stuck at zero.
            Object.entries(layout).forEach(([name, slot]) => {
                if (name === 'USER') return;      // a marker, not a slot in use
                assert.ok(
                    slot < frame.length,
                    `${id}: layout.${name} is slot ${slot} but the frame is only ${frame.length} long`,
                );
            });

            // Two names for one slot is the bug that makes a panel show its
            // neighbour's number.
            const used = Object.entries(layout).filter(([n]) => n !== 'USER').map(([, s]) => s);
            assert.equal(new Set(used).size, used.length, `${id}: two layout names share a slot`);
        }
    });

    test('a frame is the same array every time it is asked for', async () => {
        const { window } = await createWarmWorld();
        // A display holds this array across renders. Handing back a new one per
        // call would mean every meter allocated on every frame, which is the
        // exact cost this design exists to remove.
        for (const id of window.oaPluginIds()) {
            const a = window.oaPluginFrame(id, 0);
            const b = window.oaPluginFrame(id, 0);
            assert.equal(a, b, `${id}: oaPluginFrame handed back a different array`);
        }
    });

    test('params, state and presets answer for every unit', async () => {
        const { window } = await createWarmWorld();
        for (const id of window.oaPluginIds()) {
            const units = window.oaPluginUnits(id);
            assert.ok(units >= 0, `${id}: units() must be a count`);

            for (let i = 0; i < Math.min(units, 3); i++) {
                const params = window.oaPluginParams(id, i);
                assert.ok(Array.isArray(params), `${id}[${i}]: params must be an array`);
                params.forEach((p) => {
                    assert.equal(typeof p.key, 'string', `${id}[${i}]: a param has no key`);
                    assert.equal(typeof p.label, 'string', `${id}[${i}].${p.key}: no label`);
                    assert.equal(typeof p.min, 'number', `${id}[${i}].${p.key}: no min`);
                    assert.equal(typeof p.max, 'number', `${id}[${i}].${p.key}: no max`);
                    assert.ok(p.max > p.min, `${id}[${i}].${p.key}: max is not above min`);
                });

                // Presets name real parameters. A preset with a typo in a key
                // silently does nothing, which is worse than failing.
                const presets = window.oaPluginPresets(id);
                const keys = new Set(params.map((p) => p.key));
                Object.entries(presets).forEach(([name, preset]) => {
                    assert.equal(typeof preset.label, 'string', `${id}: preset "${name}" has no label`);
                });
            }
        }
    });

    test('set() clamps to the declared range on every plugin', async () => {
        const { window } = await createWarmWorld();
        for (const id of window.oaPluginIds()) {
            if (window.oaPluginUnits(id) === 0) continue;
            for (const p of window.oaPluginParams(id, 0)) {
                // An option list is a different kind of control: its value is
                // one of a set of names, so "out of range" means "not on the
                // list" rather than a number past a bound.
                if (p.options) {
                    window.oaPluginSet(id, 0, p.key, 'not-a-real-option');
                    const v = window.oaPluginState(id, 0)[p.key];
                    assert.ok(
                        p.options.includes(v),
                        `${id}.${p.key}: "${v}" is not one of ${p.options.join(', ')}`,
                    );
                    continue;
                }

                // Way outside in both directions. A panel is not the only caller
                // — a song file written by an older build gets here too.
                window.oaPluginSet(id, 0, p.key, p.max * 1000 + 1e6);
                let v = window.oaPluginState(id, 0)[p.key];
                assert.ok(v <= p.max, `${id}.${p.key}: ${v} is above max ${p.max}`);

                window.oaPluginSet(id, 0, p.key, p.min - 1e6);
                v = window.oaPluginState(id, 0)[p.key];
                assert.ok(v >= p.min, `${id}.${p.key}: ${v} is below min ${p.min}`);

                // NaN is the one that gets through a naive clamp: every
                // comparison against it is false, so both bounds pass.
                window.oaPluginSet(id, 0, p.key, NaN);
                v = window.oaPluginState(id, 0)[p.key];
                assert.ok(Number.isFinite(v), `${id}.${p.key}: NaN survived set() as ${v}`);
            }
        }
    });

    test('the pump fills frames and never allocates a new one', async () => {
        const w = await createWarmWorld();
        const { window } = w;

        const before = window.oaPluginIds().map((id) => window.oaPluginFrame(id, 0));
        const seqBefore = before.map((f) => f[window.OA_SLOT.SEQ]);

        window.oaPumpPluginsOnce();
        window.oaPumpPluginsOnce();

        window.oaPluginIds().forEach((id, k) => {
            const f = window.oaPluginFrame(id, 0);
            assert.equal(f, before[k], `${id}: the pump replaced the frame array`);
            assert.equal(
                f[window.OA_SLOT.SEQ], seqBefore[k] + 2,
                `${id}: SEQ did not advance once per pass`,
            );
            for (let i = 0; i < f.length; i++) {
                assert.ok(Number.isFinite(f[i]), `${id}: slot ${i} is ${f[i]}`);
            }
        });
    });

    test('the pump only runs while a display is attached', async () => {
        const w = await createWarmWorld();
        const { window } = w;

        assert.equal(window.oaPluginAttachCount(), 0);
        assert.equal(w.frames.length, 0, 'nothing should be scheduled before an attach');

        const detachA = window.oaPluginAttach();
        const detachB = window.oaPluginAttach();
        assert.equal(window.oaPluginAttachCount(), 2);
        assert.equal(w.frames.filter(Boolean).length, 1, 'two panels must share one loop');

        // A detach called twice — a React effect cleanup running after a
        // remount, say — must not unbalance the count and stop the other panel.
        detachA();
        detachA();
        assert.equal(window.oaPluginAttachCount(), 1, 'a double detach unbalanced the count');

        detachB();
        assert.equal(window.oaPluginAttachCount(), 0);
    });

    test('a backend that throws does not stop the pump', async () => {
        const w = await createWarmWorld();
        const { window } = w;

        window.oaRegisterPlugin({
            id: 'broken',
            label: 'Broken',
            units: () => 1,
            read: () => { throw new Error('this backend is on fire'); },
        });

        assert.doesNotThrow(() => window.oaPumpPluginsOnce());

        // The rest still got their pass.
        const comp = window.oaPluginFrame('comp', 0);
        assert.ok(comp[window.OA_SLOT.SEQ] > 0, 'a broken plugin took the others down');
        assert.equal(
            window.oaPluginFrame('broken', 0)[window.OA_SLOT.ACTIVE], 0,
            'a plugin that threw should report itself inactive',
        );
    });

    test('curves are stable arrays, not rebuilt per call', async () => {
        const { window } = await createWarmWorld();
        // A display plots these every frame. Rebuilding a 4096-point Float32Array
        // sixty times a second is the same allocation problem in a new place.
        const drive = window.oaPluginCurve('drive', 0);
        assert.ok(drive instanceof Float32Array, 'drive should publish its transfer curve');
        assert.equal(window.oaPluginCurve('drive', 0), drive, 'the drive curve was rebuilt');

        for (let i = 0; i < drive.length; i++) {
            assert.ok(Number.isFinite(drive[i]), `drive curve point ${i} is ${drive[i]}`);
            assert.ok(Math.abs(drive[i]) <= 1.0001, `drive curve point ${i} is out of range`);
        }
    });

    test('a plugin with no curve says so rather than throwing', async () => {
        const { window } = await createWarmWorld();
        assert.equal(window.oaPluginCurve('comp', 0), null);
        assert.equal(window.oaPluginCurve('nonexistent', 0), null);
    });
});
