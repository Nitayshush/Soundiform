/**
 * @file        ContinueDraftButton.tsx
 * @description ⭐ 2026-09-13 (My Drafts): טוען טיוטה (ציור שנשמר, לא רונדר) בחזרה ל-shapeStore
 *              ומעביר לסטודיו — בדיוק אותו דפוס כמו RemixButton.tsx (loadShape + navigate),
 *              רק בלי remixOf/genreId (טיוטה היא הציור-של-עצמך, לא רמיקס של יצירת מישהו אחר).
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ Save הבא על הטיוטה הזו ייצור שורת projects **חדשה** (POST /api/projects הוא insert
 * תמיד, לא upsert — ראה api/projects/route.ts) — זה מכוון וזהה להתנהגות היום, לא רגרסיה
 * חדשה: אין בשום מקום באתר מנגנון "לעדכן פרויקט קיים במקום ליצור חדש".
 *
 * ⭐⭐ 2026-09-13 (נתפס בבדיקה חיה, "המשתמש אסור שיראה את השרטוט"): loadShape לבדו מאפס
 * savedProjectId ל-null (ראה shapeStore.ts) — ובלעדיו UploadedImageLayer.tsx לא יודע לשלוף
 * את התמונה המקורית מהשרת (`/api/projects/{id}/upload`, אותו נתיב-בדיוק ש-My Drafts כבר
 * משתמש בו), ונופל בחזרה לשלד השחור-לבן. setSavedProjectId(projectId) **אחרי** loadShape
 * הוא מה שמדליק את אותו fallback — אותו projectId האמיתי, לא מזויף.
 */

'use client';

import { useRouter } from 'next/navigation';
import type { ShapePath } from '@soundiform/shared';
import { useShapeStore, type ShapeSourceType } from '@/stores/shapeStore';
import { Button } from '@/components/ui/button';

export interface ContinueDraftButtonProps {
  projectId: string;
  paths: ShapePath[];
  sourceType: ShapeSourceType;
  uploadKey: string | null;
}

export function ContinueDraftButton({
  projectId,
  paths,
  sourceType,
  uploadKey,
}: ContinueDraftButtonProps) {
  const router = useRouter();
  const loadShape = useShapeStore((state) => state.loadShape);
  const setSavedProjectId = useShapeStore((state) => state.setSavedProjectId);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        loadShape(paths, { sourceType, uploadKey });
        setSavedProjectId(projectId);
        router.push('/studio');
      }}
    >
      Continue in Studio
    </Button>
  );
}
