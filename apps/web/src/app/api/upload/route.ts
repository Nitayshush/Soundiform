/**
 * @file        route.ts
 * @description ⭐ העלאת קבצים (SVG/raster) → ShapeData. שרשרת ההגנה המלאה של §8:
 *              1. גודל (מקס 10MB) → 2. magic bytes → 3. SVG: svgo+DOMPurify /
 *              4. raster: sharp re-encode+potrace → מעלה את הקובץ *הנקי* ל-R2 (uploads/).
 *              ⭐ 2026-09-02: הפורמטים הורחבו ל-GIF/TIFF/HEIC/AVIF — ראה detectFileKind.ts.
 *              הענף כאן לא השתנה: SVG מול "כל השאר", ו-sharp מטפל בכולם באותה דרך.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ לא דורש התחברות בכוונה — §8 Rate Limiting מגדיר מפורשות מכסת "אנונימי" (5/שעה) מול
 * "רשום" (50/שעה) לנתיב הזה, בדיוק כמו הציור החופשי שעובד בלי חשבון (§9). ה-ShapeData
 * המתקבל נטען ל-shapeStore בקליינט בדיוק כמו צורה מצוירת-ביד — לא נכתב ל-DB כאן; שורת
 * moderation_queue נוצרת רק כשהפרויקט נשמר בפועל (api/projects/route.ts), כי לה יש
 * project_id שלא קיים עדיין בשלב הזה (ראה moderationQueue.ts).
 *
 * TODO(Sprint 8+/9+): rate limiting אנונימי (§8) — אותו TODO קיים כבר ב-api/render/route.ts,
 * דורש תשתית IP-tracking/Redis נפרדת שלא הוקמה בסשן הזה.
 */

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { shapeDataSchema } from '@soundiform/shared';
import { createR2ProviderFromEnv, type StorageProvider } from '@soundiform/storage';
import { createClient } from '@/lib/supabase/server';
import { detectFileKind } from '@/lib/upload/detectFileKind';
import { sanitizeSvg, SvgSanitizeError } from '@/lib/upload/sanitizeSvg';
import { svgMarkupToShapeData, SvgConversionError } from '@/lib/upload/svgToShapeData';
import { rasterToShapeData } from '@/lib/upload/rasterToShapeData';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // §8 שלב 1: מקס 10MB

async function putToR2(
  storage: StorageProvider,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const uploadUrl = await storage.getUploadUrl(key, { contentType });
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'Content-Type': contentType },
  });
  if (!response.ok) {
    throw new Error(
      `R2 upload failed for ${key}: ${String(response.status)} ${response.statusText}`,
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file sent (field: file)' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is larger than 10MB' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = await detectFileKind(buffer);
  if (!kind) {
    return NextResponse.json(
      {
        error:
          'Unsupported file type. Supported: PNG, JPEG, WebP, HEIC, AVIF, TIFF, SVG. ' +
          'GIF is not supported — its colour dithering changes the extracted shape, ' +
          'so the same picture would produce different music. Save it as PNG instead.',
      },
      { status: 415 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ownerSegment = user?.id ?? 'anon';
  const uploadId = randomUUID();

  try {
    if (kind === 'svg') {
      const sanitized = sanitizeSvg(buffer.toString('utf-8'));
      const shape = shapeDataSchema.parse(svgMarkupToShapeData(sanitized));

      const storage = createR2ProviderFromEnv();
      const uploadKey = `uploads/${ownerSegment}/${uploadId}.svg`;
      await putToR2(storage, uploadKey, Buffer.from(sanitized, 'utf-8'), 'image/svg+xml');

      return NextResponse.json({ shape, sourceType: 'svg', uploadKey }, { status: 200 });
    }

    const { shapeData, sanitizedPngBuffer } = await rasterToShapeData(buffer);
    const shape = shapeDataSchema.parse(shapeData);

    const storage = createR2ProviderFromEnv();
    const uploadKey = `uploads/${ownerSegment}/${uploadId}.png`;
    await putToR2(storage, uploadKey, sanitizedPngBuffer, 'image/png');

    return NextResponse.json({ shape, sourceType: 'raster', uploadKey }, { status: 200 });
  } catch (caughtError) {
    if (caughtError instanceof SvgSanitizeError || caughtError instanceof SvgConversionError) {
      return NextResponse.json({ error: caughtError.message }, { status: 400 });
    }
    console.error('api/upload: file processing failed', caughtError);
    return NextResponse.json({ error: 'File processing failed' }, { status: 422 });
  }
}
