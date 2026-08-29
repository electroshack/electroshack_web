#!/usr/bin/env bash
# Local store-PC setup for Linux (this machine is the database server).
# Does not clone GitHub. Uses the USB/project copy next to this script.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$HERE/backend/package.json" ]]; then
  REPO_ROOT="$HERE"
  if [[ -d "$HERE/usb" ]]; then USB_DIR="$HERE/usb"; else USB_DIR="$HERE"; fi
elif [[ -f "$HERE/../backend/package.json" ]]; then
  USB_DIR="$HERE"
  REPO_ROOT="$(cd "$HERE/.." && pwd)"
else
  echo "Could not find backend/package.json. Copy the whole Electroshack folder (backend, client, usb) onto this machine."
  exit 1
fi
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
MONGO_DIR="$INSTALL_ROOT/mongodb"
TOOLS_DIR="$INSTALL_ROOT/dbtools"
DATA_DIR="$INSTALL_ROOT/data"
LOG_DIR="$INSTALL_ROOT/logs"
BIN_DIR="$INSTALL_ROOT/bin"
BACKEND_DIR="$REPO_ROOT/backend"
CLIENT_DIR="$REPO_ROOT/client"
LOG_FILE="$INSTALL_ROOT/install.log"

mkdir -p "$INSTALL_ROOT" "$MONGO_DIR" "$TOOLS_DIR" "$DATA_DIR" "$LOG_DIR" "$BIN_DIR"

log() {
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S')  $*"
  echo "$line" | tee -a "$LOG_FILE"
}

wait_port() {
  local port="$1"
  local seconds="${2:-90}"
  local i
  for ((i=0; i<seconds; i+=2)); do
    if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

CREDENTIALS=""
for candidate in "$USB_DIR/credentials.env" "$REPO_ROOT/usb/credentials.env" "$REPO_ROOT/credentials.env"; do
  if [[ -f "$candidate" ]]; then CREDENTIALS="$candidate"; break; fi
done
if [[ -z "$CREDENTIALS" ]]; then
  echo "usb/credentials.env is missing."
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js + npm are required. Install Node 20+ LTS, then run this script again."
  exit 1
fi

log "Electroshack Linux setup started"
log "USB/project folder: $REPO_ROOT"
log "Install root: $INSTALL_ROOT"
log "Node $(node -v)"

# Copy USB credentials as-is. Do not expand — ADMIN_PASSWORD contains $.
cp "$CREDENTIALS" "$BACKEND_DIR/.env"
cp "$CREDENTIALS" "$INSTALL_ROOT/.env"
log "Copied USB credentials into backend/.env"

npm_retry() {
  local label="$1"
  shift
  local attempt
  for attempt in 1 2 3; do
    log "$label (attempt $attempt)"
    if "$@"; then
      return 0
    fi
    sleep 8
  done
  echo "$label failed after 3 tries. This PC needs internet for the first install."
  exit 1
}

npm_retry "backend npm install" bash -lc "cd \"$BACKEND_DIR\" && npm install --omit=dev"
npm_retry "client npm install" bash -lc "cd \"$CLIENT_DIR\" && npm install"
log "Building client"
(cd "$CLIENT_DIR" && npm run build)

install_mongodb() {
  if [[ -x "$MONGO_DIR/bin/mongod" ]]; then
    return 0
  fi
  log "Installing MongoDB Community 8.0 into $MONGO_DIR"
  local tgz="${MONGODB_TGZ:-/tmp/mongodb.tgz}"
  if [[ ! -f "$tgz" ]]; then
    curl -fsSL -o "$tgz" "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2404-8.0.15.tgz"
  fi
  tar -xzf "$tgz" -C "$MONGO_DIR" --strip-components=1
}

install_dbtools() {
  if [[ -x "$TOOLS_DIR/bin/mongodump" ]]; then
    return 0
  fi
  log "Installing MongoDB Database Tools into $TOOLS_DIR"
  local tgz="${DBTOOLS_TGZ:-/tmp/dbtools.tgz}"
  if [[ ! -f "$tgz" ]]; then
    curl -fsSL -o "$tgz" "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2404-x86_64-100.12.2.tgz"
  fi
  tar -xzf "$tgz" -C "$TOOLS_DIR" --strip-components=1
}

install_mongodb
install_dbtools

ln -sfn "$MONGO_DIR/bin/mongod" "$BIN_DIR/mongod"
ln -sfn "$TOOLS_DIR/bin/mongodump" "$BIN_DIR/mongodump"
ln -sfn "$TOOLS_DIR/bin/mongorestore" "$BIN_DIR/mongorestore"
export PATH="$BIN_DIR:$MONGO_DIR/bin:$TOOLS_DIR/bin:$PATH"

START_SH="$USB_DIR/start-linux.sh"
PAUSE_SH="$USB_DIR/pause-linux.sh"
STOP_SH="$USB_DIR/stop-linux.sh"
[[ -f "$START_SH" ]] || START_SH="$HERE/start-linux.sh"
[[ -f "$START_SH" ]] || START_SH="$HERE/START.sh"
[[ -f "$PAUSE_SH" ]] || PAUSE_SH="$HERE/pause-linux.sh"
[[ -f "$PAUSE_SH" ]] || PAUSE_SH="$HERE/PAUSE.sh"
[[ -f "$STOP_SH" ]] || STOP_SH="$HERE/stop-linux.sh"
[[ -f "$STOP_SH" ]] || STOP_SH="$HERE/STOP.sh"
cp "$START_SH" "$INSTALL_ROOT/START.sh"
cp "$PAUSE_SH" "$INSTALL_ROOT/PAUSE.sh"
cp "$STOP_SH" "$INSTALL_ROOT/STOP.sh"
chmod +x "$INSTALL_ROOT/START.sh" "$INSTALL_ROOT/PAUSE.sh" "$INSTALL_ROOT/STOP.sh"
cat > "$INSTALL_ROOT/app-root" <<EOF
$REPO_ROOT
EOF

log "Starting MongoDB + Electroshack"
"$START_SH"

log "Creating admin login from USB credentials"
admin_ok=0
for attempt in 1 2 3; do
  if (cd "$BACKEND_DIR" && node scripts/resetAdminPassword.js); then
    admin_ok=1
    break
  fi
  log "Admin reset failed (attempt $attempt), waiting for Mongo..."
  sleep 5
done
if [[ "$admin_ok" -ne 1 ]]; then
  echo "Admin password reset failed. Is MongoDB running? See $LOG_FILE"
  exit 1
fi

if wait_port 5000 60; then
  log "Server is up on port 5000"
else
  log "WARNING: port 5000 not ready yet. See $LOG_DIR/backend.log"
fi

log "Setup finished. Database lives in $DATA_DIR"
echo
echo "Open http://localhost:5000"
echo "Admin login is in usb/README.txt"
echo "To pause before moving this PC: $INSTALL_ROOT/PAUSE.sh  (or usb/pause-linux.sh)"
echo
