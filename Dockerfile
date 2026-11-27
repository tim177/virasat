# syntax=docker/dockerfile:1.10
# Virasat's production image: one Next.js app. Built on the server by scripts/deploy.sh.
#
#   deps   node_modules and the generated Prisma client
#   tools  the whole repo for one-off jobs: migrations, `pnpm admin:create`, seed
#          (docker compose -f docker-compose.prod.yml --profile tools run --rm tools <command>)
#   build  `next build`; it reads the database to prerender the shop (see docker-compose.prod.yml)
#   web    the small image that runs: Next's standalone server, as a non-root user

ARG NODE_IMAGE=node:22.23.4-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.23.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# The postinstall step (prisma generate) reads prisma.config.ts, which wants a database URL.
# Generating the client doesn't connect, so any URL will do here.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .

FROM tools AS build
# Public settings baked into the pages at build time (from .env, via docker-compose.prod.yml).
ARG SITE_URL
ARG IMAGES_BASE_URL
ARG ALLOW_INDEXING
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_OUTPUT=standalone
# Changes on every deploy (scripts/deploy.sh), so `next build` always runs again: it bakes the
# current catalogue into the shop pages, and Docker's cache can't know the catalogue changed.
ARG BUILD_ID
# The database URL and Sentry token are build secrets: used by this step, never stored in the image.
RUN --mount=type=secret,id=database_url,env=DATABASE_URL \
    --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN,required=false \
    test -n "$SITE_URL" || { echo "SITE_URL is required to build" >&2; exit 1; } && \
    echo "Build $BUILD_ID" && pnpm build

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOADS_DIR=/app/uploads \
    # Keeps image resizing (sharp) from holding on to memory on glibc systems.
    MALLOC_ARENA_MAX=2
WORKDIR /app
RUN groupadd --system --gid 1001 virasat \
    && useradd --system --uid 1001 --gid virasat --no-create-home virasat \
    && mkdir -p /app/uploads /app/.next \
    && chown virasat:virasat /app/uploads /app/.next
COPY --from=build --chown=virasat:virasat /app/.next/standalone ./
COPY --from=build --chown=virasat:virasat /app/.next/static ./.next/static
COPY --from=build --chown=virasat:virasat /app/public ./public
USER virasat
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
