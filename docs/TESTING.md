# Testing

Two scripted test layers exist:

## 1. API smoke test

Exercises every backend endpoint. Run while the backend is up (default `http://localhost:5000`):

```bash
cd backend
node scripts/smokeTest.js
```

What it covers:

- Auth: login, `/me`, register/list/delete users (superadmin), bad-password rejection, `/api/receipts` 401 without token
- Receipts: preview number, create standard, create legacy, list (paginated, filtered, search), stats, status update, line item update, staff message, PUT update, delete
- Customer side: ticket lookup by number, customer message
- Inventory: create (storefront-visible + hidden), list, stats, public `/storefront`, public `/public-check`, lookup by barcode, update, sticker parser
- Grocery list: create / update / delete
- Contact forms: public submit, admin list, mark read, delete
- Metrics: summary + Excel export download (verifies real `.xlsx` zip header)

Last run: **37/37 passed**.

## 2. UI stress test (Playwright)

Drives Chromium against the running frontend (`http://localhost:3000`):

```bash
cd ..
node stress_test.mjs       # full sweep + screenshots
node stress_test_deep.mjs  # end-to-end (admin POS → customer track → storefront)
```

Each run dumps screenshots to `screenshots/` for inspection (gitignored). The `docs/screenshots/` folder shows the curated set.

What it covers:

- Public pages: Home, Services, Shop (with search), Contact (with form submit), Track Repair
- Admin: login form, dashboard, receipts list, inventory list, grocery list, messages, metrics, users, new receipt form, new inventory form
- End-to-end: create receipt in admin UI → verify in admin list → verify on customer ticket lookup → customer posts a message → create inventory item → verify it appears on `/shop`
- Mobile (390x844 viewport): home + hamburger menu, shop, contact

Last run: **22/22 + 9/9 passed, no console errors.**
