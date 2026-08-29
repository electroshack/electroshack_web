#!/usr/bin/env bash
set -euo pipefail

USB_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$USB_DIR/../backend/package.json" ]]; then
  REPO_ROOT="$(cd "$USB_DIR/.." && pwd)"
elif [[ -f "$USB_DIR/backend/package.json" ]]; then
  REPO_ROOT="$USB_DIR"
else
  REPO_ROOT="$(cd "$USB_DIR/.." && pwd)"
fi
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
export PATH="$INSTALL_ROOT/bin:$INSTALL_ROOT/mongodb/bin:$INSTALL_ROOT/dbtools/bin:$PATH"
BACKUP_ROOT="$REPO_ROOT/backups"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP_DIR="$BACKUP_ROOT/dump-$STAMP"
ZIP_PATH="$BACKUP_ROOT/electroshack-$STAMP.zip"

mkdir -p "$BACKUP_ROOT"

# Read KEY=value from a dotenv file without expanding $ in passwords.
env_get() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  python3 - "$file" "$key" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
for raw in open(path, encoding="utf-8", errors="replace"):
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k.strip() == key:
        print(v.strip().strip('"').strip("'"), end="")
        break
PY
}

URI="${MONGODB_URI:-}"
if [[ -z "$URI" ]]; then
  for f in \
    "$INSTALL_ROOT/.env" \
    "$REPO_ROOT/backend/.env" \
    "$USB_DIR/credentials.env"; do
    val="$(env_get "$f" MONGODB_URI || true)"
    if [[ -n "${val:-}" ]]; then
      URI="$val"
      break
    fi
  done
fi
# Prefer the database actually running on this PC.
if (echo >/dev/tcp/127.0.0.1/27017) >/dev/null 2>&1; then
  URI="mongodb://127.0.0.1:27017/electroshack"
fi
URI="${URI:-mongodb://127.0.0.1:27017/electroshack}"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump not found. Install MongoDB Database Tools first."
  exit 1
fi

echo "Dumping database to $DUMP_DIR"
mongodump --uri "$URI" --out "$DUMP_DIR"

if command -v zip >/dev/null 2>&1; then
  (cd "$BACKUP_ROOT" && zip -r "electroshack-$STAMP.zip" "dump-$STAMP")
  rm -rf "$DUMP_DIR"
  echo "Backup saved to $ZIP_PATH"
else
  echo "zip not found. Uncompressed dump left at $DUMP_DIR"
fi
