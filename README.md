# AFC — Allfor Care Medical & Ambulance Services

This is a working backend + web app for AFC. It's a real, runnable system —
not a mockup — but it's a **starting point** (an MVP), not the finished
enterprise platform. This repo also holds the documentation that defines
what the finished platform should become. Read the "Before you take real
customers" section before relying on the code for actual patients, and see
**Documentation** below before starting any new build work.

## Documentation

Four documents live in [`docs/`](docs/), written at different points as the
project's ambitions grew from "get an MVP working" to "specify the real
enterprise platform." Read them in this order:

1. **[AFC_Dispatcher_Dashboard_Operator_Guide.docx](docs/AFC_Dispatcher_Dashboard_Operator_Guide.docx)**
   — *Superseded, kept for history.* The original staff-facing guide to the
   `/admin.html` dashboard only (signing in, working the Bookings/SOS/
   Membership tabs, status meanings, troubleshooting). Everything in it is
   also covered, in more depth, by document 2 below.
2. **[AFC_Complete_System_and_Operations_Guide.docx](docs/AFC_Complete_System_and_Operations_Guide.docx)**
   — **The current operator/reference guide for the live MVP.** Covers every
   journey the deployed code actually supports today: the full patient app
   (all booking types, SOS, membership), the dispatcher dashboard, a system
   administrator section (env vars, API reference, deployment), the full
   status lifecycle for every resource, and — importantly — an honest,
   explicit table of what's missing versus an enterprise deployment (per-staff
   roles, crew/vehicle roster, reporting, payments, audit trail, data
   durability). Read this to understand **what exists right now**.
3. **[AFC_Enterprise_Platform_Specification.docx](docs/AFC_Enterprise_Platform_Specification.docx)**
   — **The target-state specification for the enterprise platform this repo
   is meant to grow into.** This is *not* a description of the current code —
   it specifies, in full depth, every user journey (patient, home doctor,
   nurse, home health aide, pharmacist, phone consultation, emergency
   dispatcher, scheduling dispatcher, ambulance crew, fleet manager, duty
   supervisor, operations manager, executive, billing, membership/customer
   success, compliance, IT admin), each with step-by-step flows and an
   edge-case catalog, plus platform-wide RBAC/permission matrix, integration
   requirements, audit/data-governance rules, privacy/compliance obligations
   (Jamaica and UK-facing), business continuity targets, and executive KPI
   reporting. It closes with:
   - **Appendix A** — current system snapshot and the gap versus this spec
   - **Appendix B** — glossary of terms (RBAC, SLA, DSAR, MCI, CAPA, RTO/RPO, etc.)
   - **Appendix C** — a phased implementation roadmap (Phase 0 today's MVP
     through Phase 5 full reporting/multi-branch)
   - **Appendix D** — the mandated technology stack (NestJS, PostgreSQL,
     Redis, React/Next.js, Flutter) and non-negotiable engineering standards
     (real per-user auth, migrations, API contracts, CI-gated tests,
     infrastructure as code, secrets management, observability, accessibility)
     that any implementation of this spec must be built to — without
     dictating the detailed technical design, which is left to the engineers
     building it.

   Read this before starting any enterprise build work — it's the
   requirements document engineers should be implementing against, subject
   to Appendix D's technology and quality constraints.
4. **[AFC_UIUX_Functional_Screen_Inventory.docx](docs/AFC_UIUX_Functional_Screen_Inventory.docx)**
   — **The functional (not visual) screen-by-screen companion to document 3.**
   For every role in the Enterprise Platform Specification, this inventories
   every screen needed across the two mobile apps (Patient App; Field Staff
   App covering doctors, nurses, aides, pharmacists, ambulance crew, and
   phone consultation clinicians) and the eight role-gated modules of the
   unified internal web platform (Dispatch Console, Fleet Management,
   Facility Partner Portal, Finance and Billing, Membership and Customer
   Success, Compliance and Governance, IT Administration, Executive and
   Operations Reporting). Each screen entry covers purpose, key information
   displayed, actions, navigation, validation/error states, and — explicitly
   — its empty state. A "Platform-Wide System States" section up front
   defines session-expiry, access-denied, generic-error, connectivity-lost,
   and not-found behavior once, so individual screens don't each reinvent
   it. This is functional UI/UX (what's on a screen and what you can do with
   it), not visual design (colors, layout, fonts) — that remains a separate,
   later phase for whoever builds this.

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
