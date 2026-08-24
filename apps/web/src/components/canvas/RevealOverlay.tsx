/**
 * @file        RevealOverlay.tsx
 * @description ⭐ מצב "איך זה נבנה" — חושף את מיפוי הצורה הספציפית למוזיקה (§4.2, §4.4).
 *              שובץ ב-Sprint 5 בעקבות ניתוח מתחרים (2026-08-17, ראה docs/DECISIONS.md):
 *              זו שקיפות שאין ל-Kandinsky/Mubert — לא מוקדם יותר, כי רק אחרי Sprint 4+5
 *              יש סאונד וז'אנרים אמיתיים לחשוף.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה חישוב עצמאי (לא קורא ל-useAudioEngine):
 * החשיפה אמורה לעבוד גם *לפני* לחיצה על נגן — "ככה זה יישמע" הוא חלק מהערך החינוכי/ויראלי.
 * RawMusicalIntent הוא ממילא בלתי-תלוי-סגנון (§4.5: התוכן מהצורה) — אין צורך ב-genreId כאן.
 */

import { useMemo, useState } from 'react';
import { analyzeShape, detectSymmetry, extractContour, geometryToMusic } from '@soundiform/core';
import { useShapeStore } from '@/stores/shapeStore';

const SYMMETRY_TRANSFORM_LABELS: Record<string, string> = {
  none: 'No meaningful symmetry',
  retrograde: 'Horizontal mirror → retrograde (second half plays backward in time)',
  inversion: 'Vertical mirror → inversion (second half is intervallically inverted)',
  'retrograde-inversion': 'Double mirror → retrograde+inversion',
};

export function RevealOverlay() {
  const paths = useShapeStore((state) => state.paths);
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const [isOpen, setIsOpen] = useState(false);

  const analysis = useMemo(() => {
    if (paths.length === 0 || !shapeHash) {
      return null;
    }
    const shape = { version: '1.0.0', paths };
    const contour = extractContour(shape);
    const features = analyzeShape(contour);
    const symmetry = detectSymmetry(contour);
    const intent = geometryToMusic(shape, shapeHash);
    return { features, symmetry, intent };
  }, [paths, shapeHash]);

  if (!analysis) {
    return null;
  }
  const { features, symmetry, intent } = analysis;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className="pointer-events-auto rounded-full border bg-background/90 px-3 py-1 text-sm shadow"
      >
        {isOpen ? 'Close' : 'How is this built?'}
      </button>
      {/* ⭐ 2026-08-24 (מובייל): max-h+overflow-y-auto על ה-aside — הקופסה עצמה יכולה להיות
          נמוכה מאוד בנייד (ריבועי, ~193px), והפאנל עלול לחרוג מהגובה הזה בלי הגנה. */}
      {isOpen && (
        <aside className="pointer-events-auto max-h-[70vh] max-w-xs overflow-y-auto rounded-lg border bg-background/95 p-4 text-sm shadow-lg">
          <h2 className="mb-2 font-semibold">From your shape to music</h2>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {features.vertexCount >= 3 ? 'Vertices' : 'Smooth shape (rotational symmetry)'}
              </dt>
              <dd>{intent.motifSize}-note motif</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Contour</dt>
              <dd>{features.closed ? 'Closed → loop/ostinato' : 'Open'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Mirror symmetry</dt>
              <dd className="text-right">
                {SYMMETRY_TRANSFORM_LABELS[intent.symmetryTransform] ?? intent.symmetryTransform}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rotational symmetry</dt>
              <dd>Order {symmetry.rotationalOrder}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Angles</dt>
              <dd>{intent.articulation === 'staccato' ? 'Sharp → staccato' : 'Smooth → legato'}</dd>
            </div>
          </dl>
        </aside>
      )}
    </div>
  );
}
