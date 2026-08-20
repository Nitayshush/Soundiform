/**
 * @file        sanitizeSvg.ts
 * @description ⭐ שלב 3 בשרשרת ההגנה (§8): "SVG? → svgo + DOMPurify ← חובה, וקטור XSS".
 *              DOMPurify מנקה תגיות/מאפיינים מסוכנים (script, on*, javascript: וכו'), svgo
 *              מנרמל/מייעל אחרי זה. הפלט הוא המחרוזת שנשמרת ב-R2 ושמוזנת ל-svgToShapeData.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ DOMPurify דורש implementation כלשהי של DOM כדי לפרסר/לנקות markup — jsdom נטען כאן
 * (route בצד-שרת בלבד, ראה svgToShapeData.ts להסבר המלא למה זה בטוח ולא סותר את ההימנעות
 * המכוונת מ-jsdom ב-useShapeCapture.ts, ששם ההקשר שונה — קוד שנטען לדפדפן).
 */

import createDOMPurify from 'dompurify';
import { JSDOM, type DOMWindow } from 'jsdom';
import { optimize } from 'svgo';

const FORBIDDEN_TAGS = ['script', 'foreignObject', 'use', 'image', 'audio', 'video', 'iframe'];
const FORBIDDEN_ATTR = ['href', 'xlink:href'];

export class SvgSanitizeError extends Error {}

let purifyWindow: DOMWindow | null = null;

function getPurifyWindow(): DOMWindow {
  purifyWindow ??= new JSDOM('').window;
  return purifyWindow;
}

/** מנקה SVG לא-סמוך (§8) ומחזיר מחרוזת נקייה+ממוטבת. זורק SvgSanitizeError אם לא נשאר תוכן תקין. */
export function sanitizeSvg(rawSvg: string): string {
  const purify = createDOMPurify(getPurifyWindow());
  const purified = purify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTR,
    WHOLE_DOCUMENT: false,
  });

  if (!purified.includes('<svg')) {
    throw new SvgSanitizeError('SVG לא תקין או שכל התוכן שלו נחסם בסינון האבטחה');
  }

  try {
    return optimize(purified, { multipass: true }).data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SvgSanitizeError(`svgo נכשל: ${message}`);
  }
}
