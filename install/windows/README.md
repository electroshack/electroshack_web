# Old Windows installer (removed)

The Cloudflare / Twilio / Git installer that used to live here was replaced.

Use the USB kit in `usb/` instead. `./usb/copy-to-usb.sh` puts SETUP/START/BACKUP/RESTORE/ENABLE-INTERNET/SETUP-SMS at the **stick** root, not the git repo root.

- `usb/SETUP.bat` — install MongoDB + Node, copy the app to `C:\Electroshack\app`, start it
- `usb/START.bat` — open the already-installed app
- `usb/BACKUP.bat` / `usb/RESTORE.bat` — dump/restore MongoDB onto `backups\` on the USB
- `usb/SETUP-SMS.bat` — USB GSM modem COM port
- `usb/README.txt` — local login credentials

No Cloudflare Tunnel, Twilio, Git, or Atlas account is required to run the store PC.
