/**
 * @file        route.ts
 * @description ⭐ הורדת קבצי render — audio/video/midi/stem, מדורג לפי plan (§9). הפורמט
 *              (mp3/wav, איכות/watermark הווידאו) נקבע לפי plan של *היוצר* (בעל ה-project),
 *              לא של המוריד — אותו עיקרון כמו watermark הווידאו (§11: נקבע פעם אחת ברינדור,
 *              לא per-viewer). MIDI/stems (studio בלבד) זמינים רק לבעלים עצמו — לא לצופה
 *              בדף שיתוף ציבורי (§11 item 7). video, כמו audio, זמין לכל בעל-גישה (owner
 *              או צופה share ציבורי) — לא studio-gated, בדיוק כמו טבלת האיכויות ב-§9.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, projects, renders, shares, resolveEffectivePlan } from '@soundiform/db';
import { createR2ProviderFromEnv } from '@soundiform/storage';
import { createClient } from '@/lib/supabase/server';

const TRACK_ROLES = ['bass', 'lead', 'pad', 'drums', 'skank'] as const;

const querySchema = z.object({
  type: z.enum(['audio', 'video', 'midi', 'stem']),
  role: z.enum(TRACK_ROLES).optional(),
});

interface RouteParams {
  params: Promise<{ renderId: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { renderId } = await params;
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    type: url.searchParams.get('type'),
    role: url.searchParams.get('role') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { type, role } = parsedQuery.data;
  if (type === 'stem' && !role) {
    return NextResponse.json({ error: 'role is required for type=stem' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      audioKey: renders.audioKey,
      mp3Key: renders.mp3Key,
      videoKey: renders.videoKey,
      midiKey: renders.midiKey,
      stemKeys: renders.stemKeys,
      ownerId: projects.userId,
    })
    .from(renders)
    .innerJoin(projects, eq(renders.projectId, projects.id))
    .where(eq(renders.id, renderId));

  if (!row || !row.ownerId) {
    return NextResponse.json({ error: 'Render not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === row.ownerId;
  const { plan: ownerPlan } = await resolveEffectivePlan(row.ownerId);

  if (!isOwner) {
    const [shareRow] = await db
      .select({ slug: shares.slug })
      .from(shares)
      .where(eq(shares.renderId, renderId));
    if (!shareRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  let key: string | null | undefined;
  let filename: string;

  if (type === 'audio') {
    const wantsWav = ownerPlan !== 'free';
    key = wantsWav ? row.audioKey : row.mp3Key;
    filename = wantsWav ? 'soundiform.wav' : 'soundiform.mp3';
  } else if (type === 'video') {
    key = row.videoKey;
    filename = 'soundiform.mp4';
  } else if (type === 'midi') {
    if (!isOwner || ownerPlan !== 'studio') {
      return NextResponse.json(
        { error: 'MIDI download requires the Studio plan' },
        { status: 403 },
      );
    }
    key = row.midiKey;
    filename = 'soundiform.mid';
  } else {
    if (!isOwner || ownerPlan !== 'studio') {
      return NextResponse.json(
        { error: 'Stem download requires the Studio plan' },
        { status: 403 },
      );
    }
    key = row.stemKeys?.[role!];
    filename = `soundiform-${role}.wav`;
  }

  if (!key) {
    return NextResponse.json({ error: 'File not available' }, { status: 404 });
  }

  // ⭐ 2026-08-22: בלי Content-Disposition: attachment, הדפדפן פשוט מנווט ל-URL החתום
  // (מציג/מנגן inline) — לא מוריד קובץ בפועל, בדיוק הבאג שבדיקה חיה תפסה בכפתור Download.
  const storage = createR2ProviderFromEnv();
  const signedUrl = await storage.getDownloadUrl(key, {
    responseContentDisposition: `attachment; filename="${filename}"`,
  });
  return NextResponse.redirect(signedUrl);
}
