/**
 * @file        route.ts
 * @description ⭐ עריכת GenrePack ללא דיפלוי (§11 Sprint 9 — פריט מרכזי). GET מחזיר את כולם
 *              (גם is_active=false, בניגוד ל-api/genres/route.ts הציבורי); PATCH מעדכן שורה
 *              אחת. כותב audit_log (§8 "חובה").
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ config מאומת מול genrePackSchema (@soundiform/genres) לפני כתיבה — לעולם לא כותבים
 * JSON חופשי ל-DB בלי ולידציה (§0.3), במיוחד כשקליינטים אחרים (Studio, api/render) סומכים
 * על הצורה שלו.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { genrePackSchema } from '@soundiform/genres';
import { genrePacks, getDb, recordAuditLog } from '@soundiform/db';
import { getAdminUser } from '@/lib/adminAuth';

const patchSchema = z.object({
  id: z.string().min(1),
  config: genrePackSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const packs = await getDb().select().from(genrePacks).orderBy(genrePacks.sortOrder);
  return NextResponse.json({ packs });
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
  const { id, config, isActive, sortOrder } = parsed.data;
  if (config === undefined && isActive === undefined && sortOrder === undefined) {
    return NextResponse.json({ error: 'No field to update was sent' }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(genrePacks)
    .set({
      ...(config !== undefined && { config }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(genrePacks.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'GenrePack not found' }, { status: 404 });
  }

  await recordAuditLog({
    actorId: admin.id,
    action: 'genre_pack.update',
    target: `genre_packs:${id}`,
    metadata: { config: config !== undefined, isActive, sortOrder },
  });

  return NextResponse.json({ pack: updated });
}
