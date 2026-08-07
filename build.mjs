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
 * Build: compile every source in sources.json into one dist/app.js.
 *
 * The app used to ship its .jsx files raw and let Babel-standalone compile them
 * in the browser on every load — 2.4MB of compiler plus ~1.3s of CPU before a
 * single pad appeared. This does that work once, here.
 *
 *   node build.mjs            compile
 *   node build.mjs --check    exit 1 if dist/app.js is stale (used by CI)
 *
 * Sources stay as .jsx and are edited normally; only the output is generated.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { transformSync } from '@babel/core';

const SOURCES = JSON.parse(readFileSync('sources.json', 'utf8'));
const OUT = 'dist/app.js';
const check = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// The tests run BEFORE the compile, and a failure means no bundle.
//
// The alternative — build first, test separately, notice later — is how a
// broken bundle reaches the site: the deploy workflow's only gate is that
// `node build.mjs` exits zero, so if compiling is all this does, compiling is
// all that is ever checked. Anything that still parses gets shipped.
//
// So the gate lives here, where it cannot be walked around by running the
// build a different way. Every plugin's test pattern is under test/ and they
// take about a second between them.
//
//   node build.mjs --skip-tests   compile without the gate
//
// which exists for bisecting a bad commit and for nothing else. It prints a
// warning every time so it cannot quietly become the normal way to build.
// ---------------------------------------------------------------------------
const runTests = () => {
    if (process.argv.includes('--skip-tests')) {
        console.warn('⚠️  --skip-tests: compiling WITHOUT running the plugin tests.');
        return;
    }
    if (!existsSync('test')) return;

    // Explicit filenames, not a glob. `node --test 'test/**/*.test.mjs'` reads
    // well and works on this machine, but glob patterns only reach the test
    // runner in Node 22 — an older one takes the pattern for a literal filename
    // and reports "Could not find", which is a green suite locally and a red
    // build in CI, over a Node version nobody thought to look at. Listing the
    // directory costs a millisecond and cannot do that.
    const files = readdirSync('test')
        .filter((f) => f.endsWith('.test.mjs'))
        .sort()
        .map((f) => `test/${f}`);
    if (!files.length) return;

    console.log(`• running plugin tests… (${files.length} files)`);
    const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });

    if (r.error) {
        console.error(`✗ could not run the tests: ${r.error.message}`);
        process.exit(1);
    }
    if (r.status !== 0) {
        console.error('');
        console.error('✗ Tests failed — dist/ was NOT rebuilt, so the last good bundle is untouched.');
        console.error('  Fix the failures above, or run with --skip-tests if you know why.');
        process.exit(r.status || 1);
    }
    console.log('✓ tests pass');
};

// A hash of every input; stamped into the bundle so --check can tell whether
// the committed output still matches the sources without recompiling blind.
const fingerprint = createHash('sha256');
for (const f of SOURCES) fingerprint.update(f).update(readFileSync(f));
const stamp = fingerprint.digest('hex').slice(0, 16);

if (check) {
  if (!existsSync(OUT)) {
    console.error('✗ dist/app.js is missing — run: ./build.sh');
    process.exit(1);
  }
  const built = readFileSync(OUT, 'utf8');
  if (!built.includes(`OA_BUILD_STAMP="${stamp}"`)) {
    console.error('✗ dist/app.js is STALE — sources changed since it was built.');
    console.error('  Run ./build.sh and commit the result.');
    process.exit(1);
  }
  console.log(`✓ dist/app.js is up to date (${stamp})`);
  process.exit(0);
}

// Nothing is written until this returns.
runTests();

// Human-readable release stamp shown in the footer: VYYYYMMDD.HHMM in UTC.
//
// Taken from the last COMMIT that touched a source file, not from the clock.
// Wall-clock time made every machine produce a different bundle, so CI's
// rebuild-and-commit step (.github/workflows/build.yml) saw a diff on every
// run and pushed a "Build: recompile dist/" commit after each push, forever.
// Keyed to the sources, the same commit always builds the same bytes, and a
// push that changes no source leaves the stamp alone.
const p2 = (n) => String(n).padStart(2, '0');
const stampFrom = (date) =>
  `V${date.getUTCFullYear()}${p2(date.getUTCMonth() + 1)}${p2(date.getUTCDate())}`
  + `.${p2(date.getUTCHours())}${p2(date.getUTCMinutes())}`;

let version;
try {
  // %cI = committer date, ISO-8601. Limited to the compiled sources plus this
  // script, so a README or workflow edit does not bump the release stamp.
  const iso = execFileSync(
    'git', ['log', '-1', '--format=%cI', '--', ...SOURCES, 'build.mjs', 'sources.json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();
  version = iso ? stampFrom(new Date(iso)) : stampFrom(new Date());
} catch (e) {
  // No git (a source tarball, a stripped CI image) — fall back to build time.
  version = stampFrom(new Date());
}

// ---------------------------------------------------------------------------
// The licence banner
//
// Every source file carries it, which is right: a file that gets copied out of
// this repo on its own should take its licence and its attribution with it.
// Ninety copies of the same ten lines inside ONE bundle is a different question
// — it is sixty kilobytes of identical text on every page load, and a reader
// who opens dist/app.js scrolls past the same notice ninety times.
//
// So the concatenation lifts it out of each file and the bundle carries one, at
// the top, where it is actually read. The MIT requirement is that the notice
// travels with the copy; it says nothing about saying it ninety times.
// ---------------------------------------------------------------------------
const BANNER_RE = /^\/\/ ─+ Sampler\.Like\.Audio ─+\r?\n(?:\/\/[^\n]*\r?\n)*?\/\/ ─+\r?\n\r?\n?/;

const BANNER = `/*
 * ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
 * https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
 *
 * MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
 *
 * Every visual representation in this project is an HOMAGE to classic hardware.
 * There is no affiliation with, or endorsement by, any of the original designers
 * or manufacturers; their layouts appear here only because they are familiar
 * interfaces, and every name they are known by remains the property of its owner.
 * ─────────────────────────────────────────────────────────────────────────────
 */`;

const parts = [
  BANNER,
  '/* GENERATED by build.mjs — do not edit. Edit the .jsx/.js sources instead. */',
  `window.OA_BUILD_STAMP="${stamp}";`,
  `window.OA_BUILD_VERSION="${version}";`,
  '(function(){"use strict";',
];

let jsx = 0, plain = 0, bytesIn = 0;
for (const file of SOURCES) {
  const raw = readFileSync(file, 'utf8');
  bytesIn += raw.length;
  // Stripped here, emitted once above.
  const code = raw.replace(BANNER_RE, '');
  let out = code;
  if (file.endsWith('.jsx')) {
    out = transformSync(code, {
      filename: file,
      presets: [['@babel/preset-react', { runtime: 'classic' }]],
      compact: false,
      babelrc: false,
      configFile: false,
    }).code;
    jsx++;
  } else {
    plain++;
  }
  // Each file gets its own scope, exactly as the separate <script> tags gave
  // it. Without this, top-level `const`s in different files collide — several
  // declare the same helper names. Cross-file sharing is via window.* only.
  parts.push(`\n/* ---- ${file} ---- */`);
  parts.push('(function(){');
  parts.push(out);
  parts.push('})();');
}
parts.push('})();');

mkdirSync('dist', { recursive: true });
const bundle = parts.join('\n');
writeFileSync(OUT, bundle);

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`✓ ${OUT}  ${jsx} jsx + ${plain} js  ${kb(bytesIn)} in -> ${kb(bundle.length)} out  [${stamp}] ${version}`);

// ---------------------------------------------------------------------------
// Precache manifest: everything the running machine can possibly need, so the
// service worker can hold the whole thing and never touch the network again.
// ---------------------------------------------------------------------------
const walk = (dir, hit = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, hit);
    else hit.push(p);
  }
  return hit;
};

const precache = [
  './',
  './index.html',
  './manifest.json',
  './dist/app.js',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  ...walk('ICON and LOGO').map((p) => `./${p}`),
  ...(existsSync('SampleLibrary') ? walk('SampleLibrary') : [])
    .filter((p) => /\.(wav|mp3|ogg|flac)$/i.test(p))
    .map((p) => `./${p.split('/').map(encodeURIComponent).join('/')}`),
];

writeFileSync('dist/precache.json', JSON.stringify(precache, null, 1));
const bytes = precache
  .filter((p) => p !== './')
  .reduce((a, p) => {
    try { return a + statSync(decodeURIComponent(p.slice(2))).size; } catch (e) { return a; }
  }, 0);
console.log(`✓ dist/precache.json  ${precache.length} entries, ${kb(bytes)} held in cache`);
