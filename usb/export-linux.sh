#!/usr/bin/env bash
# Desktop "Export" — dump the live database to backups/ (USB or ~/Electroshack).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/backup.sh" "$@"
