# Deploying Virasat (staging and live)

One Google Cloud server runs everything with Docker Compose: **Caddy** (HTTPS) → **web** (the
Next.js app) → **Postgres**. Cloudflare sits in front for DNS, SSL and caching. The same steps
make a staging server (Stripe test mode) and, later, the live one.

Files: `Dockerfile`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/crontab`,
`scripts/deploy.sh`, `scripts/cron.sh`, `scripts/backup.sh`, `scripts/restore-check.sh`.

**Costs:** server ≈ ₹2,500–3,000/month after the free trial ($300 credit for 90 days), domain
≈ ₹1,000–1,500/year, backups in Cloud Storage a few rupees a month. Cloudflare is free.

---

## 1. Google Cloud: account and server

1. Sign up at cloud.google.com (a card is needed) and create a project, e.g. `virasat`.
   **Start the trial only when you're ready to deploy**: the 90 days start at sign-up.
2. **Billing → Budgets & alerts:** add alerts at ₹100, ₹4,000 and ₹8,000.
3. **Compute Engine → VM instances → Create instance:**
   - Name `virasat`, region `us-east1`, machine type **e2-medium** (2 vCPU, 4 GB).
   - Boot disk: **Ubuntu 24.04 LTS**, 30 GB, balanced persistent disk.
   - Access scopes: "Set access for each API" → **Storage: Read Write** (for backups).
   - Don't tick "Allow HTTP/HTTPS traffic"; step 2 opens those ports for Cloudflare only.
4. **VPC network → IP addresses:** reserve the VM's external IP as **static**.
5. **VPC network → Firewall:** add a rule allowing **TCP 80 and 443** to the VM **only from
   Cloudflare's IP ranges** (https://www.cloudflare.com/ips/, both lists). The app trusts
   Cloudflare's visitor-IP header for rate limits, so nobody else may reach the server
   directly. Keep SSH (22) for your own IP, or use the console's "SSH" button (IAP).

## 2. Server setup (once)

Open SSH to the VM, then:

```bash
# Docker Engine and the Compose plugin (Docker's official install script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# A 2 GB swap file, so builds don't run out of memory
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Security updates install themselves
sudo apt-get install -y unattended-upgrades && sudo dpkg-reconfigure -f noninteractive unattended-upgrades

# The code
git clone https://github.com/tim177/virasat.git ~/virasat
cd ~/virasat
```

## 3. Settings (`.env`, on the server only)

```bash
cp .env.example .env && chmod 600 .env && nano .env
```

Fill in (the server part is at the end of `.env.example`):

| Setting                              | Value                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                           | `https://www.yourdomain.com`                                                                                  |
| `SITE_DOMAIN` / `APEX_DOMAIN`        | `www.yourdomain.com` / `yourdomain.com`                                                                       |
| `POSTGRES_PASSWORD`                  | `openssl rand -hex 24` (hex only, so it works inside URLs)                                                    |
| `BETTER_AUTH_SECRET`                 | `openssl rand -base64 32`                                                                                     |
| `CRON_SECRET`                        | `openssl rand -hex 24`                                                                                        |
| `STRIPE_SECRET_KEY`                  | staging: the `sk_test_…` key; live: `sk_live_…`                                                               |
| `STRIPE_WEBHOOK_SECRET`              | from step 6                                                                                                   |
| `RESEND_API_KEY`, `EMAIL_FROM`       | once the Resend domain is set up; until then `EMAIL_OUTBOX="true"`                                            |
| `ADMIN_ALERT_EMAIL`                  | where new-order alerts go                                                                                     |
| `TURNSTILE_SITE_KEY` / `_SECRET_KEY` | Cloudflare → Turnstile → Add widget for your domain (replace the test keys)                                   |
| `GOOGLE_CLIENT_ID` / `_SECRET`       | Google Cloud → Credentials → OAuth client; redirect URI `https://www.yourdomain.com/api/auth/callback/google` |
| `DEV_VERIFICATION_CODE`              | delete the line (it's ignored on a server anyway)                                                             |
| `R2_*`, `IMAGES_BASE_URL`            | optional; without them photos stay on the server (and in backups)                                             |
| `BACKUP_BUCKET`                      | from step 7                                                                                                   |
| `ALLOW_INDEXING`                     | empty on staging; `"true"` only on the live shop                                                              |

Leave `DATABASE_URL` out: Compose sets it. Never commit this file or copy it anywhere else.

## 4. Cloudflare: domain and HTTPS

1. Add the domain to Cloudflare (free plan) and change the nameservers at your registrar.
2. **DNS:** `A` record `www` → the static IP, and `A` record `@` → the same IP, both
   **proxied** (orange cloud).
3. **SSL/TLS → Overview:** mode **Full (strict)**. **Edge Certificates:** turn on
   "Always Use HTTPS".
4. **SSL/TLS → Origin Server → Create certificate** (RSA, hostnames `yourdomain.com` and
   `*.yourdomain.com`, 15 years). Save the two parts on the server:

   ```bash
   mkdir -p deploy/certs && chmod 700 deploy/certs
   nano deploy/certs/origin.pem       # the certificate
   nano deploy/certs/origin-key.pem   # the private key
   chmod 600 deploy/certs/*
   ```

## 5. First deploy

```bash
bash scripts/deploy.sh
```

It starts Postgres, applies migrations, builds the app (reading the catalogue to prerender the
shop) and starts the app behind Caddy. Then:

```bash
# Your admin login (prints a password, a QR code for your authenticator app and backup codes)
docker compose -f docker-compose.prod.yml --profile tools run --rm tools \
  pnpm admin:create --email you@example.com --name "Your Name"

# Staging only: the sample products (needs ALLOW_SEED="true" in .env)
docker compose -f docker-compose.prod.yml --profile tools run --rm tools pnpm db:seed
```

After seeding, run `bash scripts/deploy.sh` once more so the home page is built with the
products. Then open `https://www.yourdomain.com` and `https://www.yourdomain.com/api/health`.

## 6. Stripe webhook

Stripe Dashboard (test mode for staging) → **Developers → Webhooks → Add endpoint**:

- URL `https://www.yourdomain.com/api/stripe/webhook`, API version **2026-10-28.endive**
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `charge.refunded`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in `.env`, then reload the app:
`docker compose -f docker-compose.prod.yml up -d web`.

## 7. Scheduled jobs and backups

1. Create a Cloud Storage bucket (Standard, `us-east1`), e.g. `virasat-backups-<something>`,
   with a **lifecycle rule: delete objects older than 30 days**. Put its name in
   `BACKUP_BUCKET`.
2. Install the jobs (hourly email retries, daily draft clean-up, nightly backup):

   ```bash
   mkdir -p ~/virasat-logs && crontab deploy/crontab
   ```

3. Run a backup now and **prove it restores** (the plan requires this once):

   ```bash
   bash scripts/backup.sh && bash scripts/restore-check.sh
   ```

4. **Compute Engine → Snapshots → Create snapshot schedule:** weekly, keep 4, and attach it
   to the VM's disk.

## 8. Monitoring

- Sentry: set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, redeploy; alerts arrive by email.
- A free uptime monitor (UptimeRobot or Better Stack) on `https://www.yourdomain.com/api/health`.

## Everyday

- **Update the site:** `bash scripts/deploy.sh` (pulls, migrates, builds, restarts).
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f web` and `~/virasat-logs/`.
- **Restore for real** (after a disaster, from a `db-….dump`):

  ```bash
  docker compose -f docker-compose.prod.yml stop web
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_restore -U virasat -d virasat --clean --if-exists --no-owner < db-….dump
  docker compose -f docker-compose.prod.yml start web
  # Photos stored on the server, from an uploads-….tar.gz:
  docker compose -f docker-compose.prod.yml exec -T web tar -xzf - -C /app < uploads-….tar.gz
  ```

## Testing this setup on a laptop

The whole production setup also runs locally with Docker Desktop, over HTTPS on port 8443
with Caddy's own test certificate (`deploy/local.env`, git-ignored, holds throwaway values;
copy `deploy/local.env.example` to make one):

```bash
APP_ENV_FILE=deploy/local.env SKIP_PULL=1 bash scripts/deploy.sh
APP_ENV_FILE=deploy/local.env docker compose -f docker-compose.prod.yml --env-file deploy/local.env \
  --profile tools run --rm tools pnpm db:seed
APP_ENV_FILE=deploy/local.env SKIP_PULL=1 bash scripts/deploy.sh   # rebuild with the products
# open https://localhost:8443 (accept the test certificate)
APP_ENV_FILE=deploy/local.env bash scripts/backup.sh && APP_ENV_FILE=deploy/local.env bash scripts/restore-check.sh
APP_ENV_FILE=deploy/local.env docker compose -f docker-compose.prod.yml --env-file deploy/local.env down
```
