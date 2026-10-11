# Gokul Gruh Udhyog — Admin Order Management

A premium, internal **Admin Order Management System** for **Gokul Gruh Udhyog**.
It replaces the paper order notebook with a fast, grid-based **digital order
register**: enter customer orders quickly, autosave to a real database, keep a
searchable history, and generate printable / downloadable **4 × 6 inch** order
slips.

This is an **internal, administrator-only** application — not a public website,
storefront, or customer portal.

---

## Tech stack

| Area        | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Framework   | Next.js 15 (App Router) + React 19 + TypeScript               |
| Styling     | Tailwind CSS + custom design system                           |
| UI          | Radix UI primitives (accessible), Lucide icons                |
| Database    | **SQLite** via **Prisma** (zero external setup; Postgres-ready) |
| Auth        | Custom secure session (JWT in httpOnly cookie, bcrypt hashes) |
| Validation  | Zod (client + server)                                         |
| Print / PNG | CSS `@page` 4×6in print layout + `html-to-image` (1200×1800)  |

Why SQLite + Prisma instead of Supabase? For a single administrator doing hours
of daily data entry, a local database gives **instant autosave with no network
flakiness**, no external accounts, and full data privacy — while Prisma keeps a
clean migration path to Postgres if you later need multi-device/cloud access
(see [Moving to Postgres](#moving-to-postgres)).

---

## Quick start

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file
cp .env.example .env
#   - set a long random AUTH_SECRET
#   - set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 3. Create the database schema
npx prisma migrate deploy      # applies migrations to the SQLite DB

# 4. Create the first administrator + default business settings
npm run db:seed

# 5. Run the app
npm run dev
# open http://localhost:3000  ->  redirects to /login
```

Sign in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you configured, then
change the password in **Settings → Administrator password**.

---

## Environment variables

See [`.env.example`](.env.example). Summary:

| Variable                          | Required | Purpose                                                        |
| --------------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`                    | yes      | SQLite file path (`file:./dev.db`) or a Postgres URL           |
| `AUTH_SECRET`                     | yes      | Long random string used to sign session cookies                |
| `SEED_ADMIN_EMAIL`                | seed     | Email for the admin created by `npm run db:seed`               |
| `SEED_ADMIN_PASSWORD`             | seed     | Initial admin password (change after first login)              |
| `SEED_ADMIN_NAME`                 | seed     | Display name of the admin                                      |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | Enables the embedded map on the Contact page (falls back to a Google Maps link if absent) |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Features

- **Digital Order Notebook** — grid/register view with columns: Date, Day, Full
  Name, Phone, Address, Order Type, Docket Number, Actions. Day is always
  derived from the date (Asia/Kolkata). Backdated entries supported.
- **Real-time autosave** — debounced upserts with stable record IDs, optimistic
  concurrency (version field), automatic + manual retry, and offline-safe flush
  on tab hide/navigation. "Saved" is shown **only after** the server confirms.
- **Smart copy/paste & bulk import** — paste tab-separated rows from Excel/Sheets
  or upload CSV/TSV, map columns, preview, see validation + how many records
  will be created. Retried imports are idempotent (no duplicates).
- **Validation** — required Full Name, Indian mobile number (normalized to
  `+91XXXXXXXXXX`), Address, Order Type, Docket (stored as text, duplicate
  warnings, never silently rejected).
- **Order History** — date range / exact date filters, search by name / phone /
  docket / type, sortable columns, pagination, edit, soft-delete with audit.
- **Order preview + slip** — professional 4×6in **Customer Order Slip** with
  logo, business details, prominent docket number, and customer fields.
- **Download PNG** — high-resolution **1200 × 1800** (2:3, ~300dpi) PNG,
  filename `GokulGruhUdhyog_Order_<Docket>.png`.
- **Print** — native print dialog, dedicated `@page 4in 6in` layout, only the
  selected slip prints (no app chrome), legible in black & white.
- **Contact Us** — dedicated page: `tel:` call link, copy-number, editable
  address, Google Maps embed (or fallback link), directions.
- **Settings** — business name, address, contact person, phone, logo upload,
  Google Maps location, frequently used order types, default date behavior,
  password change. Settings flow into the nav, preview, PNG, and print slip.
- **Security** — admin-only, protected routes + API (middleware + per-route
  checks), httpOnly session cookies, bcrypt password hashing, server-side
  validation, login rate limiting, audit log, generic auth error messages.
- **Design** — soft eye-friendly palette, Inter typography, light theme default
  with optional low-glare dark theme, subtle animations, reduced-motion support,
  responsive from mobile to desktop.

---

## Project structure

```
src/
  app/
    (app)/            Protected pages: notebook, history, contact, settings
    api/              Route handlers (auth, orders, settings, summary, ...)
    login/            Public login page
  components/
    brand/            Logo (SVG emblem + lockup)
    layout/           App shell, sidebar, mobile drawer, footer
    notebook/         Register grid, row, autosave hook, bulk paste, save status
    orders/           Order slip (4x6), preview panel, edit dialog
    contact/          Contact page + map
    settings/         Business settings form
    ui/               Accessible primitives (button, dialog, toast, ...)
    providers/        App context (admin + settings)
    theme/            Light/dark theme provider
  lib/
    auth/             Sessions, password hashing, rate limiting
    db/               Prisma client
    orders/           Order persistence + business logic
    settings/         Business settings service
    audit/            Audit logging
    validation/       Zod schemas + phone normalization
    dates/            Asia/Kolkata date + weekday helpers
    print/            PNG export + print trigger
    api/              Typed client fetch wrapper
  types/              Shared TypeScript types
prisma/
  schema.prisma       DB schema (Orders, BusinessSettings, Admin, AuditEvent)
  migrations/         SQL migrations
  seed.ts             Creates first admin + default settings
```

---

## Database

Entities: **Order** (business_date, full_name, phone_number, address,
order_type, docket_number, status, version, created/updated by + timestamps,
soft-delete `deletedAt`), **BusinessSettings** (single row), **Admin**, and
**AuditEvent** (append-only history of create/update/finalize/delete/restore/
settings/auth events).

Common commands:

```bash
npx prisma migrate dev --name <change>   # create + apply a migration (dev)
npx prisma migrate deploy                # apply migrations (prod/CI)
npm run db:seed                          # seed admin + settings (idempotent)
npm run db:studio                        # browse data in Prisma Studio
```

### Moving to Postgres

1. In `prisma/schema.prisma`, change `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. `npx prisma migrate dev --name init_pg` to regenerate migrations, then seed.

The application code is database-agnostic (all access goes through Prisma).

---

## Printing notes

- The slip is rendered at exactly **384 × 576 CSS px** = **4 × 6 in** at 96dpi,
  so screen preview, print, and PNG all match.
- Print uses `@page { size: 4in 6in }`; only the slip surface is visible.
- Final physical size can still depend on your **printer driver, selected paper
  size, and browser print settings**. For thermal/label printers, set the media
  to 4×6in and margins to none.

---

## Deployment

1. Provision persistent storage for the SQLite file (or switch to Postgres).
2. Set `DATABASE_URL`, `AUTH_SECRET`, and (optionally) the Maps key in the host's
   environment. **Never commit `.env`.**
3. Build runs migrations automatically: `npm run build` executes
   `prisma migrate deploy && next build`.
4. Seed the first admin once: `npm run db:seed`.
5. Start: `npm run start`.

Run behind HTTPS in production — session cookies are marked `secure` when
`NODE_ENV=production`.

---

## Testing checklist

The acceptance workflows (admin access, order creation, autosave reliability,
automatic rows, copy/paste, history retrieval, preview, image download, printing,
contact page, responsiveness, security) are documented in
[`TESTING.md`](TESTING.md).
