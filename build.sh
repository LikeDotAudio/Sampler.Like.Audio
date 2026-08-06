#!/usr/bin/env bash
# Compile the .jsx/.js sources into dist/app.js. Run this after editing anything
# under libControl/ so your local copy of the app matches your sources.
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
