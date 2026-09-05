/**
 * @file        page.tsx
 * @description ⭐ 2026-09-06: תנאי שימוש — Server Component שקורא legal_pages ישירות
 *              (getDb(), אותה גישה כמו pricing/page.tsx) כדי שעריכה בפאנל האדמין תשתקף
 *              מיידית, בלי דיפלוי. אין לוגיקת accept/consent כאן — זה רק תצוגת התוכן;
 *              האישור בפועל קורה בעת הרשמה, ראה (auth)/login/page.tsx.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { eq } from 'drizzle-orm';
import { getDb, legalPages } from '@soundiform/db';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SLUG = 'terms';

export default async function TermsPage() {
  const [page] = await getDb().select().from(legalPages).where(eq(legalPages.slug, SLUG));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">{page?.title ?? 'Terms of Service'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            {page ? (
              page.content
                .split(/\n\s*\n/)
                .map((paragraph, index) => <p key={index}>{paragraph.trim()}</p>)
            ) : (
              <p>This page is being prepared.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
