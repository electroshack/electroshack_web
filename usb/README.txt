ELECTROSHACK USB KEY
====================

This stick installs and runs Electroshack on the Windows store PC.
The database lives on that PC. This USB is the installer + backup key.

PREPARE THE STICK (Mac)
-----------------------
Copy this whole project onto the USB so SETUP.bat is at the root of the stick.

  ./usb/copy-to-usb.sh /Volumes/YOUR-USB-NAME

WHAT TO DO ON THE STORE PC
--------------------------
1. Plug this USB into the Windows 10/11 PC.
2. Open the USB drive.
3. Double-click SETUP.bat
4. Click Yes if Windows asks to run as administrator.
5. Wait. First run installs Node.js + MongoDB, copies the app, and starts it.
6. Browser should open http://localhost:5000

After that, the app starts when someone signs into Windows.

If the app is already installed and you just want to open it:

  Double-click START.bat

LOCAL LOGIN (this USB is the key)
---------------------------------
Open:     http://localhost:5000/login
Username: admin
Password: $9600Electr@

WHO CAN OPEN THE SITE
---------------------
After SETUP only:

  This PC:     http://localhost:5000
  Shop Wi-Fi:  http://THE-PC-LAN-IP:5000

People at home cannot see receipts yet. Ticket emails would point at localhost.

To let customers open /ticket links from anywhere:

  1. Double-click ENABLE-INTERNET.bat
  2. Accept the hostname (default app.electroshack.ca)
  3. In GoDaddy DNS, add an A record for that name to this PC's public IP
     (the script prints the IP).
  4. On the store router, forward TCP 80 and 443 to this PC.
  5. Restart with START.bat so new ticket links use https://app.electroshack.ca

The database still stays on this PC. The public website is just a door into
that same machine. Keep the PC on. If Rogers/Bell changes your IP, update
the GoDaddy A record.

No Cloudflare, Vercel, Twilio, or Atlas is required for this.

BACKUPS
-------
Keep this USB in the shop. When you want a backup, plug it in and:

  Double-click BACKUP.bat

Copies land in this USB folder:

  backups\

To restore the latest backup onto the PC:

  Double-click RESTORE.bat

You can also run usb/backup.sh / usb/restore.sh from Terminal or Git Bash.

WHERE DATA LIVES
----------------
App:      C:\Electroshack\app
Database: MongoDB on the PC  (mongodb://127.0.0.1:27017/electroshack)
Logs:     C:\Electroshack\logs\backend.log
Backups:  this USB  \backups
HTTPS:    Caddy on this PC after ENABLE-INTERNET.bat

Keep this USB in the shop. If the PC dies, restore a backup onto a new PC
with SETUP.bat then RESTORE.bat.

NO EXTRA ACCOUNTS REQUIRED
--------------------------
Email/SMS still work later if you add keys to
C:\Electroshack\app\backend\.env
They are optional. The store runs without them.
