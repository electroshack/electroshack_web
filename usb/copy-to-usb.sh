#!/usr/bin/env bash
# Copy this repo onto a USB stick from the Mac so SETUP.bat is at the stick root.
# Usage: ./usb/copy-to-usb.sh /Volumes/USBNAME
set -euo pipefail

DEST="${1:-}"
if [ -z "$DEST" ] || [ ! -d "$DEST" ]; then
  echo "Usage: $0 /Volumes/YOUR-USB-NAME"
  echo "Plug the USB in, then run this from the Electroshack project folder."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Copying $ROOT -> $DEST"
# -- # Skip AppleDouble forks on FAT/exFAT. Protect volume metadata from --delete.
export COPYFILE_DISABLE=1
set +e
rsync -a --delete \
  --exclude ".git" \
  --exclude ".cursor" \
  --exclude "node_modules" \
  --exclude "client/build" \
  --exclude "backups/*.zip" \
  --exclude "backups/dump-*" \
  --exclude "/SETUP.bat" \
  --exclude "/START.bat" \
  --exclude "/PAUSE.bat" \
  --exclude "/STOP.bat" \
  --exclude "/PAUSE.ps1" \
  --exclude "/BACKUP.bat" \
  --exclude "/RESTORE.bat" \
  --exclude "/ENABLE-INTERNET.bat" \
  --exclude "/SETUP.sh" \
  --exclude "/START.sh" \
  --exclude "/PAUSE.sh" \
  --exclude "/STOP.sh" \
  --exclude "/EXPORT.sh" \
  --exclude "/EXPORT.bat" \
  --filter "P .Trashes/" \
  --filter "P .fseventsd/" \
  --filter "P .TemporaryItems/" \
  --filter "P System Volume Information/" \
  "$ROOT/" "$DEST/"
rsync_status=$?
set -e
if [ "$rsync_status" -ne 0 ] && [ "$rsync_status" -ne 23 ]; then
  echo "rsync failed with status $rsync_status"
  exit "$rsync_status"
fi

# Stick-root launchers call scripts in usb\ so store staff never have to open that folder.
cat > "$DEST/SETUP.bat" <<'EOF'
@echo off
cd /d "%~dp0"
if not exist "usb\SETUP.ps1" (
  echo usb\SETUP.ps1 is missing. Copy the whole Electroshack folder onto this USB.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0usb\SETUP.ps1\"'"
EOF

cp "$ROOT/usb/START.bat" "$DEST/START.bat"
cp "$ROOT/usb/PAUSE.bat" "$DEST/PAUSE.bat"
cp "$ROOT/usb/PAUSE.ps1" "$DEST/PAUSE.ps1"
cp "$ROOT/usb/STOP.bat" "$DEST/STOP.bat"
cp "$ROOT/usb/EXPORT.bat" "$DEST/EXPORT.bat"
cp "$ROOT/usb/setup-linux.sh" "$DEST/SETUP.sh"
cp "$ROOT/usb/start-linux.sh" "$DEST/START.sh"
cp "$ROOT/usb/pause-linux.sh" "$DEST/PAUSE.sh"
cp "$ROOT/usb/stop-linux.sh" "$DEST/STOP.sh"
cp "$ROOT/usb/export-linux.sh" "$DEST/EXPORT.sh"
chmod +x "$DEST/SETUP.sh" "$DEST/START.sh" "$DEST/PAUSE.sh" "$DEST/STOP.sh" "$DEST/EXPORT.sh" \
  "$DEST/usb/setup-linux.sh" "$DEST/usb/start-linux.sh" "$DEST/usb/pause-linux.sh" "$DEST/usb/stop-linux.sh" \
  "$DEST/usb/export-linux.sh" "$DEST/usb/install-desktop-linux.sh"

cat > "$DEST/BACKUP.bat" <<'EOF'
@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0usb\backup.ps1"
pause
EOF

cat > "$DEST/RESTORE.bat" <<'EOF'
@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0usb\restore.ps1"
pause
EOF

cat > "$DEST/ENABLE-INTERNET.bat" <<'EOF'
@echo off
cd /d "%~dp0"
if exist "usb\ENABLE-INTERNET.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0usb\ENABLE-INTERNET.ps1\"'"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0ENABLE-INTERNET.ps1\"'"
)
EOF

cp "$ROOT/usb/SETUP-SMS.bat" "$DEST/SETUP-SMS.bat"

if [ ! -f "$DEST/usb/SETUP.ps1" ] || [ ! -f "$DEST/SETUP.bat" ]; then
  echo "USB copy incomplete: SETUP.bat or usb/SETUP.ps1 is missing."
  exit 1
fi

echo
echo "USB is ready. On the Windows store PC, open the stick and double-click SETUP.bat."
echo "Login is in usb/README.txt on the stick."
echo "After the USB LTE/GSM stick is plugged in, run SETUP-SMS.bat once."
