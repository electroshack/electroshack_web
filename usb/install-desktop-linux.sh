#!/usr/bin/env bash
# Put Start / Pause / Export on this user's Desktop.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="${ELECTROSHACK_HOME:-$HOME/Electroshack}"
DESKTOP="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
mkdir -p "$DESKTOP" "$INSTALL_ROOT"

ln -sfn "$HERE/start-linux.sh" "$INSTALL_ROOT/START.sh"
ln -sfn "$HERE/pause-linux.sh" "$INSTALL_ROOT/PAUSE.sh"
ln -sfn "$HERE/export-linux.sh" "$INSTALL_ROOT/EXPORT.sh"
ln -sfn "$HERE/stop-linux.sh" "$INSTALL_ROOT/STOP.sh"
chmod +x "$HERE"/*.sh "$INSTALL_ROOT"/START.sh "$INSTALL_ROOT"/PAUSE.sh "$INSTALL_ROOT"/EXPORT.sh "$INSTALL_ROOT"/STOP.sh 2>/dev/null || true

write_desktop() {
  local path="$1"
  local name="$2"
  local exec_cmd="$3"
  local comment="$4"
  cat > "$path" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$name
Comment=$comment
Exec=$exec_cmd
Path=$INSTALL_ROOT
Terminal=true
Categories=Utility;
EOF
  chmod +x "$path"
}

write_desktop "$DESKTOP/Start Electroshack.desktop" \
  "Start Electroshack" \
  "$INSTALL_ROOT/START.sh" \
  "Start the store database and open https://electroshack.ca"

write_desktop "$DESKTOP/Pause Electroshack.desktop" \
  "Pause Electroshack" \
  "$INSTALL_ROOT/PAUSE.sh" \
  "Stop the database so this PC can be moved"

write_desktop "$DESKTOP/Export Database.desktop" \
  "Export Database" \
  "$INSTALL_ROOT/EXPORT.sh" \
  "Save a zip backup of the store database"

if command -v gio >/dev/null 2>&1; then
  gio set "$DESKTOP/Start Electroshack.desktop" metadata::trusted true 2>/dev/null || true
  gio set "$DESKTOP/Pause Electroshack.desktop" metadata::trusted true 2>/dev/null || true
  gio set "$DESKTOP/Export Database.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Desktop icons: Start Electroshack, Pause Electroshack, Export Database"
echo "  in $DESKTOP"
