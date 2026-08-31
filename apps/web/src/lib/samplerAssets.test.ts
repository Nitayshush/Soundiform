/**
 * @file        samplerAssets.test.ts
 * @description ⭐ 2026-08-30 (סבב הדגימות): מוודא שכל תו שפריסט-דגימה מצהיר עליו באמת קיים
 *              כקובץ על הדיסק. זו בדיקה שנולדה מבאג אמיתי — chill.json הצהיר על
 *              `upright-piano: ["C#3","C#4","C#5"]` בזמן שהקבצים בפועל היו אחרים לגמרי,
 *              ו**שום דבר לא נכשל**: Tone.Sampler פשוט לא מקבל את הבאפר, והכלי משמיע
 *              חלקית או כלום. כשל שקט כזה לא נתפס ע"י typecheck, ע"י Zod ולא ע"י בדיקת
 *              רינדור — רק ע"י הצלבה מול מערכת-הקבצים.
 * @author      Soundiform
 * @created     2026-08-30
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ הבדיקה יושבת ב-apps/web ולא ב-packages/genres בכוונה: `packages/genres` הוא tier
 * ליבה שאין לו (ולא צריך שיהיה לו) `@types/node`, והדגימות הן נכסים סטטיים של אפליקציית
 * ה-web. כאן נמצאים גם ה-GenrePacks וגם `public/samples`, ולכן זה המקום היחיד שיכול
 * להצליב ביניהם.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAllGenrePacks, type GenrePack, type SoundOption } from '@soundiform/genres';

const SAMPLES_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../public/samples');

interface SamplerReference {
  packId: string;
  role: string;
  optionId: string;
  instrumentId: string;
  notes: string[];
  extension: string;
}

function collectSamplerReferences(packs: readonly GenrePack[]): SamplerReference[] {
  const references: SamplerReference[] = [];
  for (const pack of packs) {
    for (const [role, options] of Object.entries(pack.soundOptions ?? {})) {
      for (const option of options as SoundOption[]) {
        const { preset } = option;
        if (!('kind' in preset)) {
          continue;
        }
        // ⚠️ ערכה ודגימה מאוחסנות אותו דבר על הדיסק — ההבדל הוא רק מה המפתחות מייצגים
        // (חלקי-ערכה מול תווים). לבדיקה כאן זה אותו דבר בדיוק, ולכן שתיהן נאספות יחד.
        const keys = preset.kind === 'sampler' ? preset.notes : preset.pieces;
        references.push({
          packId: pack.id,
          role,
          optionId: option.id,
          instrumentId: preset.instrumentId,
          notes: keys,
          extension: preset.extension,
        });
      }
    }
  }
  return references;
}

const references = collectSamplerReferences(loadAllGenrePacks());

describe('פריסטים של דגימות מצביעים על קבצים שקיימים באמת', () => {
  it('יש בכלל פריסטי-דגימה לבדוק (הבדיקה לא ריקה בשקט)', () => {
    expect(references.length).toBeGreaterThan(0);
  });

  it('כל תו בכל פריסט קיים כקובץ תחת public/samples', () => {
    const missing: string[] = [];
    for (const reference of references) {
      for (const note of reference.notes) {
        const path = join(SAMPLES_ROOT, reference.instrumentId, `${note}.${reference.extension}`);
        if (!existsSync(path)) {
          missing.push(
            `${reference.packId}/${reference.role}/${reference.optionId} → ${reference.instrumentId}/${note}.${reference.extension}`,
          );
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('לכל פריסט יש לפחות שני תווים — תו בודד נמתח על כל הטווח ונשמע מזויף', () => {
    for (const reference of references) {
      expect(reference.notes.length, `${reference.packId}/${reference.optionId}`).toBeGreaterThan(
        1,
      );
    }
  });

  it('אין תו כפול באותו פריסט (כפילות מסתירה חור אמיתי בכיסוי)', () => {
    for (const reference of references) {
      expect(new Set(reference.notes).size, `${reference.packId}/${reference.optionId}`).toBe(
        reference.notes.length,
      );
    }
  });

  it('כל תיקיית-כלי שקיימת על הדיסק אכן בשימוש (אין נכסים יתומים שמנפחים את הפריסה)', () => {
    const referenced = new Set(references.map((reference) => reference.instrumentId));
    const onDisk = readdirSync(SAMPLES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(onDisk.filter((name) => !referenced.has(name))).toEqual([]);
  });
});
