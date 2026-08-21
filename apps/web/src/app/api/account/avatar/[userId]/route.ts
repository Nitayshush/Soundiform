/**
 * @file        route.ts
 * @description ⭐ הגשת תמונת פרופיל — ציבורי (בלי אימות בכוונה, מוצג בדפי פרופיל ציבוריים
 *              /u/[username]). מנפיק URL חתום טרי ל-R2 בכל בקשה ומפנה אליו (redirect), כי
 *              §7 אוסר bucket ציבורי — גם עבור תמונות לא-רגישות כמו אווטאר.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { createR2ProviderFromEnv } from '@soundiform/storage';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { userId } = await params;
  const storage = createR2ProviderFromEnv();
  const key = `avatars/${userId}.png`;

  const metadata = await storage.headObject(key);
  if (!metadata) {
    return NextResponse.json({ error: 'No avatar' }, { status: 404 });
  }

  const signedUrl = await storage.getDownloadUrl(key);
  return NextResponse.redirect(signedUrl);
}
