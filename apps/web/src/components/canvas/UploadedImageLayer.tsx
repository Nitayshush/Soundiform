/**
 * @file        UploadedImageLayer.tsx
 * @description ⭐ 2026-09-02: התמונה שהמשתמש העלה, מוצגת על הלוח **במקום השלד**.
 * @author      Soundiform
 * @created     2026-09-02
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ **שכבת תצוגה בלבד — היא לא נוגעת במוזיקה.** הצליל נגזר מ-`ShapeData` (השלד ש-potrace
 * חילץ), והשלד ממשיך להתקיים בדיוק כפי שהיה. השכבה הזו רק מכסה אותו ויזואלית, כדי שהמשתמש
 * יראה את התמונה שלו ולא מתאר שחור-לבן. אם היא תוסר, הצליל לא ישתנה בכהוא זה.
 *
 * ⚠️ **סדר השכבות חשוב.** היא יושבת מעל DrawingCanvas ו-MusicalGrid, אבל **מתחת ל-ScoreStaff** —
 * כך שקו-הסורק, פסי-התווים והבזקי-האור נשארים גלויים מעליה. זו בדיוק ההתנהגות שהתבקשה:
 * התמונה נראית, ומעליה נדלקים ההבזקים במקומות שבהם הסורק פוגש את השלד שמתחת.
 *
 * ⚠️ `pointer-events-none` הכרחי — בלעדיו השכבה חוסמת את הציור בעכבר/מגע על הקנבס שמתחתיה.
 *
 * ⚠️ `object-contain` ולא `cover`: הצורה שנשלחה למנוע מנורמלת ל-[0,1] על שני הצירים, אז
 * חיתוך התמונה היה יוצר אי-התאמה בין מה שנראה לבין מה שנשמע. contain שומר על היחס המקורי,
 * והרקע הלבן של הבמה ממלא את השוליים.
 */

'use client';

import { useState } from 'react';
import { useShapeStore } from '@/stores/shapeStore';

export function UploadedImageLayer() {
  const previewImageUrl = useShapeStore((state) => state.previewImageUrl);
  const savedProjectId = useShapeStore((state) => state.savedProjectId);
  const sourceType = useShapeStore((state) => state.sourceType);
  const [serverImageFailed, setServerImageFailed] = useState(false);

  /**
   * ⭐ 2026-09-02: אחרי רענון ה-object URL כבר לא קיים — ואז מושכים את הקובץ המקורי
   * מהשרת, אבל **רק אם המשתמש שמר את היצירה**.
   *
   * ⚠️ זו החלטת מוצר מפורשת: לפני שמירה לא מחזיקים את התמונה בשום מקום מתמיד. משתמש
   * שהעלה תמונה ולא שמר — התמונה נעלמת ברענון, וזה בסדר; זה חוסך אחסון ועיבוד על קבצים
   * שאיש לא ביקש לשמור.
   *
   * ⚠️ הנתיב מחזיר 404 לפרויקט מצויר-ביד (אין לו upload_key) — מצב תקין לגמרי, ולכן
   * onError פשוט מסתיר את השכבה במקום להציג שבור.
   */
  const serverImageUrl =
    !previewImageUrl && savedProjectId && sourceType === 'raster' && !serverImageFailed
      ? `/api/projects/${savedProjectId}/upload`
      : null;
  const src = previewImageUrl ?? serverImageUrl;

  if (!src) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL מקומי, לא נכס
          שאפשר לעבד ב-next/image; אין כאן בקשת רשת בכלל. */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
        draggable={false}
        onError={() => {
          setServerImageFailed(true);
        }}
      />
    </div>
  );
}
