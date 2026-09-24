# WatchMart

A demo two-part project: a static storefront (`frontend/`) and a small
Node/Express API (`backend/`) that handles registration, login, a
server-side cart, and a mock checkout.

This is a **teaching/demo build** — see "About the payment flow"
below before showing it to anyone as more than that.

## Project structure

```
watchmart-project/
├── frontend/
│   └── index.html          — the whole storefront: header, cart drawer, checkout
└── backend/
    ├── server.js            — Express app + security middleware
    ├── package.json
    ├── .env.example          — copy to .env and fill in
    ├── src/
    │   ├── db.js             — tiny JSON-file "database"
    │   ├── data/products.seed.json
    │   ├── middleware/auth.js
    │   ├── routes/auth.js    — register / login
    │   ├── routes/products.js
    │   ├── routes/cart.js
    │   └── routes/orders.js  — checkout / mock payment
    └── data/                 — users.json, carts.json, orders.json (created at runtime)
```

## Importing into VS Code

1. Unzip this project anywhere on your machine.
2. Open VS Code → **File → Open Folder…** → select the `watchmart-project` folder.
3. Install the **Live Server** extension (by Ritwick Dey) — makes step 5 easy.
4. Open a terminal in VS Code (`` Ctrl+` ``) and set up the backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
   Open `.env` and replace `JWT_SECRET` with a real random value — you
   can generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
5. Start the backend:
   ```bash
   npm run dev
   ```
   You should see `WatchMart API listening on http://localhost:4000`.
6. Right-click `frontend/index.html` in the VS Code file explorer →
   **Open with Live Server**. It'll open in your browser, usually at
   `http://127.0.0.1:5500`.
7. If your Live Server port isn't 5500, add it to `CORS_ORIGIN` in
   `backend/.env` and restart the backend.

No frontend build step, no bundler — it's one HTML file with plain
JavaScript, so it's easy to read top to bottom.

## What actually works

- **Register / sign in** — real accounts, stored (hashed) in `backend/data/users.json`.
- **Add to cart** — server-side cart per logged-in user.
- **Checkout** — three-step flow (address → payment → review), calls
  a real API endpoint, creates a real order record.
- **Categories & search bar layout** — search input is UI-only in this
  demo; wiring it to `GET /api/products?q=` is a natural next step.

## About the payment flow — read this part

The checkout form collects a card number, expiry, and CVV so the demo
has a realistic end-to-end flow. Some deliberate choices, worth
pointing out to anyone reviewing this with security in mind:

- The full card number and CVV are **never written to disk, logged,
  or stored anywhere**. `backend/src/routes/orders.js` validates them
  in memory, "charges" them via a mock function, and only ever
  persists the **card brand and last 4 digits** — see the comment
  block at the top of that file.
- Prices are computed **server-side from the cart**, not trusted from
  the client, so a tampered request can't change what gets charged.
- Passwords are hashed with **bcrypt** (12 rounds), never stored or
  logged in plain text.
- Auth uses short-lived **JWTs**; the login route responds identically
  (in shape and timing) whether the email exists or not, to make
  account enumeration harder.
- `/api/auth/*` is rate-limited; the whole API sends `helmet` security
  headers; request logging redacts `password` and `payment` fields.
- Secrets live in `.env`, which is git-ignored — `.env.example` is the
  only thing that should ever be committed.

**What this project is *not*:** a PCI-DSS-compliant payment system.
There is no real payment gateway wired up — `mockChargeCard()` in
`orders.js` just returns a canned "approved" response. A real product
must never collect raw card numbers on its own server; instead you'd
use your payment processor's client-side SDK (Paystack Inline,
Flutterwave, Stripe Elements, etc.) so the card number and CVV go
straight from the customer's browser to the processor, and your
server only ever sees a token. That's what real PCI scope reduction
looks like — this project is deliberately structured so swapping in
a real gateway later is a one-function change (`mockChargeCard`),
not a rewrite.

## Suggested next steps

- Swap the JSON-file store for a real database (Postgres/SQLite) once
  you have concurrent users.
- Wire up a real payment processor instead of `mockChargeCard`.
- Add server-side pagination/search on `/api/products`.
- Add HTTPS (a reverse proxy like Caddy/Nginx, or a platform that
  terminates TLS for you) before deploying anywhere public — this dev
  server runs plain HTTP.
