#!/usr/bin/env bash
# Start (or reopen) the local Electroshack store server + MongoDB.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
if [[ -f "$INSTALL_ROOT/app-root" ]]; then
  REPO_ROOT="$(cat "$INSTALL_ROOT/app-root")"
elif [[ -f "$HERE/backend/package.json" ]]; then
  REPO_ROOT="$HERE"
elif [[ -f "$HERE/../backend/package.json" ]]; then
  REPO_ROOT="$(cd "$HERE/.." && pwd)"
else
  echo "Could not find the Electroshack app. Run usb/setup-linux.sh first."
  exit 1
fi
if [[ -d "$HERE/usb" ]]; then USB_DIR="$HERE/usb"; elif [[ -f "$HERE/credentials.env" ]]; then USB_DIR="$HERE"; else USB_DIR="$REPO_ROOT/usb"; fi
BACKEND_DIR="$REPO_ROOT/backend"
MONGO_DIR="$INSTALL_ROOT/mongodb"
TOOLS_DIR="$INSTALL_ROOT/dbtools"
DATA_DIR="$INSTALL_ROOT/data"
LOG_DIR="$INSTALL_ROOT/logs"
BIN_DIR="$INSTALL_ROOT/bin"
TMUX_CONF="/exec-daemon/tmux.portal.conf"

mkdir -p "$DATA_DIR" "$LOG_DIR" "$BIN_DIR"
export PATH="$BIN_DIR:$MONGO_DIR/bin:$TOOLS_DIR/bin:$PATH"

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

session_alive() {
  tmux_cmd has-session -t "=$1" 2>/dev/null
}

port_open() {
  (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1
}

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  if [[ -f "$USB_DIR/credentials.env" ]]; then
    cp "$USB_DIR/credentials.env" "$BACKEND_DIR/.env"
  else
    echo "backend/.env is missing. Run usb/setup-linux.sh first."
    exit 1
  fi
fi

if ! command -v mongod >/dev/null 2>&1; then
  echo "mongod not found. Run usb/setup-linux.sh first."
  exit 1
fi

if ! port_open 27017; then
  echo "Starting MongoDB..."
  if session_alive electroshack-mongo; then
    tmux_cmd kill-session -t "=electroshack-mongo" 2>/dev/null || true
  fi
  tmux_cmd new-session -d -s "electroshack-mongo" -c "$DATA_DIR" -- \
    mongod --dbpath "$DATA_DIR" --bind_ip 127.0.0.1 --port 27017 --logpath "$LOG_DIR/mongod.log"
  for _ in $(seq 1 45); do
    if port_open 27017; then
      break
    fi
    sleep 1
  done
  if ! port_open 27017; then
    echo "MongoDB did not open port 27017. See $LOG_DIR/mongod.log"
    exit 1
  fi
  echo "MongoDB is listening on 27017"
else
  echo "MongoDB is already running."
fi

if port_open 5000; then
  echo "Electroshack is already running on http://localhost:5000"
  exit 0
fi

echo "Starting Electroshack backend..."
if session_alive electroshack-backend; then
  tmux_cmd kill-session -t "=electroshack-backend" 2>/dev/null || true
fi
tmux_cmd new-session -d -s "electroshack-backend" -c "$BACKEND_DIR" -- \
  bash -lc "node server.js >> \"$LOG_DIR/backend.log\" 2>&1"

for _ in $(seq 1 30); do
  if port_open 5000; then
    echo "Database is up. Opening https://electroshack.ca"
    echo "To pause before moving this PC: $INSTALL_ROOT/PAUSE.sh"
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "https://electroshack.ca" >/dev/null 2>&1 || true
    fi
    exit 0
  fi
  sleep 1
done

echo "Server did not open port 5000. See $LOG_DIR/backend.log"
tail -n 40 "$LOG_DIR/backend.log" || true
exit 1
