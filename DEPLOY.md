# Deploying free: Vercel + Neon Postgres

Fully free setup — the app runs on **Vercel (Hobby)** and the database is a
free **Neon** Postgres. Your data persists (unlike SQLite on an ephemeral host).

> Free-tier limits change over time; check current limits at
> https://neon.tech/pricing and https://vercel.com/pricing

## 1. Create a free Neon database

1. Sign up at https://neon.tech → **New Project** (pick a region near you).
2. In the project's **Connect** panel, copy **two** connection strings:
   - **Pooled** connection (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** connection (no `-pooler`) → this is `DIRECT_URL`
   Both should include `?sslmode=require`.

## 2. Deploy on Vercel

1. Sign up at https://vercel.com with GitHub → **Add New… → Project** →
   import `gajerayash-exploit/gokul-gruh-admin`.
2. Framework preset auto-detects **Next.js**. Leave build/output as default
   (the repo's `build` script runs `prisma migrate deploy` + seed + `next build`).
3. Add **Environment Variables** (Production + Preview):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Neon **pooled** string (`...-pooler...?sslmode=require`) |
   | `DIRECT_URL` | Neon **direct** string (`...?sslmode=require`) |
   | `AUTH_SECRET` | a long random string (≥32 chars) |
   | `SEED_ADMIN_EMAIL` | `admin@gokulgruh.local` |
   | `SEED_ADMIN_PASSWORD` | your first-login password |
   | `SEED_ADMIN_NAME` | `Kripal Dobariya` |

4. Click **Deploy**. The build applies the migration to Neon, seeds the admin
   (idempotent), and ships the app.
5. Open the `*.vercel.app` URL and log in.

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Notes

- **Migrations run at build** (Vercel build servers can reach Neon). Seeding is
  idempotent — it never overwrites an existing admin, so an in-app password
  change survives future deploys.
- **Local development** now also uses Postgres: put the same Neon strings (or a
  separate Neon branch) in your local `.env` as `DATABASE_URL` / `DIRECT_URL`,
  then `npm run dev`. (SQLite is no longer used.)
- **Serverless + pooling:** the app uses Neon's pooled URL, which suits
  Vercel's serverless functions. Migrations use the direct URL.
- **HTTPS**: Vercel serves HTTPS, which the production `secure` session cookie
  requires.
