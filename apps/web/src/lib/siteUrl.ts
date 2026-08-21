/**
 * @file        siteUrl.ts
 * @description ⭐ כתובת בסיס מוחלטת של האתר — נחוצה ל-share-intent links (Twitter/Facebook/
 *              WhatsApp דורשים URL מוחלט, לא נתיב יחסי). ראה .env: NEXT_PUBLIC_APP_URL.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

const DEFAULT_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL;
}
