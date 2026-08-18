/**
 * @file        route.ts
 * @description הפעלת רנדור אודיו/וידאו — מעביר עבודה ל-worker דרך BullMQ. ראה PROJECT.md §11 Sprint 6.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ה-score נבנה כאן, בשרת — לא מתקבל מהקליינט. אותה סיבה כמו הצורך ב-serverRenderer:
 * המקור-האמת לרינדור הסופי (וחיוב עתידי) חייב להיות דטרמיניסטי ולא-נתון-למניפולציה מהדפדפן.
 *
 * ⚠️ נכתב אבל לא נבדק חי בסשן הזה — אין Redis מקומי/Upstash זמין (הוחלט מראש כחלק
 * מהיקף Sprint 6 המאושר).
 *
 * TODO(Sprint 8+): rate limiting אנונימי (§8: 3/שעה) — דורש תשתית IP-tracking/Redis נפרדת,
 * לא בהיקף Sprint 6.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { shapeDataSchema, computeShapeHash } from '@shape-sound/shared';
import { geometryToMusic, composeMusicalScore } from '@shape-sound/core';
import { loadGenrePackById } from '@shape-sound/genres';
import { toCompositionConfig, toGenreAudioConfig } from '@/lib/genreAdapter';
import { enqueueRenderJob } from '@/lib/renderQueue';

const renderRequestSchema = z.object({
  shape: shapeDataSchema,
  genreId: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'בקשה לא תקינה', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { shape, genreId } = parsed.data;
  const genrePack = loadGenrePackById(genreId);
  if (!genrePack) {
    return NextResponse.json({ error: `סגנון לא נמצא: ${genreId}` }, { status: 400 });
  }

  const shapeHash = await computeShapeHash(shape);
  const intent = geometryToMusic(shape, shapeHash);
  const score = composeMusicalScore(intent, toCompositionConfig(genrePack));
  const audioConfig = toGenreAudioConfig(genrePack);

  const jobId = await enqueueRenderJob({ score, audioConfig });

  return NextResponse.json({ jobId, shapeHash }, { status: 202 });
}
