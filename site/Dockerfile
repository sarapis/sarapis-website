# Production image for the Sarapis Payload site (Next.js standalone + SQLite).
# Build:  docker build --build-arg NEXT_PUBLIC_SERVER_URL=https://sarapis.org -t sarapis-site .
# Run:    see docker-compose.prod.yml

FROM node:22.17.0-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ---- deps ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build runs generateStaticParams, which boots Payload and reads the
# bundled sarapis.db. A placeholder secret is fine — the real one is injected at runtime.
ARG NEXT_PUBLIC_SERVER_URL=https://sarapis.org
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV PAYLOAD_SECRET=build-time-placeholder
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Persistent locations (mounted as volumes in compose)
ENV DATABASE_URI=file:/app/data/sarapis.db
ENV MEDIA_DIR=/app/media

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Writable, volume-backed dirs for the SQLite DB and uploaded media
RUN mkdir -p /app/data /app/media && chown -R nextjs:nodejs /app/data /app/media

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
