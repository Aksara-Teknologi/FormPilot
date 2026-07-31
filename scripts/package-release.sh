#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
artifact_dir="$project_dir/artifacts"

mkdir -p "$artifact_dir"
rm -f "$artifact_dir/formpilot-browser-bridge.zip" "$artifact_dir/formpilot-site.tar.gz"

(
  cd "$project_dir/extension"
  zip -q -r "$artifact_dir/formpilot-browser-bridge.zip" manifest.json service-worker.js formpilot-bridge.js README.md
)

(
  cd "$project_dir"
  tar -czf "$artifact_dir/formpilot-site.tar.gz" dist .openai/hosting.json drizzle
)

echo "Release artifacts created in $artifact_dir"
