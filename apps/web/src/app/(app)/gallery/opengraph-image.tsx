/**
 * @file        opengraph-image.tsx
 * @description ⭐ 2026-09-14 (לפי בקשה חיה): תמונת-שיתוף לגלריה הראשית — אותה בקשה בדיוק
 *              כמו דף הבית (ראה (marketing)/opengraph-image.tsx). לא ייחודי-לפי-סגנון
 *              (?genre=) בכוונה — הבקשה הייתה "הגלריה הראשית", לא כל תצוגה מסוננת.
 * @author      Soundiform
 * @created     2026-09-14
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בלי DB — לא צריך runtime='nodejs', ראה (marketing)/opengraph-image.tsx להסבר זהה.
 */

import { ImageResponse } from 'next/og';
import { brandMarkDataUri } from '@/lib/brandMark';

export const alt = 'Soundiform Gallery';
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
      <img src={brandMarkDataUri()} width={140} height={140} alt="" />
      <div
        style={{
          marginTop: 28,
          fontSize: 64,
          fontWeight: 700,
          color: '#EFECFF',
        }}
      >
        Soundiform Gallery
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 30,
          color: '#B6ABF0',
        }}
      >
        Explore music made from drawings, shapes, and logos
      </div>
    </div>,
    { ...size },
  );
}
