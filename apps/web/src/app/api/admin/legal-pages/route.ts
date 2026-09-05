/**
 * @file        route.ts
 * @description ⭐ 2026-09-06: עריכת legal_pages (תנאי שימוש) בלי דיפלוי — אותה תבנית בדיוק
 *              כמו api/admin/genre-packs/route.ts. GET מחזיר את כולם; PATCH עושה upsert
 *              (insert אם ה-slug עוד לא קיים, update אם כן) — בניגוד ל-genre-packs, אין כאן
 *              שורות קבועות-מראש שחייבות כבר להתקיים לפני העריכה הראשונה.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { legalPages, getDb, recordAuditLog } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const patchSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const pages = await getDb().select().from(legalPages);
  return NextResponse.json({ pages });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { slug, title, content } = parsed.data;

  const [updated] = await getDb()
    .insert(legalPages)
    .values({ slug, title, content })
    .onConflictDoUpdate({
      target: legalPages.slug,
      set: { title, content, updatedAt: new Date() },
    })
    .returning();

  await recordAuditLog({
    actorId: admin.id,
    action: 'legal_page.update',
    target: `legal_pages:${slug}`,
    metadata: { title },
  });

  return NextResponse.json({ page: updated });
}
