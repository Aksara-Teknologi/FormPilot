#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/downloads
rm -f public/downloads/formpilot-browser-bridge.zip
zip -rq -X public/downloads/formpilot-browser-bridge.zip extension -x 'extension/.DS_Store'
