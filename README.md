# DineSync

DineSync is a responsive restaurant operations dashboard built with React. Admins sign in to manage tables and service; Captains can take orders, calculate bills, transfer tables, and check guests out.

## Features

- **JWT sign-in:** Sessions use `httpOnly`, `SameSite=Strict` cookies. Login attempts are rate-limited; logout revokes the active token.
- **Role-based access:** Admins can add, edit, and delete tables, subject to active-order safeguards. Captains can manage service and orders. Table-management and database-export APIs require the Admin role.
- **Floor map:** Filter tables by floor/zone; available, occupied, and dirty states have distinct colors.
- **Orders:** Start orders at available tables, add food and beverage items, transfer active orders, and settle/check out.
- **Billing:** Food GST 5%, beverage GST 18%, and service charge 10% of the pre-tax subtotal; totals are calculated by the server.
- **Checkout:** Saves a final bill snapshot, locks the order, and marks its table Dirty. Cleaning then returns the table to Available.
- **Analytics:** Occupancy, live unpaid revenue, pending cleanups, and floor with the most active orders.
- **Persistence/export:** JSON file database with a downloadable export that omits password hashes and revoked sessions.
- **Responsive UI:** React, React Router, Lucide icons, and CSS.

## Technology

- Frontend: React 18, React Router 7, Lucide React, esbuild, and CSS.
- Backend: Node.js 20+, Express 4, bcryptjs, jsonwebtoken, dotenv, Helmet, and express-rate-limit.
- Storage: Persistent JSON file (`data/db.json`).
- Tests: Node's built-in test runner.

This version uses JSON persistence, not MongoDB/Mongoose. It implements the assignment's table, floor-map, order, tax, transfer, settlement, cleanup, analytics, validation, and export workflows. It does not include menu management, quantity editing, split bills, password-reset UI, or a payment gateway.

## Requirements

- Node.js 20 or newer and npm.
- A modern browser.
- No MongoDB service is required.

## Install and run

Install dependencies once:

```sh
cp .env.example .env
npm install
```

For production or a shared computer, change the example passwords and `JWT_SECRET` in `.env` before starting. The checked-in `.env.example` values are for local demonstration only.

### Development

```sh
npm run dev
```

This builds the React UI, watches frontend changes, and starts the Express server at [http://localhost:3000](http://localhost:3000). Refresh the browser to see frontend changes; backend changes restart automatically.

### Production-style local run

```sh
npm start
```

`npm start` builds the React app and serves the site and API together at [http://localhost:3000](http://localhost:3000). Stop the process with `Ctrl+C`.

On first launch, DineSync creates starter tables and orders if there is no database file, then hashes the Admin and Captain bootstrap passwords from `.env`. Existing table/order data is preserved. Set both passwords before starting with a new database.

## Sign in

The local demo account credentials are supplied in `.env.example`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@dinesync.local` | `DineSyncAdmin!2026` |
| Captain | `captain@dinesync.local` | `DineSyncCaptain!2026` |

These are demo-only values; the server has no built-in password fallback. Copy `.env.example` to `.env` before the first launch. Set unique Admin and Captain email/password values before deployment. Each role account is created only when the database has no user with that role; changing the variables later does not change an existing password. Passwords are stored as bcrypt hashes and are never returned by the API or included in exports.

## Configuration

The server reads environment variables through dotenv. Copy `.env.example` to `.env` and edit the values before the first launch. `.env` is ignored by Git and must not be added to the submission ZIP.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Express API and production web-server port. |
| `NODE_ENV` | `development` | Use `production` for deployment; production requires an explicit signing secret and admin password at initial setup. |
| `JWT_SECRET` | `.env.example` placeholder | Secret used to sign JWTs. Set a unique random value (at least 32 random bytes recommended); the example placeholder is rejected in production. If unset in development, a random secret is generated per process. |
| `JWT_EXPIRES_IN` | `8h` | JWT lifetime in a jsonwebtoken-supported duration format. |
| `ADMIN_EMAIL` | `admin@dinesync.local` | Email for the first bootstrap administrator. |
| `ADMIN_PASSWORD` | `.env.example` demo value | Password for the first bootstrap administrator; minimum 12 characters. Required when creating the first admin user. |
| `CAPTAIN_EMAIL` | `captain@dinesync.local` | Email for the first bootstrap captain. |
| `CAPTAIN_PASSWORD` | `.env.example` demo value | Password for the first bootstrap captain; minimum 12 characters. Required when creating the first captain user. |
| `DINESYNC_DATA_DIR` | `<project>/data` | Directory containing `db.json`; relative paths resolve from the project directory. |

Example PowerShell setup for a separate local database:

```powershell
$env:PORT = "3100"
$env:DINESYNC_DATA_DIR = "C:\dinesync-data"
$env:ADMIN_EMAIL = "admin@example.test"
$env:ADMIN_PASSWORD = "Use-A-Unique-Password-2026!"
$env:CAPTAIN_EMAIL = "captain@example.test"
$env:CAPTAIN_PASSWORD = "Use-Another-Password-2026!"
$env:JWT_SECRET = "replace-this-with-a-long-random-secret"
npm run dev
```

Open `http://localhost:3100`. For production, also set `$env:NODE_ENV = "production"` and use a unique secret and admin password.

## Admin workflow

1. Sign in with the bootstrap Admin account.
2. Select a table or use **Add table** to manage the floor.
3. Use **Edit** or **Delete table** in the selected table panel. Deleting a table with an active order is rejected.
4. Start an order at an Available table, add items, and review the live bill.
5. To transfer an order, choose an Available target. Occupied or Dirty destinations are rejected with `Target Table Occupied`.
6. Settle and check out the order. The order becomes read-only and the table becomes Dirty.
7. Mark the table Available after cleaning.
8. Use **Export database** in the sidebar to download table/order data.

## Billing rules

- Item prices are INR, finite, and greater than zero after rounding to paisa.
- GST is rounded per item to the nearest paisa: Food 5%, Beverage 18%.
- The 10% service charge is rounded to paisa and applied to the pre-tax item subtotal.
- Total payable = subtotal + category-based GST + service charge. No extra GST is applied to the service charge.
- Live revenue includes active/unpaid orders only.
- Occupancy = occupied tables / total tables, rounded to the nearest whole percentage.
- The busiest floor/zone is the one with the most active orders; ties are alphabetical.
- Empty active orders can be settled; their saved bill is zero.

## Data model

`data/db.json` contains:

- `tables`: `id`, `tableNumber`, `capacity`, `floor`, `status`, `createdAt`, and `updatedAt`.
- `orders`: `id`, `tableId`, `status`, embedded `items`, timestamps, and a final `bill` snapshot after settlement.
- `users`: `id`, `name`, `email`, bcrypt `passwordHash`, `role`, and `createdAt`.
- `revokedTokens`: JWT IDs revoked on logout, with expiry timestamps.

Each embedded order item includes `id`, `name`, `category` (`food` or `beverage`), `price`, and `createdAt`. One active order is allowed per occupied table. Settled orders remain in the database with their final bill. `/api/export` intentionally includes only `tables` and `orders`.

## Table and order states

| Operation | Preconditions | State change |
| --- | --- | --- |
| Start order | Table Available | New active order; table Occupied. |
| Add item | Order active; valid item fields | Item appended; server recalculates bill. |
| Transfer | Active order; target Available and not the source | Order moves; source Available; destination Occupied. |
| Settle | Order active | Bill snapshot saved; order Settled/read-only; table Dirty. |
| Mark clean | Table Dirty | Table Available. |
| Delete | No active order on table | Table removed. Admin only. |

Table numbers are unique, case-insensitively. Capacities must be positive whole numbers. Only an Admin can add/edit/delete tables or export data. Admins and Captains can run service actions. An invalid or expired JWT is rejected; logout revokes that JWT and clears its cookie.

## API reference

All business endpoints require the session cookie unless marked Public. Errors use `{ "error": "..." }`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Sign in with `{ "email", "password" }`; sets JWT cookie. |
| `GET` | `/api/auth/me` | Signed in | Return current public user profile. |
| `POST` | `/api/auth/logout` | Public | Revoke the current cookie token, if valid, then clear the cookie. |
| `GET` | `/api/state` | Signed in | Tables, active orders, calculated bills, and dashboard analytics. |
| `GET` | `/api/export` | Admin | Download sanitized tables/orders JSON. |
| `POST` | `/api/tables` | Admin | Create a table. |
| `PATCH` | `/api/tables/:id` | Admin | Edit table number, capacity, and floor. |
| `DELETE` | `/api/tables/:id` | Admin | Delete a table without an active order. |
| `POST` | `/api/tables/:id/clean` | Signed in | Mark a Dirty table Available. |
| `POST` | `/api/orders` | Signed in | Start an order with `{ "tableId" }`. |
| `POST` | `/api/orders/:id/items` | Signed in | Add an item with `{ "name", "category", "price" }`. |
| `POST` | `/api/orders/:id/transfer` | Signed in | Transfer with `{ "targetTableId" }`. |
| `POST` | `/api/orders/:id/settle` | Signed in | Save final bill and check out. |

## Tests

Run the integration suite:

```sh
npm test
```

The test starts an isolated server with a temporary database and verifies unauthenticated access, invalid and valid login, cookie flags, order/billing calculations, table validation, transfer restrictions, settlement locking, cleanup, sanitized export, and logout revocation. It does not modify the included `data/db.json`.

## Deploy: Render backend + Vercel frontend

The backend writes to a JSON file, so host it on a Node service with a **persistent disk/volume**. The steps below use Render for the API and Vercel for the React frontend. The Vercel rewrite proxies `/api` through the frontend domain, keeping the browser's JWT cookie same-origin; do not call the Render API directly from browser code.

### Deploy the backend to Render

1. Push the project to GitHub and create a Render **Web Service** connected to the repository.
2. Set **Root Directory** to the repository root.
3. Set **Build Command** to `npm ci`.
4. Set **Start Command** to `node backend/server.js`.
5. Add a persistent disk mounted at `/var/data`.
6. Add these environment variables in Render:

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DINESYNC_DATA_DIR` | `/var/data/dinesync` |
   | `JWT_SECRET` | A unique random secret (at least 32 random bytes); do not use the example value. |
   | `ADMIN_EMAIL` | Your chosen initial admin email. |
   | `ADMIN_PASSWORD` | A unique password of at least 12 characters. |
   | `CAPTAIN_EMAIL` | Your chosen initial captain email (optional if using the demo email). |
   | `CAPTAIN_PASSWORD` | A unique password of at least 12 characters for the first Captain account. |
   | `JWT_EXPIRES_IN` | `8h` (optional). |

Render supplies `PORT`. Wait for deployment and verify `https://YOUR-SERVICE.onrender.com/api/auth/me` responds with `401` when signed out. The first boot initializes the database and creates both role accounts on the mounted disk. Without persistent storage, JSON data may be lost on restart or redeploy.

### Point Vercel to the backend and deploy

1. In `vercel.json`, replace `REPLACE-WITH-YOUR-RENDER-SERVICE` with your Render service hostname (omit the `https://` prefix in the placeholder).
2. Import the same GitHub repository into Vercel with the repository root as the project root.
3. Use the build command `npm run build` and output directory `frontend/dist` (both are also set in `vercel.json`).
4. Deploy. Visit your Vercel URL, sign in with the admin credentials set in Render, and test table creation and an order.

This same-origin proxy avoids browser CORS configuration and keeps the JWT cookie on the Vercel site. Keep production credentials only in the hosting providers' environment settings; never commit `.env`.

## Project layout

```text
backend/
  billing.js               Server-side tax and total calculation
  server.js                Express API, JWT auth, authorization, static hosting
  store.js                 JSON database initialization and persistence
frontend/
  index.html               Browser entry point
  src/
    App.jsx                Protected React routes
    api.js                 Same-origin API helper
    context/AuthContext.jsx JWT session state
    pages/
      LoginPage.jsx        Authentication UI
      DashboardPage.jsx    Admin dashboard, floor map, and operations
    styles.css             Responsive UI and login styling
scripts/
  build.js                 Production frontend bundle
  dev.js                   Watch-mode frontend and backend runner
vercel.json                Vercel build settings and API proxy rewrites
data/
  db.json                  Local JSON database (ignored by Git)
test/
  api.test.js              Isolated API/authentication integration test
.env.example               Local configuration template
.gitignore                 Local secrets and generated files
package.json               Scripts and dependencies
package-lock.json          Reproducible dependency versions
README.md                  Setup, configuration, and workflow guide
```

## Push to GitHub

The project is not automatically pushed. After reviewing the files and confirming `.env` is not staged, run these commands from the project folder:

```sh
git init
git add .
git status
git commit -m "Build DineSync React admin dashboard"
git branch -M main
git remote add origin https://github.com/satyam3433/-DINESYNC-PRO-.git
git push -u origin main
```

If a Git remote already exists, inspect it with `git remote -v` and update it only if needed. Do not commit `.env` or production credentials.

## Submission ZIP

Include source folders, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `vercel.json`, `README.md`, sample `data/db.json`, and tests. Do not include `.env` or `node_modules`. After extracting, copy `.env.example` to `.env`, then run `npm install` and `npm start`; log in with the documented local demo account. `data/db.json` is ignored by Git to keep runtime data out of source control; the server creates a starter database if it is absent.
