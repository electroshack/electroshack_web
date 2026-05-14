# Electroshack - Store & POS System

A modern web-based storefront and point-of-sale (POS) system for Electroshack, replacing the handwritten receipt system with a digital workflow.

## Screenshots

Public storefront, admin dashboard, customer ticket lookup and the digital invoice form (full set under [`docs/screenshots/`](docs/screenshots/)).

| Public homepage | Admin dashboard |
| --- | --- |
| ![Home](docs/screenshots/01_home_desktop.png) | ![Dashboard](docs/screenshots/02_admin_dashboard.png) |

| New invoice (POS) | Add inventory item |
| --- | --- |
| ![Invoice form](docs/screenshots/03_new_receipt_form.png) | ![Inventory form](docs/screenshots/04_new_inventory_form.png) |

| Customer ticket lookup | Public storefront |
| --- | --- |
| ![Ticket lookup](docs/screenshots/05_customer_ticket_lookup.png) | ![Shop](docs/screenshots/06_shop_storefront.png) |

## One-click free deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/electroshack/electroshack_web) &nbsp; [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/electroshack/electroshack_web&root-directory=client&env=REACT_APP_API_URL&envDescription=URL%20of%20your%20deployed%20backend%2C%20e.g.%20https%3A%2F%2Felectroshack-api.onrender.com%2Fapi)

1. Click **Deploy to Render** â†’ it reads `render.yaml`, asks for `MONGODB_URI`, `PUBLIC_SITE_URL`, `ADMIN_PASSWORD`. Get the URL it assigns (e.g. `https://electroshack-api.onrender.com`).
2. Click **Deploy with Vercel** â†’ set **Root Directory** to `client`, set env var `REACT_APP_API_URL` to the Render URL + `/api`. Deploy.
3. Point GoDaddy DNS at both (steps below).

## Features

### Customer-Facing
- **Homepage** â€” Modern storefront with hero, services, reviews, and brand partners
- **Services** â€” Detailed service offerings with process breakdown
- **Shop** â€” Browse available inventory items (synced from admin inventory)
- **Contact** â€” Google Maps, hours, phone, and contact form
- **Track Repair** â€” Customers search by receipt number to see status, updates, and send messages

### Admin Dashboard (POS)
- **Dashboard** â€” Stats overview, quick actions, recent receipts
- **Receipt/Invoice Management** â€” Full CRUD for digital receipts replacing handwritten invoices
  - Sequential 6-7 digit receipt numbers (ES-YYYY-######)
  - Customer info (name, phone, email, address)
  - Service categories (repair, accessory, phone/laptop/PC purchase, etc.)
  - Status tracking with customer-visible updates
  - Two-way messaging between staff and customers
  - Ontario GST 5% + RST 8% tax calculation
  - Legacy receipt mode for digitizing old paper invoices
  - Email confirmation on new receipt (when SMTP configured)
- **Inventory Management** â€” Track all items with:
  - Auto-assigned item numbers, barcode/IMEI/serial scanning
  - Purchase info (who bought from, date, cost)
  - Sale info (who sold to, date, selling price)
  - Condition tracking (new/refurbished/used/for-parts)
  - Toggle items visible on public storefront
  - External barcode/IMEI hint lookup (TAC database + UPC API)
- **Grocery List** â€” Staff wish list with match notifications when inventory arrives
- **Metrics** â€” Date-range financial summary + Excel export
- **Messages** â€” View and manage contact form submissions
- **User Management** â€” Superadmin can create/delete admin users

## Tech Stack

- **Frontend**: React 18, React Router v6, Tailwind CSS, Lucide Icons, html5-qrcode
- **Backend**: Express.js 4, Mongoose 8, JWT Auth (jose), Nodemailer
- **Database**: MongoDB (with automatic in-memory fallback for development)
- **Build**: Create React App 5 + CRACO

## Color Scheme
- **Primary (Blue)**: `#0787ec` â€” buttons, accents, links
- **Accent (Yellow)**: `#facc15` â€” CTAs, highlights, badges
- **Dark**: `#212121` â€” navbar, footer, admin sidebar

---

## Quick Start (Development)

### Prerequisites
- **Node.js 20+** (LTS recommended)
- **MongoDB** (optional â€” uses in-memory DB if not available)

### 1. Install dependencies

```bash
cd backend && npm install
cd ../client && npm install
```

### 2. Configure environment

Copy or edit `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/electroshackDB
JWT_SECRET=change-this-to-a-long-random-string
PORT=5000

# Email (optional â€” receipts still work without it)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
SMTP_FROM=Electroshack <your@gmail.com>

# Where customers access the site (used in email links)
PUBLIC_SITE_URL=http://localhost:3000

# Admin bootstrap
ADMIN_PASSWORD=admin123
# Set to true once to force-reset admin password on next start
# RESET_ADMIN_PASSWORD=true
```

### 3. Start development servers

```bash
# Terminal 1 â€” backend (port 5000)
cd backend
npm run dev

# Terminal 2 â€” frontend (port 3000)
cd client
npm start
```

The CRA dev proxy forwards `/api` requests to the backend automatically.

### 4. Default admin login

- **Username**: `admin`
- **Password**: `admin123` (change immediately in production)

---

## Database Setup (MongoDB)

### Option A: Local MongoDB

1. Install MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Start `mongod` (default port 27017)
3. Set in `backend/.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/electroshackDB
   ```
4. Seed admin user:
   ```bash
   cd backend && npm run seed
   ```

### Option B: MongoDB Atlas (Cloud â€” recommended for production)

1. Create free cluster at https://www.mongodb.com/atlas
2. Create a database user (username/password)
3. Whitelist your server IP (or 0.0.0.0/0 for testing)
4. Get connection string and set in `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/electroshackDB?retryWrites=true&w=majority
   ```
5. Start the server â€” the admin user is auto-created on first boot.

### Option C: No MongoDB (Development only)

Just start the backend without setting `MONGODB_URI`. It will spin up `mongodb-memory-server` automatically. All data is lost when the server stops.

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | Admin accounts (admin / superadmin roles) |
| `receipts` | Tickets/invoices with line items, statuses, messages |
| `inventories` | Products/stock with barcode, IMEI, serial tracking |
| `contactforms` | Customer contact form submissions |
| `groceryitems` | Staff wish list / match notifications |
| `counters` | Atomic sequence for receipt numbers |

---

## Production Deployment (Free Tier Recipe)

The fastest free-hosting setup is **MongoDB Atlas (DB) + Render (backend) + Vercel (frontend) + GoDaddy (DNS)**. Each service has a free tier that covers a small business workload.

### TL;DR
1. Create a free MongoDB Atlas M0 cluster + database user + 0.0.0.0/0 access list (or your server IP).
2. Push this repo to GitHub.
3. Render â†’ "New Blueprint" â†’ point at this repo. The included `render.yaml` provisions the backend automatically. Fill in `MONGODB_URI`, `PUBLIC_SITE_URL`, `ADMIN_PASSWORD`. Wait for the service URL (e.g. `https://electroshack-api.onrender.com`).
4. Vercel â†’ "Import Project" â†’ repo, root directory `client/`. Set env var `REACT_APP_API_URL=https://electroshack-api.onrender.com/api`. Deploy. Wait for the URL (e.g. `https://electroshack.vercel.app`).
5. GoDaddy DNS: point `electroshack.ca` at Vercel and `api.electroshack.ca` at Render (instructions below).
6. Update Render env `PUBLIC_SITE_URL=https://electroshack.ca`, redeploy. Update Vercel env `REACT_APP_API_URL=https://api.electroshack.ca/api`, redeploy.

### Backend (Node.js hosting)

The backend is a standard Express server. Deploy to any Node.js host:

**Recommended platforms**: Render (free, included `render.yaml`), Railway, Fly.io, DigitalOcean App Platform, AWS EC2, or any VPS with Node.js 20+.

**Render (one-click using `render.yaml`)**:

1. Push this repo to GitHub.
2. Open https://dashboard.render.com/blueprints â†’ **New Blueprint** â†’ connect this GitHub repo.
3. Render reads `render.yaml`, creates the `electroshack-api` web service, generates a `JWT_SECRET`, and prompts you for the `sync: false` env vars:
   - `MONGODB_URI` â€” your Atlas connection string
   - `PUBLIC_SITE_URL` â€” your eventual frontend URL (e.g. `https://electroshack.ca`)
   - `ADMIN_PASSWORD` â€” initial admin password
   - SMTP env vars â€” optional, leave blank to skip email
4. Click **Create**. First boot installs dependencies and seeds the admin user.
5. Health check `/` will respond `{"status":"Electroshack API is running"}`.

```bash
cd backend
npm install --production
npm start
```

Set these environment variables on your host:

| Variable | Required | Example |
|----------|----------|---------|
| `MONGODB_URI` | Yes | `mongodb+srv://...` |
| `JWT_SECRET` | Yes | Random 32+ character string |
| `PORT` | No | Default 5000 |
| `PUBLIC_SITE_URL` | Yes | `https://electroshack.ca` |
| `ADMIN_PASSWORD` | No | Override default admin password |
| `EMAIL_HOST` | No | `smtp.gmail.com` |
| `EMAIL_PORT` | No | `587` |
| `EMAIL_USER` | No | Gmail address |
| `EMAIL_PASS` | No | Gmail app password |
| `TRUST_PROXY` | No | `1` behind reverse proxy / load balancer |

### Frontend (Static hosting)

Build the React app and serve the `build/` folder:

```bash
cd client
REACT_APP_API_URL=https://your-backend-url.com/api npm run build
```

The `build/` folder is a static SPA. Serve it from:

- **Vercel** (recommended free): Import this repo, set **Root Directory** = `client`. `vercel.json` already pins framework / build / SPA rewrites. Add env var `REACT_APP_API_URL` = `https://<your-render-app>.onrender.com/api` (or your own API domain) under **Settings â†’ Environment Variables**, then **Redeploy**.
- **Netlify** (alternative free): Connect this repo. `client/netlify.toml` and `client/public/_redirects` are already included. Add env var `REACT_APP_API_URL` under **Site â†’ Build & deploy â†’ Environment**, then trigger a new deploy.
- **Cloudflare Pages**: build command `cd client && npm install && npm run build`, output `client/build`. Add `REACT_APP_API_URL` under environment variables.
- **IIS/Azure**: `web.config` for SPA routing is included.
- **Nginx**: Add `try_files $uri /index.html;` to your server block.
- **Any static host**: Serve `build/` with SPA fallback to `index.html`.

**Important**: Set `REACT_APP_API_URL` at build time to your backend's URL (e.g. `https://api.electroshack.ca/api`). Without it, the frontend calls `/api` on the same origin.

---

## GoDaddy Domain Integration

This app does not use GoDaddy APIs â€” it just needs DNS pointed correctly.

### If hosting frontend (Vercel) + backend (Render) separately â€” recommended

In GoDaddy â†’ **My Products â†’ Domains â†’ electroshack.ca â†’ DNS â†’ Manage Zones**:

1. **Apex / `www` â†’ Vercel (frontend)**

   In Vercel: **Settings â†’ Domains** â†’ add `electroshack.ca` and `www.electroshack.ca`. Vercel will print the values it wants.

   In GoDaddy DNS, add the records exactly as Vercel asks. Typical pair:

   | Type  | Name | Value                | TTL    |
   |-------|------|----------------------|--------|
   | A     | @    | `76.76.21.21`        | 1 Hour |
   | CNAME | www  | `cname.vercel-dns.com` | 1 Hour |

   (Delete any conflicting `Parked` A record on `@` first.)

2. **`api` subdomain â†’ Render (backend)**

   In Render: **electroshack-api â†’ Settings â†’ Custom Domains** â†’ add `api.electroshack.ca`. Render will give you the value to point to.

   In GoDaddy DNS:

   | Type  | Name | Value                                | TTL    |
   |-------|------|--------------------------------------|--------|
   | CNAME | api  | `electroshack-api.onrender.com`      | 1 Hour |

3. **Wait for SSL certificates** to auto-issue (â‰ˆ1â€“10 min on Vercel, up to 1 hr on Render).

4. **Reconfigure env vars to use the real domains**:
   - Vercel â†’ `REACT_APP_API_URL=https://api.electroshack.ca/api`, redeploy.
   - Render â†’ `PUBLIC_SITE_URL=https://electroshack.ca`, redeploy.

### If hosting both on one server (VPS / DigitalOcean)

1. Point your GoDaddy domain's **A record** to your server IP
2. Use Nginx as reverse proxy:

```nginx
server {
    listen 80;
    server_name electroshack.ca www.electroshack.ca;

    # Frontend (static build)
    location / {
        root /var/www/electroshack/client/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Add SSL with Certbot: `sudo certbot --nginx -d electroshack.ca -d www.electroshack.ca`

### GoDaddy SSL

- If using Netlify/Vercel/Render: SSL is automatic, no action needed.
- If using a VPS: Use Let's Encrypt (free) via Certbot.
- GoDaddy's paid SSL is not required for most setups.

---

## Useful Commands

```bash
# Seed admin user (requires MONGODB_URI)
cd backend && npm run seed

# Reset admin password to admin123
cd backend && npm run reset-admin

# Build frontend for production
cd client && npm run build

# Run backend in development (with hot reload)
cd backend && npm run dev
```

## API Endpoints Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | No | Login, get JWT |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/auth/register` | Superadmin | Create user |
| GET | `/api/auth/users` | Superadmin | List users |
| DELETE | `/api/auth/users/:id` | Superadmin | Delete user |
| POST | `/api/auth/change-password` | Yes | Change own password |
| POST | `/api/receipts` | Yes | Create receipt |
| GET | `/api/receipts` | Yes | List receipts (paginated) |
| GET | `/api/receipts/stats` | Yes | Receipt statistics |
| GET | `/api/receipts/preview-new` | Yes | Preview next receipt # |
| GET | `/api/receipts/:id` | Yes | Get receipt |
| PUT | `/api/receipts/:id` | Yes | Update receipt |
| POST | `/api/receipts/:id/update` | Yes | Add status update |
| POST | `/api/receipts/:id/items/:itemId/update` | Yes | Update line item |
| POST | `/api/receipts/:id/message` | Yes | Staff message |
| DELETE | `/api/receipts/:id` | Yes | Delete receipt |
| GET | `/api/receipts/lookup/:num` | No | Customer ticket lookup |
| POST | `/api/receipts/lookup/:num/message` | No | Customer message |
| POST | `/api/inventory` | Yes | Create item |
| GET | `/api/inventory` | Yes | List items (paginated) |
| GET | `/api/inventory/stats` | Yes | Inventory statistics |
| GET | `/api/inventory/storefront` | No | Public shop items |
| GET | `/api/inventory/public-check` | No | Public stock counts |
| GET | `/api/inventory/:id` | Yes | Get item |
| PUT | `/api/inventory/:id` | Yes | Update item |
| DELETE | `/api/inventory/:id` | Yes | Delete item |
| GET | `/api/inventory/by-barcode/:code` | Yes | Lookup by scan |
| GET | `/api/inventory/external-hint/:code` | Yes | External barcode hints |
| POST | `/api/inventory/parse-sticker` | Yes | Parse sticker text |
| POST | `/api/contact-forms` | No | Submit contact form |
| GET | `/api/contact-forms` | Yes | List submissions |
| PATCH | `/api/contact-forms/:id/read` | Yes | Mark as read |
| DELETE | `/api/contact-forms/:id` | Yes | Delete submission |
| POST | `/api/grocery-list` | Yes | Add grocery item |
| GET | `/api/grocery-list` | Yes | List grocery items |
| PUT | `/api/grocery-list/:id` | Yes | Update item |
| DELETE | `/api/grocery-list/:id` | Yes | Delete item |
| GET | `/api/metrics` | Yes | Financial summary |
| GET | `/api/metrics/export.xlsx` | Yes | Excel export |

