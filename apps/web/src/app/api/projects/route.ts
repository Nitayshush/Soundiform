/**
 * @file        route.ts
 * @description CRUD על פרויקטים (צורות שמורות). ראה PROJECT.md §6 טבלת projects.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';

// TODO(Sprint 2+): ולידציית Zod על גוף הבקשה, חיבור ל-packages/db, RLS לפי §0.3.

export function GET() {
  return NextResponse.json({ error: 'לא ממומש עדיין' }, { status: 501 });
}

export function POST() {
  return NextResponse.json({ error: 'לא ממומש עדיין' }, { status: 501 });
}
