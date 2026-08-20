/**
 * @file        opengraph-image.tsx
 * @description ⭐ תמונת ה-OG = הצורה עצמה (§11 Sprint 8) — ממש מה שהמשתמש צייר, לא לוגו גנרי.
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ runtime='nodejs' חובה: getDb() (postgres.js, socket TCP אמיתי) לא עובד ב-edge runtime,
 * שהוא ברירת המחדל של next/og. satori (מנוע ה-ImageResponse) תומך ב-<img> עם SVG כ-data URI —
 * זה איך שהצורה עצמה (polylines מנורמלות) מצוירת כתמונה, לא רק טקסט גנרי.
 */

import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders, shares } from '@soundiform/db';
import type { ShapePath } from '@soundiform/shared';

export const runtime = 'nodejs';
export const alt = 'Soundiform — יצירה משותפת';
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

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const db = getDb();
  const [row] = await db
    .select({ shapeData: projects.shapeData })
    .from(shares)
    .innerJoin(renders, eq(shares.renderId, renders.id))
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(shares.slug, shareId));

  const svgDataUri = row
    ? buildShapeSvgDataUri(row.shapeData.paths, size.width, size.height)
    : null;

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
      {svgDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/og דורש <img>, לא next/image
        <img src={svgDataUri} width={size.width} height={size.height} alt="" />
      ) : (
        <div style={{ fontSize: 48, color: STROKE_COLOR }}>Soundiform</div>
      )}
    </div>,
    { ...size },
  );
}
