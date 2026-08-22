/**
 * @file        route.ts
 * @description ⭐ 2026-08-22 (§11 item 8): polling endpoint לסטטוס render job — לא היה קיים
 *              עד עכשיו, למרות ש-POST /api/render מחזיר jobId מאז Sprint 6. הפכה "מה קורה
 *              עם הרינדור שלי" מבלתי-אפשרי (אין שום נתיב שקורא jobId בחזרה) לזמין.
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בכוונה בלי אימות — הסטטוס עצמו לא רגיש (לא חושף תוכן, רק "waiting/active/completed/
 * failed" + renderId). הקבצים בפועל מוגנים תמיד דרך api/renders/[renderId]/download.
 */

import { NextResponse } from 'next/server';
import { getRenderJobStatus } from '@/lib/renderQueue';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { jobId } = await params;
  const status = await getRenderJobStatus(jobId);
  return NextResponse.json(status);
}
