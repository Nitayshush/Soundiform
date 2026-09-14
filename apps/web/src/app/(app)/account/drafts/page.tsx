/**
 * @file        page.tsx
 * @description ⭐ 2026-09-13 (לפי בקשה חיה): "My Drafts" — ציורים שנשמרו (Save) אבל **לא**
 *              רונדרו אף פעם (אין להם אף renders row) — נפרד לגמרי מ-My Gallery, כי לטיוטה
 *              אין וידאו/פוסטר/ז'אנר-badge/קישור-שיתוף (כל אלה נוצרים רק ברינדור, ראה
 *              api/render/client/complete/route.ts). ברגע שטיוטה מורדת (Download) בפעם
 *              הראשונה, יש לה render — והיא "מסיימת" את דרכה כאן ועוברת ל-My Gallery.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ כל לחיצה על Save יוצרת שורת projects **חדשה** (POST /api/projects הוא insert תמיד, לא
 * upsert) — כלומר טיוטות מרובות מאותו ציור שנשמר כמה פעמים הן צפויות, לא באג.
 *
 * ⭐⭐ 2026-09-13 (נתפס בבדיקה חיה, "כמו שהגדרנו כבר בעבר"): להעלאת תמונה/לוגו יש קובץ
 * מקורי (uploadKey) — המשתמש **לעולם לא** אמור לראות את השרטוט-הווקטורי שהמערכת מפיקה ממנו
 * לצורך המרה לצליל (זה פנימי-בלבד, אותה החלטה כמו UploadedImageLayer.tsx בסטודיו עצמו).
 * לכן טיוטה עם uploadKey מציגה את `/api/projects/{id}/upload` (הקובץ המקורי, כבר קיים
 * ומשומש בדף השיתוף/גלריה) — ShapePreviewSvg (שרטוט הנקודות) מוצג רק לציור-ביד אמיתי,
 * שבו "השרטוט" *הוא* היצירה עצמה, לא תוצר-לוואי פנימי.
 */

import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, projects, renders } from '@soundiform/db';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { ShapePreviewSvg } from '@/components/canvas/ShapePreviewSvg';
import { ContinueDraftButton } from '@/components/gallery/ContinueDraftButton';
import { EditDetailsButton } from '@/components/gallery/EditDetailsButton';
import { DeleteCreationButton } from '@/components/gallery/DeleteCreationButton';

export default async function MyDraftsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/account/drafts');
  }

  const db = getDb();
  const drafts = await db
    .select({
      id: projects.id,
      shapeData: projects.shapeData,
      sourceType: projects.sourceType,
      uploadKey: projects.uploadKey,
      title: projects.title,
      description: projects.description,
      keywords: projects.keywords,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(renders, eq(renders.projectId, projects.id))
    .where(and(eq(projects.userId, user.id), isNull(projects.deletedAt), isNull(renders.id)))
    .orderBy(desc(projects.createdAt));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">My Drafts</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Drawings you saved but haven&apos;t downloaded yet — no video, so they aren&apos;t in My
          Gallery. Download one from the Studio to make it shareable.
        </p>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No drafts — every drawing you Save without Downloading shows up here.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Card className="overflow-hidden border-border/60 p-0">
                  {draft.uploadKey ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed R2 redirect URL, not next/image-friendly (same as GalleryCard.tsx)
                    <img
                      src={`/api/projects/${draft.id}/upload`}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <ShapePreviewSvg
                      paths={draft.shapeData.paths}
                      className="aspect-video w-full bg-muted/40 text-foreground"
                    />
                  )}
                  <div className="flex flex-col gap-2 p-4">
                    <p className="truncate text-sm font-medium">
                      {draft.title ?? 'Untitled draft'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <ContinueDraftButton
                        projectId={draft.id}
                        paths={draft.shapeData.paths}
                        sourceType={draft.sourceType}
                        uploadKey={draft.uploadKey}
                      />
                      <EditDetailsButton
                        projectId={draft.id}
                        title={draft.title ?? 'Untitled draft'}
                        description={draft.description}
                        keywords={draft.keywords}
                      />
                      <DeleteCreationButton deleteUrl={`/api/projects/${draft.id}`} />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
