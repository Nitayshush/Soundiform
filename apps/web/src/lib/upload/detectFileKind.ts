/**
 * @file        detectFileKind.ts
 * @description ⭐ שלב 2 בשרשרת ההגנה (§8): "בדיקת magic bytes ← לא סיומת!". קובע את סוג
 *              הקובץ מהתוכן עצמו — לעולם לא סומכים על שם-הקובץ/סיומת שהקליינט שלח.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ ל-SVG אין magic bytes אמיתיים (זה טקסט XML) — file-type מצהיר בפירוש שהוא לא תומך בזיהוי
 * SVG מסיבה זו. משתמשים בהיוריסטיקה סטנדרטית (bom/xml-decl/comments אופציונליים ואז `<svg`)
 * במקום זאת — עדיין תוכן, לא סיומת, ועדיין רק "מועמד ל-SVG": הסניטציה בפועל (sanitizeSvg.ts)
 * היא קו ההגנה האמיתי, לא הזיהוי הזה.
 */

import { fileTypeFromBuffer } from 'file-type';

export type DetectedFileKind = 'svg' | 'png' | 'jpeg' | 'webp';

const SUPPORTED_RASTER_MIME: Record<string, DetectedFileKind> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

/** תואם ל-BOM/הצהרת-XML/הערות אופציונליים ואז `<svg` — היוריסטיקת הזיהוי הסטנדרטית ל-SVG. */
const SVG_SNIFF_PATTERN = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

function looksLikeSvg(buffer: Buffer): boolean {
  // עד 4KB ראשונים מספיקים לזהות את התבנית — לא צריך לפענח את כל הקובץ כ-UTF-8 (עלול להיות ענק).
  const head = buffer.subarray(0, 4096).toString('utf-8').replace(/^﻿/, '');
  return SVG_SNIFF_PATTERN.test(head);
}

/** מזהה את סוג הקובץ מהתוכן. מחזיר null אם לא מזוהה/לא נתמך — לא זורק (הקורא מחליט מה לעשות). */
export async function detectFileKind(buffer: Buffer): Promise<DetectedFileKind | null> {
  const detected = await fileTypeFromBuffer(buffer);
  const rasterKind = detected ? (SUPPORTED_RASTER_MIME[detected.mime] ?? null) : null;
  if (rasterKind) {
    return rasterKind;
  }
  // גם אם file-type זיהה *משהו* (למשל XML גנרי) — עדיין נבדוק את היוריסטיקת ה-SVG כ-fallback,
  // כי file-type בכוונה לא תומך בזיהוי SVG (אין לו magic bytes אמיתיים).
  return looksLikeSvg(buffer) ? 'svg' : null;
}
