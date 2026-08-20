/**
 * @file        route.ts
 * @description העלאת קבצים (SVG/raster) — presigned URL ל-R2. ראה PROJECT.md §7, §8 שרשרת ההגנה.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';

// TODO(Sprint 0/2): מימוש שרשרת ההגנה המלאה מ-§8 — גודל, magic bytes, svgo+DOMPurify,
// sharp re-encode, תור מודרציה — לפני חיבור בפועל ל-packages/storage.

export function POST() {
  return NextResponse.json({ error: 'לא ממומש עדיין' }, { status: 501 });
}
