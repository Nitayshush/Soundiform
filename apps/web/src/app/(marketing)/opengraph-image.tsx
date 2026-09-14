/**
 * @file        opengraph-image.tsx
 * @description ⭐ 2026-09-14 (לפי בקשה חיה): תמונת-שיתוף לדף הבית — עד עכשיו שיתוף
 *              הקישור הראשי של האתר ברשתות חברתיות לא הציג שום תמונה ייעודית.
 * @author      Soundiform
 * @created     2026-09-14
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בלי DB — לא צריך runtime='nodejs' (ראה s/[shareId]/opengraph-image.tsx לעומת זאת).
 * edge (ברירת המחדל) מספיק, ומאפשר ל-Next.js לבצע caching בזמן build כי אין כאן שום נתון
 * תלוי-בקשה — ראה next/og docs: "statically optimized unless using Request-time APIs".
 */

import { ImageResponse } from 'next/og';
import { brandMarkDataUri } from '@/lib/brandMark';

export const alt = 'Soundiform — turn shapes into music';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#211B4A',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og דורש <img>, לא next/image */}
      <img src={brandMarkDataUri()} width={180} height={180} alt="" />
      <div
        style={{
          marginTop: 32,
          fontSize: 72,
          fontWeight: 700,
          color: '#EFECFF',
        }}
      >
        Soundiform
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 32,
          color: '#B6ABF0',
        }}
      >
        Turn shapes, drawings, and logos into music
      </div>
    </div>,
    { ...size },
  );
}
