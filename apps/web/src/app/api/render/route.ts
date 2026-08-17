/**
 * @file        route.ts
 * @description הפעלת רנדור אודיו/וידאו — מעביר עבודה ל-worker דרך BullMQ. ראה PROJECT.md §11 Sprint 6.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';

// TODO(Sprint 6): Zod, rate limiting (§8: 3/שעה אנונימי), הוספה לתור BullMQ.

export function POST() {
  return NextResponse.json({ error: 'לא ממומש עדיין' }, { status: 501 });
}
