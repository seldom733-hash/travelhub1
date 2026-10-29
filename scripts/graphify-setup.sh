#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv-graphify"
GRAPHIFY="$VENV/bin/graphify"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi

if [ ! -x "$GRAPHIFY" ]; then
  "$VENV/bin/pip" install --disable-pip-version-check "graphifyy[sql]"
fi

if [ "${1:-}" = "--rebuild" ] || [ ! -f "$ROOT/graphify-out/graph.json" ]; then
  "$GRAPHIFY" update . --force
else
  echo "Graph already exists. Pass --rebuild to refresh it."
fi

echo "Ready: $GRAPHIFY"
