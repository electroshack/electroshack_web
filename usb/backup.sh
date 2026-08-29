#!/usr/bin/env bash
set -euo pipefail

USB_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$USB_DIR/.." && pwd)"
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
export PATH="$INSTALL_ROOT/bin:$INSTALL_ROOT/mongodb/bin:$INSTALL_ROOT/dbtools/bin:$PATH"
BACKUP_ROOT="$REPO_ROOT/backups"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP_DIR="$BACKUP_ROOT/dump-$STAMP"
ZIP_PATH="$BACKUP_ROOT/electroshack-$STAMP.zip"

mkdir -p "$BACKUP_ROOT"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not found. Install MongoDB Database Tools first."
  exit 1
fi

echo "Dumping electroshack database to $DUMP_DIR"
mongodump --uri "mongodb://127.0.0.1:27017/electroshack" --out "$DUMP_DIR"

if command -v zip >/dev/null 2>&1; then
  (cd "$BACKUP_ROOT" && zip -r "electroshack-$STAMP.zip" "dump-$STAMP")
  rm -rf "$DUMP_DIR"
  echo "Backup saved to $ZIP_PATH"
else
  echo "zip not found. Uncompressed dump left at $DUMP_DIR"
fi
