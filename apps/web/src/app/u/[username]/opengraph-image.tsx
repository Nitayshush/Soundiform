/**
 * @file        opengraph-image.tsx
 * @description ⭐ 2026-09-14 (לפי בקשה חיה): תמונת-שיתוף לפרופיל ציבורי — תמונת-הפרופיל של
 *              המשתמש + "Come see my creations on Soundiform". עד עכשיו שיתוף פרופיל לא
 *              הציג שום תמונה.
 * @author      Soundiform
 * @created     2026-09-14
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ runtime='nodejs' חובה: getDb() לא עובד ב-edge runtime — אותה סיבה בדיוק כמו
 * s/[shareId]/opengraph-image.tsx.
 *
 * ⚠️ שליפת האווטאר **לא** מפרשת את מחרוזת avatarUrl (יכולה להיות נתיב-פנימי-יחסי, URL
 * חיצוני-מלא של OAuth, או null — ראה users.ts/api/account/avatar/route.ts) — במקום זה
 * בודקים ישירות מול R2 אם קיים `avatars/{userId}.png` (בדיוק אותו מפתח ש-
 * api/account/avatar/[userId]/route.ts כבר משתמש בו), ורק אם לא — נופלים ל-avatarUrl
 * כ-URL חיצוני מלא, ורק אם גם זה לא — לסימן-המותג (אותו fallback-אווטאר קיים כבר
 * ב-GalleryCard.tsx/u/[username]/page.tsx: `avatarUrl ?? '/icon.svg'`).
 */

import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { brandMarkDataUri } from '@/lib/brandMark';

export const runtime = 'nodejs';
export const alt = 'Soundiform — creator profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BACKGROUND = '#211B4A';
const AVATAR_SIZE = 220;

/**
 * ⚠️ 2026-09-14 (נתפס בבדיקה חיה: "TypeError: Invalid JPEG"): mimeType כברירת-מחדל קבועה
 * ('image/jpeg') הייתה שגויה עבור אווטארים חיצוניים (OAuth) — ספקים שונים מחזירים PNG/WEBP
 * וכו', לא תמיד JPEG. עכשיו קורא את ה-Content-Type האמיתי מהתשובה; fallback רק אם חסר.
 */
async function fetchAsDataUri(url: string, fallbackMimeType: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const mimeType = response.headers.get('content-type') ?? fallbackMimeType;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.warn('opengraph-image (profile): avatar fetch failed', error);
    return null;
  }
}

async function resolveAvatarDataUri(userId: string, avatarUrl: string | null): Promise<string> {
  const storage = createR2ProviderFromEnv();
  const uploadedKey = `avatars/${userId}.png`;
  const uploadedMeta = await storage.headObject(uploadedKey).catch(() => null);
  if (uploadedMeta) {
    const uploadedUrl = await storage.getDownloadUrl(uploadedKey);
    const dataUri = await fetchAsDataUri(uploadedUrl, 'image/png');
    if (dataUri) {
      return dataUri;
    }
  }
  if (avatarUrl?.startsWith('http')) {
    const dataUri = await fetchAsDataUri(avatarUrl, 'image/jpeg');
    if (dataUri) {
      return dataUri;
    }
  }
  return brandMarkDataUri();
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = getDb();
  const [profile] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.username, username));

  if (!profile) {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BACKGROUND,
          fontSize: 48,
          color: '#EFECFF',
        }}
      >
        Soundiform
      </div>,
      { ...size },
    );
  }

  const avatarDataUri = await resolveAvatarDataUri(profile.id, profile.avatarUrl);
  const name = profile.displayName ?? `@${profile.username}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: BACKGROUND,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og דורש <img>, לא next/image */}
      <img
        src={avatarDataUri}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        alt=""
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
      <div
        style={{
          marginTop: 32,
          fontSize: 56,
          fontWeight: 700,
          color: '#EFECFF',
        }}
      >
        {name}
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 32,
          color: '#B6ABF0',
        }}
      >
        Come see my creations on Soundiform
      </div>
    </div>,
    { ...size },
  );
}
