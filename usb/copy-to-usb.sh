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

echo
echo "USB is ready. On the Windows store PC, open the stick and double-click SETUP.bat."
echo "Login is in usb/README.txt on the stick."
