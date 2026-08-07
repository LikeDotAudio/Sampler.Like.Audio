#!/usr/bin/env bash

# ─── Sampler.Like.Audio ──────────────────────────────────────────────────────
# https://Sampler.Like.audio · Written by Anthony P. Kuzub · i @ Like . audio
#
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
#
# Every visual representation in this project is an HOMAGE to classic hardware.
# There is no affiliation with, or endorsement by, any of the original designers
# or manufacturers; their layouts appear here only because they are familiar
# interfaces, and every name they are known by remains the property of its owner.
# ─────────────────────────────────────────────────────────────────────────────
# Compile the .jsx/.js sources into dist/app.js. Run this after editing anything
# under libControl/ so your local copy of the app matches your sources.
#
# The plugin tests under test/ run FIRST and a failure stops the build before
# anything is written, so a red test leaves the last good bundle in place rather
# than replacing it with a broken one. `npm test` runs them on their own.
#
# Do NOT commit dist/ — it is gitignored. CI builds it fresh on every push to
# main and uploads that build to the site (.github/workflows/deploy.yml), so the
# only thing that needs committing is the source you changed.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules/@babel/core ]; then
  echo "Installing build dependencies (one time)…"
  npm install --silent
fi

node build.mjs "$@"
