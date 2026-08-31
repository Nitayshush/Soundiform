/**
 * @file        RemixButton.tsx
 * @description ⭐ "כל צופה הופך ליוצר בקליק" (§9, מנוע הצמיחה) — טוען את הצורה המשותפת
 *              ל-shapeStore ומעביר ל-studio. שורת remixes נרשמת רק כשהפרויקט-הבן נשמר בפועל
 *              (api/projects/route.ts, remixOf ב-query params).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useRouter } from 'next/navigation';
import type { ShapePath } from '@soundiform/shared';
import { useShapeStore } from '@/stores/shapeStore';
import { useGenreStore } from '@/stores/genreStore';
import { applyCreationSettings } from '@/lib/applyCreationSettings';
import { Button } from '@/components/ui/button';

export interface RemixButtonProps {
  renderId: string;
  paths: ShapePath[];
  genreId: string;
  /** ⚠️ `unknown` בכוונה — מגיע מ-jsonb ומאומת ב-applyCreationSettings, לא מומר. */
  creationSettings: unknown;
}

export function RemixButton({ renderId, paths, genreId, creationSettings }: RemixButtonProps) {
  const router = useRouter();
  const loadShape = useShapeStore((state) => state.loadShape);
  const setGenreId = useGenreStore((state) => state.setGenreId);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        loadShape(paths);
        // ⚠️ הסגנון קודם: ההגדרות נשמרות **לפי סגנון**, ולכן החלתן על הסגנון הלא-נכון
        // הייתה כותבת אותן למקום שאיש לא קורא ממנו — והרמיקס היה מתחיל מברירות המחדל.
        setGenreId(genreId);
        // ⭐ 2026-08-31: רמיקס מתחיל מהצליל, המקצב והסולם של המקור — זה מה ש"רמיקס" אומר.
        // בלי זה הוא היה נפתח עם ההגדרות המקומיות של המשתמש על ציור של מישהו אחר.
        applyCreationSettings(genreId, creationSettings);
        router.push(`/studio?remixOf=${renderId}`);
      }}
    >
      Remix
    </Button>
  );
}
