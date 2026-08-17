# Dockerfile — apps/worker
# ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
#
# TODO(Sprint 6): להשלים בסיס עובד — כרגע שלד בלבד.
# דורש: Node 22, ffmpeg מותקן (apt-get install ffmpeg), pnpm.

FROM node:22-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# TODO: להעתיק את כל ה-monorepo הדרוש (pnpm-workspace.yaml, packages/*, apps/worker),
# להריץ pnpm install --frozen-lockfile ו-pnpm --filter worker build, ואז להריץ dist/index.js.
