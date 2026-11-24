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

CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check, unit tests, migrations, seed, integration tests, build and browser tests on every push and pull request.
