# Electroshack Windows Store-PC Install

This folder turns a Windows 10/11 PC into the Electroshack local server:

- MongoDB stores all receipts, inventory, grocery list data, users, and messages locally.
- The Express backend serves both the API and the built React app.
- Cloudflare Tunnel can expose the local app at a public HTTPS hostname without opening router ports.
- Twilio can send SMS notifications when credentials are configured.

## Recommended PC settings

1. Use a dedicated Windows 10/11 PC in the back of the store.
2. Disable sleep/hibernate.
3. Keep the PC on a UPS if possible.
4. Sign in as an admin user before running the installer.
5. Keep backups on the PC and periodically copy them to a USB drive.

## USB install flow

From a development machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows\make-usb-installer.ps1 -Destination E:\
```

On the store PC:

```powershell
cd E:\Electroshack-Installer
powershell -ExecutionPolicy Bypass -File .\install\windows\install.ps1
```

The installer prompts for:

- Public app URL, for example `https://app.electroshack.ca`
- Admin password
- Admin email
- Twilio credentials, if SMS is enabled

After install:

```powershell
powershell -ExecutionPolicy Bypass -File .\install\windows\install-service.ps1 -TunnelToken <cloudflare-tunnel-token>
```

## Cloudflare Tunnel

Cloudflare Tunnel is the recommended free remote-access path. It keeps the data on the store PC but lets staff and customers reach the app from the internet.

1. Move `electroshack.ca` DNS to Cloudflare, or use a subdomain on a domain already in Cloudflare.
2. In Cloudflare Zero Trust, create a tunnel for the store PC.
3. Add a public hostname such as `app.electroshack.ca`.
4. Route that hostname to `http://localhost:5000`.
5. Copy the tunnel token.
6. Run `install-service.ps1 -TunnelToken <token>` on the store PC.

Optional: add Cloudflare Access in front of `/admin` for another login layer. Customer receipt links must stay publicly reachable.

## SMS with Twilio

Twilio is not free for production. Trial accounts are only for testing and have restrictions. Production SMS needs:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`

These values are written to `C:\Electroshack\app\backend\.env`.

## Backups

Run a manual backup:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Electroshack\app\install\windows\backup.ps1
```

Copy the backup to a USB drive:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Electroshack\app\install\windows\backup.ps1 -CopyTo E:\Electroshack-Backups
```

Restore a backup:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Electroshack\app\install\windows\restore.ps1 -BackupZip C:\Electroshack\backups\electroshack-YYYYMMDD-HHMMSS.zip -DropExisting
```

## Operational limits

Remote access and customer receipt links work only while the store PC, MongoDB, internet, and Cloudflare Tunnel are online. If the PC is off or asleep, the app is unavailable from outside the store.
