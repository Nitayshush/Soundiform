/**
 * @file        uploadBuffer.ts
 * @description ⭐ 2026-08-22: הועבר לכאן מ-jobs/renderAudio.ts (היה מוגדר שם, לא exported) —
 *              jobs/renderVideo.ts צריך אותו גם (כדי להעלות poster.jpg בנוסף ל-output.mp4),
 *              ורנדר-וידאו לא יכול לייבא מ-renderAudio.ts בלי ליצור circular import (renderAudio
 *              הוא זה שקורא ל-renderVideo, לא להפך).
 * @author      Soundiform
 * @created     2026-08-22
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import type { StorageProvider } from '@soundiform/storage';

export async function uploadBuffer(
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
      `העלאה ל-R2 נכשלה עבור ${key}: ${String(response.status)} ${response.statusText}`,
    );
  }
}
