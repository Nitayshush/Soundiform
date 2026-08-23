/**
 * @file        route.ts
 * @description ⭐ הורדת קבצי render — audio/video/midi/stem/poster, מדורג לפי plan (§9). הפורמט
 *              (mp3/wav, איכות/watermark הווידאו) נקבע לפי plan של *היוצר* (בעל ה-project),
 *              לא של המוריד — אותו עיקרון כמו watermark הווידאו (§11: נקבע פעם אחת ברינדור,
 *              לא per-viewer). MIDI/stems (studio בלבד) זמינים רק לבעלים עצמו — לא לצופה
 *              בדף שיתוף ציבורי (§11 item 7). video/poster, כמו audio, זמינים לכל בעל-גישה
 *              (owner או צופה share ציבורי) — לא studio-gated, בדיוק כמו טבלת האיכויות ב-§9.
 *
 *              ⭐ 2026-08-22 (§11 גלריה): inline=1 מדלג על Content-Disposition: attachment —
 *              כדי שאותו signed URL ישמש גם ל-<video src>/<img src> בעמודי שיתוף/גלריה
 *              (השמעה/הצגה), לא רק להורדה בפועל (כפתור Download נשאר attachment, ברירת
 *              המחדל). poster תמיד inline (זו תמונת thumbnail, לעולם לא "הורדה").
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
  type: z.enum(['audio', 'video', 'midi', 'stem', 'poster']),
  role: z.enum(TRACK_ROLES).optional(),
  inline: z.literal('1').optional(),
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
    inline: url.searchParams.get('inline') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { type, role, inline } = parsedQuery.data;
  if (type === 'stem' && !role) {
    return NextResponse.json({ error: 'role is required for type=stem' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      audioKey: renders.audioKey,
      mp3Key: renders.mp3Key,
      videoKey: renders.videoKey,
      posterKey: renders.posterKey,
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
  } else if (type === 'poster') {
    key = row.posterKey;
    filename = 'poster.jpg';
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
  // wantsInline: poster הוא תמיד thumbnail (אף פעם לא "הורדה"); video/audio יכולים לבקש
  // inline=1 כדי לשמש כ-<video src>/<audio src> בעמוד שיתוף/גלריה, לא רק כהורדה.
  const wantsInline = type === 'poster' || inline === '1';
  const storage = createR2ProviderFromEnv();
  const signedUrl = await storage.getDownloadUrl(key, {
    ...(!wantsInline && { responseContentDisposition: `attachment; filename="${filename}"` }),
  });
  return NextResponse.redirect(signedUrl);
}
