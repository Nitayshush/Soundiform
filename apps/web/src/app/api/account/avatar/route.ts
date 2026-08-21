/**
 * @file        route.ts
 * @description ⭐ העלאת תמונת פרופיל. מקטע מ-api/upload/route.ts (§8: magic bytes →
 *              sharp re-encode) אבל בלי חצי ה-ShapeData/potrace — זו תמונה, לא צורה.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ avatarUrl הנשמר ב-DB הוא נתיב יציב באתר עצמו (/api/account/avatar/{userId}), לא URL
 * חתום ישירות ל-R2 — כי URL חתום פוקע (ברירת מחדל 15 דק', §7), וצריך avatarUrl שנשאר תקף
 * לנצח. ה-route הציבורי תחת [userId]/route.ts מנפיק URL חתום טרי בכל בקשה (§7 "לעולם לא
 * bucket ציבורי" — גם תמונות פרופיל, שהן לא רגישות, לא יוצאות מהכלל הזה).
 */

import { NextResponse } from 'next/server';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { getDb, users } from '@soundiform/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { detectFileKind } from '@/lib/upload/detectFileKind';
import { toAvatarPng } from '@/lib/upload/avatarImage';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const SUPPORTED_KINDS = new Set(['png', 'jpeg', 'webp']);

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file sent (field: file)' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'File is larger than 5MB' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = await detectFileKind(buffer);
  if (!kind || !SUPPORTED_KINDS.has(kind)) {
    return NextResponse.json(
      { error: 'Unsupported file type — only PNG, JPEG, or WebP' },
      { status: 415 },
    );
  }

  const avatarPng = await toAvatarPng(buffer);
  const storage = createR2ProviderFromEnv();
  const key = `avatars/${user.id}.png`;
  const uploadUrl = await storage.getUploadUrl(key, { contentType: 'image/png' });
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(avatarPng),
    headers: { 'Content-Type': 'image/png' },
  });
  if (!putResponse.ok) {
    return NextResponse.json({ error: 'Avatar upload failed' }, { status: 502 });
  }

  const avatarUrl = `/api/account/avatar/${user.id}`;
  const db = getDb();
  await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl });
}
