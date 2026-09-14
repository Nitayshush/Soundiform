/**
 * @file        opengraph-image.tsx
 * @description ⭐ תמונת ה-OG — הפוסטר האמיתי של הווידאו (הפריים ששמור ב-R2, renders.posterKey)
 *              כשהוא קיים. ⭐⭐ 2026-09-14 (לפי בקשה חיה: "בשיתוף סרטון וידאו צריך שיופיע
 *              הדף הראשי של הסרטון"): לפני זה תמיד צויר תרשים-קווים מופשט של הצורה
 *              (§11 Sprint 8) — זה נשאר כ-**fallback בלבד**, ליצירות בלי פוסטר עדיין
 *              (אודיו-בלבד, או renders מלפני שנוסף poster) — לא הוסר, רק כבר לא ברירת המחדל.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ runtime='nodejs' חובה: getDb() (postgres.js, socket TCP אמיתי) לא עובד ב-edge runtime,
 * שהוא ברירת המחדל של next/og. satori (מנוע ה-ImageResponse) תומך ב-<img> עם SVG/תמונה
 * כ-data URI — זה איך שגם הצורה ה-fallback וגם הפוסטר מוטבעים.
 *
 * ⚠️ הפוסטר נשלף ישירות מ-R2 (getDownloadUrl+fetch), לא דרך api/renders/.../download —
 * הנתיב הציבורי הוא redirect, ו-satori/fetch כאן כבר רצים בצד-שרת עם הרשאות R2 זמינות;
 * קפיצה נוספת דרך HTTP משלנו רק מוסיפה latency בלי שום תועלת. ⚠️ עטוף ב-try/catch: כשל
 * רשת חד-פעמי לא אמור לשבור את כל התמונה — נופל בחזרה לצורת-הקווים, לא לתמונה שבורה.
 */

import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders, shares } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import type { ShapePath } from '@soundiform/shared';

export const runtime = 'nodejs';
export const alt = 'Soundiform — shared creation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const STROKE_COLOR = '#111827';
const PADDING = 60;

function buildShapeSvgDataUri(paths: ShapePath[], width: number, height: number): string {
  const drawWidth = width - PADDING * 2;
  const drawHeight = height - PADDING * 2;
  const pathElements = paths
    .filter((path) => path.points.length >= 2)
    .map((path) => {
      const d = path.points
        .map((point, index) => {
          const command = index === 0 ? 'M' : 'L';
          return `${command} ${(point.x * drawWidth + PADDING).toFixed(1)} ${(point.y * drawHeight + PADDING).toFixed(1)}`;
        })
        .join(' ');
      return `<path d="${d}${path.closed ? ' Z' : ''}" fill="none" stroke="${STROKE_COLOR}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><rect width="${String(width)}" height="${String(height)}" fill="#ffffff" />${pathElements}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** null אם אין posterKey, או אם השליפה מ-R2 נכשלת — הקורא נופל בחזרה לצורת-הקווים. */
async function buildPosterDataUri(posterKey: string | null): Promise<string | null> {
  if (!posterKey) {
    return null;
  }
  try {
    const storage = createR2ProviderFromEnv();
    const posterUrl = await storage.getDownloadUrl(posterKey);
    const posterResponse = await fetch(posterUrl);
    if (!posterResponse.ok) {
      return null;
    }
    const posterBuffer = Buffer.from(await posterResponse.arrayBuffer());
    return `data:image/jpeg;base64,${posterBuffer.toString('base64')}`;
  } catch (error) {
    console.warn('opengraph-image: poster fetch failed, falling back to shape outline', error);
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const db = getDb();
  const [row] = await db
    .select({ shapeData: projects.shapeData, posterKey: renders.posterKey })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(shares.slug, shareId));

  const posterDataUri = row ? await buildPosterDataUri(row.posterKey) : null;
  const svgDataUri =
    row && !posterDataUri
      ? buildShapeSvgDataUri(row.shapeData.paths, size.width, size.height)
      : null;
  const imageDataUri = posterDataUri ?? svgDataUri;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/og דורש <img>, לא next/image
        <img
          src={imageDataUri}
          width={size.width}
          height={size.height}
          alt=""
          style={posterDataUri ? { objectFit: 'cover' } : undefined}
        />
      ) : (
        <div style={{ fontSize: 48, color: STROKE_COLOR }}>Soundiform</div>
      )}
    </div>,
    { ...size },
  );
}
