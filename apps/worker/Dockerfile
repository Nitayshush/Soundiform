# Dockerfile — apps/worker
# ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
#
# ⚠️ node-web-audio-api הוא native addon (Rust/N-API) — image חייב להיות glibc-based
# (node:22-slim, לא alpine/musl), אחרת ה-prebuilt binary לא ייטען.

FROM node:22-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/audio/package.json packages/audio/package.json
COPY packages/genres/package.json packages/genres/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/db/package.json packages/db/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile

COPY packages/core packages/core
COPY packages/shared packages/shared
COPY packages/audio packages/audio
COPY packages/genres packages/genres
COPY packages/storage packages/storage
COPY packages/db packages/db
COPY apps/worker apps/worker

RUN pnpm --filter worker build

WORKDIR /app/apps/worker
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
