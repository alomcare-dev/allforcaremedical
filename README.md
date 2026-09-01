# AFC — Allfor Care Medical & Ambulance Services

This is a working backend + web app for AFC. It's a real, runnable system —
not a mockup — but it's a **starting point**, not a finished production
service. Read the "Before you take real customers" section before you rely
on it for actual patients.

## What's here

- `server.js` — the whole backend. Plain Node.js, **zero npm dependencies**.
  Serves the app and a JSON API from one process.
- `db.js` — SQLite database setup, using Node's built-in `node:sqlite`
  module (no external database to install or pay for).
- `public/index.html` — the app itself (booking, ambulance SOS, membership,
  all wired to the real API now instead of pretend data).
- `public/admin.html` — the dispatcher/staff dashboard. Lists bookings,
  ambulance requests, and memberships, and lets staff update each one's
  status (e.g. mark an SOS request "dispatched", then "en route", then
  "completed"). Protected by `ADMIN_TOKEN` — see below.
- `data/afc.db` — created automatically the first time you run the server.
  This is your real database file.

## Running it locally

1. Install **Node.js 22.5 or newer** (needed for the built-in SQLite
   support): https://nodejs.org
2. In this folder, run:
   ```
   node server.js
   ```
3. Open **http://localhost:3000** in your browser — that's the app, backed
   by a real local database.
4. Try booking a visit or requesting an ambulance. The data is saved in SQLite.
5. Open **http://localhost:3000/admin.html** for the staff dashboard. Set
   `ADMIN_TOKEN` (see below) before starting the server, then paste that
   same value into the dashboard's sign-in screen. Staff list endpoints
   (`/api/bookings`, `/api/sos`, `/api/membership`) require it too, sent as
   `Authorization: Bearer <token>`.

No `npm install` step — there's nothing to install.

## Putting it on the internet (so real people can use it)

You need somewhere to *host* this server 24/7. Good low-effort options that
work with this exact code, in rough order of ease:

- **Render.com** — connect your GitHub repo, set build command to nothing
  and start command to `node server.js`, pick a Node 22 environment. Free
  tier exists but sleeps when idle; a paid instance (~$7/mo) stays on.
- **Railway.app** — similar to Render, also very quick to set up from a
  GitHub repo.
- **Fly.io** — a bit more setup (a `fly.toml` and Docker-ish flow) but
  cheap and reliable, good if you outgrow the simpler options.

Steps, roughly the same on any of them:
1. Put this folder in a GitHub repository.
2. Connect that repo to the hosting service.
3. Set the start command to `node server.js`.
4. Set the `PORT` environment variable if the host requires it (most set
   it automatically — `server.js` already reads `process.env.PORT`).
5. Deploy. You'll get a URL like `afc-backend.onrender.com`.
6. Point your own domain (e.g. `app.afcmedical.com`) at that URL — your
   host's dashboard will show you how (usually a CNAME record).

**Important — the database file:** `data/afc.db` lives on the server's
disk. Most free/cheap hosting tiers **wipe the disk on every deploy or
restart**, which means you'd lose all bookings. Before going live:
- Use your host's "persistent disk" or "volume" feature (Render, Railway,
  and Fly.io all offer this — usually a small monthly fee), and set the
  `DATA_DIR` environment variable to that mounted volume, **or**
- Migrate from SQLite to a hosted database (e.g. Render Postgres, Railway
  Postgres, or Supabase's free tier) once you're past testing. This is a
  bigger step — ask me when you're ready and I'll do the migration.

## Before you take real customers

This starter handles the booking/dispatch/membership *data flow* correctly,
but a few things are still placeholders and need real setup before this is
a live medical service:

1. **Payments.** No fake payment link is shown. Membership checkout is only
   exposed if you configure `PAYMENT_BASE_URL`; integrate that URL with your
   real payment processor before enabling it. Booking and ambulance payments
   are currently confirmed by the care team.
2. **SMS/notifications for dispatch.** Right now an SOS request is saved and
   clearly shown as **request received**, not falsely shown as dispatched —
   a staff member has to open the dashboard (or watch `/api/sos`) to see it.
   Add a live SMS/push/pager integration so dispatch is notified the instant
   a request comes in, instead of relying on someone checking the screen.
3. ~~A dispatcher/admin view.~~ **Done.** `public/admin.html` is a
   token-gated dashboard for bookings, SOS requests, and memberships, with
   status updates (e.g. `request_received` → `dispatched` → `en_route` →
   `completed`). It's a shared static password (`ADMIN_TOKEN`), not
   per-user login — fine for a small team, worth revisiting as staff grows.
4. **Authentication.** Patient booking is intentionally open, while staff
   endpoints require the single shared `ADMIN_TOKEN`. Add per-staff accounts
   (and real patient identity) before handling sensitive records at scale.
5. **Legal/compliance.** Handling patient health information and payments
   in Jamaica may have specific data protection and health-service
   licensing requirements — worth a conversation with a local lawyer
   before wide launch, separate from anything I can help build.

None of these are huge — each is a focused, addable piece. Tell me which
one to build next and I'll add it to this same codebase.

## API reference

| Method | Path              | Purpose                          |
|--------|-------------------|-----------------------------------|
| GET    | `/api/health`     | Check the server is up            |
| POST   | `/api/bookings`   | Create a doctor/nurse/aide/meds/scheduled-ambulance booking |
| GET    | `/api/bookings`   | List all bookings (admin only)    |
| PATCH  | `/api/bookings/:id` | Update a booking's status (admin only) — `requested`, `confirmed`, `completed`, `cancelled` |
| POST   | `/api/sos`        | Create an emergency ambulance dispatch request |
| GET    | `/api/sos`        | List all SOS requests (admin only) |
| PATCH  | `/api/sos/:id`    | Update an SOS request's status (admin only) — `request_received`, `dispatched`, `en_route`, `arrived`, `completed`, `cancelled` |
| POST   | `/api/membership` | Create a membership signup        |
| GET    | `/api/membership` | List all memberships (admin only) |
| PATCH  | `/api/membership/:id` | Update a membership's status (admin only) — `pending_payment`, `active`, `cancelled` |
| GET    | `/api/admin/verify` | Check whether an `ADMIN_TOKEN` is valid, used by the dashboard sign-in screen |

The staff dashboard lives at **`/admin.html`** — sign in with `ADMIN_TOKEN`.


## Environment variables

- `PORT` — HTTP port (default `3000`)
- `DATA_DIR` — directory for the SQLite database (default `./data`)
- `ADMIN_TOKEN` — required to read staff list endpoints
- `PAYMENT_BASE_URL` — optional base URL for a real membership payment flow
