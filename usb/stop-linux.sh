#!/usr/bin/env bash
# Same as pause-linux.sh — stop the server so this PC can be moved.
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/pause-linux.sh"
