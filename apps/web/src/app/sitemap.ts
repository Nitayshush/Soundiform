/**
 * @file        sitemap.ts
 * @description ⭐ 2026-09-12: MetadataRoute.Sitemap הילידי של Next.js — עמודי שיווק סטטיים
 *              ועוד כל share ציבורי (/s/[slug]) ופרופיל ציבורי (/u/[username]) בפועל,
 *              נשלף חי מה-DB (אותה תבנית כמו כל דף server-rendered אחר כאן — getDb()).
 * @author      Soundiform
 * @created     2026-09-12
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ 'private' ו-'unlisted' לא נכללים בכוונה — 'private' חסום גם בקישור ישיר
 * (s/[shareId]/page.tsx), ו'unlisted' מוגדר להימצא רק ע"י מי שיש לו את הקישור, לא ע"י חיפוש.
 *
 * ⭐⭐ 2026-09-14 (נתפס בבדיקה חיה בפרודקשן: כל הכתובות הצביעו על localhost): הנתיב הזה לא
 * השתמש בשום API דינמי (headers()/cookies()), אז Next.js פרש אותו כסטטי ורינדר אותו **פעם
 * אחת בזמן ה-build** — קפא עם כתובת-fallback (getSiteUrl() נופל ל-localhost כשאין לו הקשר-
 * runtime אמיתי, ראה siteUrl.ts) ועם צילום-מצב קפוא של השיתופים הציבוריים באותו רגע. גם אחרי
 * שהתיקון-הבא יתקן את הכתובת, בלי force-dynamic יצירות ציבוריות חדשות פשוט לא היו נכנסות
 * ל-sitemap בלי deploy חדש בכל פעם — לא שימושי לכלי שאמור להישאר עדכני עם התוכן.
 */

import type { MetadataRoute } from 'next';
import { eq, isNotNull } from 'drizzle-orm';
import { getDb, shares, users } from '@soundiform/db';
import { getSiteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = getDb();

  const [publicShares, publicProfiles] = await Promise.all([
    db
      .select({ slug: shares.slug, createdAt: shares.createdAt })
      .from(shares)
      .where(eq(shares.visibility, 'public')),
    db
      .select({ username: users.username, createdAt: users.createdAt })
      .from(users)
      .where(isNotNull(users.username)),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/gallery`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const shareEntries: MetadataRoute.Sitemap = publicShares.map((row) => ({
    url: `${siteUrl}/s/${row.slug}`,
    lastModified: row.createdAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const profileEntries: MetadataRoute.Sitemap = publicProfiles
    .filter((row): row is { username: string; createdAt: Date } => Boolean(row.username))
    .map((row) => ({
      url: `${siteUrl}/u/${row.username}`,
      lastModified: row.createdAt,
      changeFrequency: 'weekly',
      priority: 0.4,
    }));

  return [...staticEntries, ...shareEntries, ...profileEntries];
}
