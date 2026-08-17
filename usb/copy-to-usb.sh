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
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "client/build" \
  --exclude "backups/*.zip" \
  --exclude "backups/dump-*" \
  "$ROOT/" "$DEST/"

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

echo
echo "USB is ready. On the Windows store PC, open the stick and double-click SETUP.bat."
echo "Login is in usb/README.txt on the stick."
echo "After the USB LTE/GSM stick is plugged in, run SETUP-SMS.bat once."
