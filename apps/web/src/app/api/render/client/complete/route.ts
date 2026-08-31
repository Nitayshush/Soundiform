/**
 * @file        route.ts
 * @description ⭐ 2026-08-29: סוגר רינדור שבוצע **במכשיר** — מאמת שהקבצים באמת הועלו ל-R2,
 *              ורק אז כותב שורת renders. מחזיר renderId, כדי שהמשך הזרימה (shares/download)
 *              יישאר בדיוק כמו במסלול ה-worker.
 * @author      Soundiform
 * @created     2026-08-29
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐⭐ §0.3 — הקליינט **לא** שולח לכאן score, מפתחות, או אילו קבצים נוצרו. הוא שולח רק את
 * אותם קלטים כמו ב-start, והשרת מחשב מחדש את ה-score ואת המפתחות הצפויים, ואז בודק בעצמו
 * עם `headObject` מה קיים בפועל. כך:
 *  - מה שנרשם ב-DB הוא תמיד ה-score האמיתי של הפרויקט, גם אם הקליינט העלה משהו אחר.
 *  - מפתח שלא הועלה פשוט נשאר null (העמודות nullable) — למשל מכשיר שלא תומך ב-WebCodecs
 *    ולכן אין לו וידאו, אבל כן יש לו אודיו ופוסטר. דף השיתוף כבר מטפל ב-hasVideo=false.
 *
 * ⚠️ קובץ ריק/זעיר נחשב "לא הועלה" — מונע שורה שמצביעה על אובייקט פגום.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { creationSettingsSchema } from '@/lib/creationSettingsSchema';
import { getDb, renders } from '@soundiform/db';
import { createR2ProviderFromEnv, type StorageProvider } from '@soundiform/storage';
import { computeDurationSeconds } from '@soundiform/audio';
import { isResolveFailure, resolveClientRender } from '@/lib/clientRenderContract';
import { createClient } from '@/lib/supabase/server';

/** ⚠️ חייב להישאר תואם ל-ENGINE_VERSION ב-apps/worker/src/jobs/renderAudio.ts. */
const ENGINE_VERSION = 'v2';
/** מתחת לזה זה לא קובץ מדיה אמיתי — כנראה העלאה שנקטעה. */
const MIN_PLAUSIBLE_BYTES = 1024;

const completeRequestSchema = z.object({
  projectId: z.uuid(),
  genreId: z.string().min(1),
  // ⚠️ 2026-08-29 (באג אמיתי שנתפס בבדיקה חיה — "Invalid request"): **בלי** .min(1) על המערך.
  // ביטול-בחירה של הצליל האחרון לתפקיד משאיר מערך ריק (soundSelectionStore.ts), וזה מצב
  // חוקי לגמרי — resolveSynthPresets כבר מפרש אותו כ"אין בחירה, קח ברירת מחדל". הסכימה
  // היא זו שדחתה, וכך נשברה כל ההורדה אחרי ביטול-בחירה.
  creationSettings: creationSettingsSchema.optional(),
});

/** מחזיר את המפתח רק אם האובייקט באמת קיים ב-R2 ובגודל סביר. */
async function verifiedKey(storage: StorageProvider, key: string): Promise<string | null> {
  const metadata = await storage.headObject(key);
  if (!metadata || metadata.sizeBytes < MIN_PLAUSIBLE_BYTES) {
    return null;
  }
  return key;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = completeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { projectId, genreId, creationSettings } = parsed.data;
  const resolved = await resolveClientRender(user.id, projectId, genreId, creationSettings);
  if (isResolveFailure(resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { score, audioConfig, keyPrefix } = resolved;
  const storage = createR2ProviderFromEnv();
  const [videoKey, posterKey, audioKey, mp3Key, midiKey] = await Promise.all([
    verifiedKey(storage, `${keyPrefix}/output.mp4`),
    verifiedKey(storage, `${keyPrefix}/poster.jpg`),
    verifiedKey(storage, `${keyPrefix}/output.wav`),
    verifiedKey(storage, `${keyPrefix}/output.mp3`),
    verifiedKey(storage, `${keyPrefix}/output.mid`),
  ]);

  if (!audioKey && !mp3Key && !videoKey) {
    return NextResponse.json(
      { error: 'No rendered files were uploaded — nothing to save' },
      { status: 400 },
    );
  }

  const db = getDb();
  const [renderRow] = await db
    .insert(renders)
    .values({
      projectId,
      genreId: score.genreId,
      score,
      engineVersion: ENGINE_VERSION,
      ...(audioKey && { audioKey }),
      ...(mp3Key && { mp3Key }),
      ...(videoKey && { videoKey }),
      ...(posterKey && { posterKey }),
      ...(midiKey && { midiKey }),
      durationSec: computeDurationSeconds(score, audioConfig),
      status: 'completed',
      tempoBpm: score.tempo,
      rootFreqHz: score.metadata.rootFrequencyHz,
      avgNoteDensity: score.metadata.avgNoteDensity,
      dominantMode: score.metadata.dominantMode,
    })
    .returning();

  if (!renderRow) {
    return NextResponse.json({ error: 'Failed to save the render' }, { status: 500 });
  }

  return NextResponse.json(
    { renderId: renderRow.id, hasVideo: Boolean(videoKey) },
    { status: 201 },
  );
}
