#!/usr/bin/env bash
# Doku-Qualitaetsgate: Pflichtdateien, interne Markdown-Links, YAML-Validitaet.
# Keine App-Pruefung — die folgt erst, wenn App-Code existiert.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/verify-docs.mjs
