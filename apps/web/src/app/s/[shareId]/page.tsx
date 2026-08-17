/**
 * @file        page.tsx
 * @description דף שיתוף ציבורי ליצירה בודדת (ראה PROJECT.md §11 Sprint 8, §9 מנוע הצמיחה).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;
  // TODO(Sprint 8): טעינת render לפי shares.slug, נגן, כפתור Remix, OG image.
  return (
    <main>
      <h1>שיתוף: {shareId}</h1>
    </main>
  );
}
