# ---- Build stage: install all deps and build the Next.js app ----
FROM node:20-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies (schema copied first so the postinstall `prisma
# generate` has it available).
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build. A dummy DATABASE_URL satisfies Prisma; the app is fully dynamic so
# nothing touches the DB at build time. The real value is injected at runtime.
COPY . .
ENV DATABASE_URL="file:/tmp/build.db"
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# DATABASE_URL, AUTH_SECRET and SEED_ADMIN_* are provided by the host and must
# point DATABASE_URL at the mounted persistent disk, e.g. file:/var/data/prod.db

# Copy the built app and dependencies from the build stage.
COPY --from=build /app ./

EXPOSE 3000

# At container start (disk is mounted now): apply migrations, ensure the admin
# + settings exist (idempotent), then start the server on the host's $PORT.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.mjs && npx next start -p ${PORT:-3000} -H 0.0.0.0"]
