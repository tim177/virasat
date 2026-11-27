# Virasat

Premium Indian traditional wear for US customers, with custom-fit tailoring.
This repo is the **prototype (v1)**: one Next.js app (shop + admin + API) with a Postgres database.

- Build plan: [claude/virasat-v1-launch-spec.md](claude/virasat-v1-launch-spec.md)
- Rules for coding agents: [CLAUDE.md](CLAUDE.md)

## What you need

- Node.js 22 or 24 LTS (`.nvmrc` says 22)
- pnpm 12 (`npm install -g pnpm@12.23.0`)
- Docker Desktop (for the local database)

## First-time setup

```bash
pnpm install              # also generates the Prisma client
cp .env.example .env      # then fill in values if needed
pnpm db:up                # starts Postgres 16 in Docker
pnpm db:deploy            # creates the tables
pnpm db:seed              # adds 13 sample products (sample artwork, not real photos)
pnpm dev                  # http://localhost:3000
```

The home page shows **"Database: connected"** when everything works. `GET /api/health` returns the same as JSON.

All design-system components are previewed at **http://localhost:3000/dev/components** (development only).

## Everyday commands

| Command                       | What it does                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                    | Run the app locally                                                             |
| `pnpm check`                  | Lint, typecheck, format check and unit tests                                    |
| `pnpm test`                   | Unit tests (Vitest, no database needed)                                         |
| `pnpm test:integration`       | Database tests (needs `db:up`, `db:deploy`, `db:seed`)                          |
| `pnpm test:e2e`               | Browser tests (Playwright). First time: `pnpm exec playwright install chromium` |
| `E2E_PORT=3300 pnpm test:e2e` | Browser tests while your own `pnpm dev` keeps port 3000                         |
| `pnpm build`                  | Production build                                                                |
| `pnpm format`                 | Format all files with Prettier                                                  |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local database                                                 |
| `pnpm db:migrate`             | Create and apply a database migration, then regenerate the Prisma client        |
| `pnpm db:deploy`              | Apply existing migrations (CI and server)                                       |
| `pnpm db:seed`                | Add or refresh the sample products (refuses non-local databases)                |
| `pnpm db:studio`              | Browse the database in the browser                                              |
| `pnpm stripe:listen [port]`   | Forward Stripe test webhooks to `localhost:[port]` (default 3000)               |
| `pnpm admin:create ...`       | Create an admin login, or reset one (see "Admin" below)                         |
| `pnpm admin:dev`              | Create the local dev admin from `.env` (see "Admin" below)                      |
| `pnpm admin:code`             | Print the local dev admin's current sign-in code                                |

## Admin

The admin is at **/admin**: a dashboard (sales, orders waiting, low stock), orders (paid → delivered), products (with photo upload) and the admin log (every change, before and after). There is no sign-up page: admins are created from the command line, with two-step sign-in already turned on.

**Locally, the quick way:**

```bash
pnpm admin:dev     # creates admin@virasat.local; saves its password and authenticator secret in .env
pnpm admin:code    # prints the current 6-digit sign-in code
```

Sign in at http://localhost:3000/admin/login with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`, then the code from `pnpm admin:code`. Change `ADMIN_EMAIL` or `ADMIN_PASSWORD` in `.env` and run `pnpm admin:dev` again to update it. This only works with a local database. Never put these values on a server.

**On a server (or with a real authenticator app):**

```bash
pnpm admin:create --email you@example.com --name "Your Name"
```

It prints a random password, a QR code for an authenticator app (Google Authenticator, 1Password, Authy…) and 10 backup codes, **once**. Save them in a password manager. Signing in needs the password and then a 6-digit code from the app (or one backup code). Sessions end after 12 hours.

Lost the password or the phone? Run the same command with `--reset`: it replaces the password, the authenticator and the backup codes, and signs that admin out everywhere.

`BETTER_AUTH_SECRET` must be set in `.env` (see `.env.example`), and sign-in only works on the address in `SITE_URL`.

**Product photos.** Uploads in the product editor are checked (JPEG, PNG, WebP or AVIF, up to 8 MB) and saved to Cloudflare R2 when the five R2 values in `.env` are set (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGES_BASE_URL`). Without them, they're saved in the git-ignored `uploads/` folder and served at `/uploads/...`. The sample photos in `public/seed` are free stock photos for development only (credits in `public/seed/CREDITS.md`). Replace them with photos of the real pieces before launch.

## Payments and emails locally

**Stripe (test mode).** Put a test secret key (`sk_test_...`) in `.env` as `STRIPE_SECRET_KEY`. Then:

```bash
pnpm stripe:listen        # needs the Stripe CLI; prints a whsec_... secret
```

Copy the printed `whsec_...` value into `.env` as `STRIPE_WEBHOOK_SECRET` (once; it stays the same) and restart the app. `pnpm stripe:listen` passes the key from `.env`, so webhooks come from the same Stripe account as the app, whichever account the Stripe CLI is logged into. Pay with Stripe's test cards, for example `4242 4242 4242 4242` or `4000 0027 6000 3184` (3-D Secure).

Orders are created only by the webhook. If `stripe:listen` isn't running, the "Order confirmed" page waits on "Confirming your payment…".

**Emails.** Without `RESEND_API_KEY`, emails are saved as HTML files in **`.outbox/`** (git-ignored) instead of being sent. Open them in a browser to check them. A production build (`pnpm start`) also needs `EMAIL_OUTBOX=true` for this; otherwise a missing key is an error, so the live shop never drops emails silently.

**Scheduled jobs** are `POST /api/cron/emails` (hourly: resend failed emails) and `POST /api/cron/drafts` (daily: delete old checkout drafts). Both need `Authorization: Bearer $CRON_SECRET`.

**The real purchase test** (`tests/e2e/purchase.spec.ts`) pays on Stripe's test page with a normal card and a 3-D Secure card. It's skipped in CI and needs Google Chrome installed:

```bash
# terminal 1
pnpm stripe:listen 3300
# terminal 2
pnpm build
STRIPE_E2E=1 CI=1 E2E_PORT=3300 pnpm exec playwright test tests/e2e/purchase.spec.ts --project=desktop
```

The test deletes its orders afterwards. `SITE_URL` must match the server's port (Playwright sets it), because Stripe sends the customer back there after paying.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check, unit tests, migrations, seed, integration tests, build and browser tests on every push and pull request.

## Deploying

The shop runs on one server with Docker Compose: Caddy (HTTPS) → the Next.js app → Postgres, behind Cloudflare. Step-by-step setup (Google Cloud, Cloudflare, Stripe webhook, scheduled jobs, backups and restore) is in **[deploy/README.md](deploy/README.md)**. After that, every update is:

```bash
bash scripts/deploy.sh
```

The same production setup can be tested on a laptop with Docker Desktop (see the end of `deploy/README.md`).
