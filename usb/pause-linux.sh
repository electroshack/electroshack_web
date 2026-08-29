#!/usr/bin/env bash
# Pause Electroshack so this PC can be shut down and moved.
# The database stays on disk. Nothing is deleted.
set -euo pipefail

INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
LOG_DIR="$INSTALL_ROOT/logs"
TMUX_CONF="/exec-daemon/tmux.portal.conf"

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

echo "Pausing Electroshack on this PC..."
echo "The database stays on disk. Nothing is deleted."
echo "Use usb/start-linux.sh (or $INSTALL_ROOT/START.sh) when the PC is at the store."
echo

tmux_cmd kill-session -t "=electroshack-backend" 2>/dev/null || true
tmux_cmd kill-session -t "=electroshack-mongo" 2>/dev/null || true

# Catch processes started outside tmux as well.
pkill -f "$INSTALL_ROOT/data" -u "$(id -un)" 2>/dev/null || true
pgrep -af "mongod --dbpath $INSTALL_ROOT/data" >/dev/null 2>&1 && pkill -f "mongod --dbpath $INSTALL_ROOT/data" || true
pgrep -af "node server.js" >/dev/null 2>&1 && {
  # Only stop this app's node, not every node on the machine.
  pkill -f "[n]ode server.js" || true
}

rm -f "$INSTALL_ROOT/backend.pid" "$INSTALL_ROOT/mongod.pid"

echo
echo "Paused. You can shut down and move this PC."
echo "At the store, run: $INSTALL_ROOT/START.sh"
if [[ -d "$LOG_DIR" ]]; then
  echo "Logs remain in $LOG_DIR"
fi
