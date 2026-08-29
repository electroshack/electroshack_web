#!/usr/bin/env bash
set -euo pipefail

USB_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$USB_DIR/.." && pwd)"
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
export PATH="$INSTALL_ROOT/bin:$INSTALL_ROOT/mongodb/bin:$INSTALL_ROOT/dbtools/bin:$PATH"
BACKUP_ROOT="$REPO_ROOT/backups"
BACKUP_ZIP="${1:-}"

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "mongorestore not found. Install MongoDB Database Tools first."
  exit 1
fi

if [ -z "$BACKUP_ZIP" ]; then
  BACKUP_ZIP="$(ls -1t "$BACKUP_ROOT"/electroshack-*.zip 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$BACKUP_ZIP" ] || [ ! -f "$BACKUP_ZIP" ]; then
  echo "No zip backup found in $BACKUP_ROOT"
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
unzip -q "$BACKUP_ZIP" -d "$TEMP_DIR"
DUMP_DIR="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

echo "Restoring $DUMP_DIR into mongodb://127.0.0.1:27017/electroshack"
mongorestore --uri "mongodb://127.0.0.1:27017/electroshack" --drop "$DUMP_DIR"
rm -rf "$TEMP_DIR"
echo "Restore complete from $BACKUP_ZIP"
