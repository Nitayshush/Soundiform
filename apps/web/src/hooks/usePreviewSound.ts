/**
 * @file        usePreviewSound.ts
 * @description ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 1): משמיע דגימה קצרה של פריסט-סינת'
 *              בודד (לא של MusicalScore שלם) — כדי שבחירת-צליל (SoundSelector.tsx) תהיה
 *              מונחית-שמיעה, לא רק שם טקסטואלי. עצמאי לגמרי מ-useAudioEngine (לא נוגע ב-
 *              Transport/renderer של הניגון הראשי — preview הוא "hit" חד-פעמי, לא לופ).
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-08-27 (לפי בקשה חיה: "לוחצים על כמה כפתורי-צליל ולא כולם משמיעים"): previewSound
 * הוא async (2 import דינמיים + Tone.start()), אבל previewProviderRef/disposeTimeoutRef הם
 * refs *משותפים* — בלי הגנה, לחיצה מהירה על כמה כפתורים (בדיוק תרחיש "דפדוף בין דגימות
 * לבחירה") יוצרת קריאות חופפות: קריאה שמסיימת מאוחר (network/import) יכולה לדרוס/לחסל
 * בשקט provider של קריאה מוקדמת-אך-מהירה-יותר שכבר התחילה לנגן, בלי שהמשתמש שומע כלום ממנו.
 * התיקון: generation-counter — כל קריאה בודקת אחרי כל await אם קריאה חדשה-יותר כבר התחילה;
 * אם כן, משמידה (dispose) את מה שהיא עצמה הספיקה ליצור ויוצאת **בלי לגעת ב-refs המשותפים**.
 * רק הקריאה האחרונה-שבאמת-עדיין-רלוונטית אי-פעם כותבת ל-refs — מבטיח שלחיצה-אחר-לחיצה
 * מהירה תמיד תשמיע בסוף בדיוק את הצליל האחרון שנלחץ, בלי תלות בסדר-פתרון ה-imports.
 */

'use client';

import { useCallback, useRef } from 'react';
import type { TrackRole } from '@soundiform/core';
import type { SynthProvider as SynthProviderType, SynthPresetConfig } from '@soundiform/audio';

/** רגיסטר נעים-לאוזן לפי תפקיד, לצורך תצוגה-מקדימה בלבד — לא קשור לצורה המצוירת. */
const PREVIEW_PITCH: Record<TrackRole, number> = {
  bass: 40,
  lead: 72,
  pad: 64,
  drums: 45,
  skank: 60,
};
const PREVIEW_TEMPO_BPM = 120;
const PREVIEW_DURATION_SECONDS = 0.8;
/** TICKS_PER_BEAT (480, ראה packages/core) — משוכפל כאן מכוון: preview לא צריך MusicalScore אמיתי. */
const TICKS_PER_BEAT = 480;

export function usePreviewSound() {
  const previewProviderRef = useRef<SynthProviderType | null>(null);
  const disposeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ⭐ ראה הערת-הקובץ — עולה בכל קריאה; משמש לזהות אם הקריאה-הזו עדיין "העדכנית ביותר"
  // אחרי כל await, לפני שהיא נוגעת ב-refs המשותפים.
  const generationRef = useRef(0);

  const previewSound = useCallback(async (role: TrackRole, preset: SynthPresetConfig) => {
    const myGeneration = (generationRef.current += 1);
    // ⭐ השתקה מיידית (סינכרונית) של תצוגה-קודמת בלחיצה חדשה — לא ממתינים ל-async, כדי
    // שהתגובתיות תישאר מיידית. בטוח לעשות תמיד, בלי תלות בהגנת-הדור: מדובר במה שכבר-פעיל
    // *ברגע הלחיצה עצמו*, לא ביעד-כתיבה עתידי שדורש תיאום בין קריאות חופפות.
    if (disposeTimeoutRef.current !== null) {
      clearTimeout(disposeTimeoutRef.current);
      disposeTimeoutRef.current = null;
    }
    previewProviderRef.current?.dispose();
    previewProviderRef.current = null;

    const { connect, start, getDestination, now } = await import('tone');
    const { SynthProvider, withGlobalContextLock } = await import('@soundiform/audio');
    await start();
    if (generationRef.current !== myGeneration) {
      return; // קריאה חדשה-יותר כבר התחילה — שום דבר לא נוצר עדיין, פשוט לוותר.
    }

    // ⭐ 2026-08-28 (הסבב המבני לסאונד בנייד): נעילה מול רינדור-אופליין. createBrowserRenderer
    // מרנדר עכשיו מראש דרך Tone.Offline, שמחליף את ה-context הגלובלי לזמן הרינדור — צליל
    // תצוגה-מקדימה שנוצר *בדיוק* אז היה נתפס ל-context האופליין ופשוט לא נשמע, בלי שגיאה.
    // ראה packages/audio/src/render/globalContextLock.ts.
    const provider = await withGlobalContextLock(async () => {
      const created = new SynthProvider(role, PREVIEW_TEMPO_BPM, preset);
      await created.load('preview');
      return created;
    });
    if (generationRef.current !== myGeneration) {
      provider.dispose(); // נוצר, אבל התייתר — משמידים בלי לגעת ב-refs המשותפים.
      return;
    }

    // ⭐ מכאן והלאה זו עדיין הקריאה העדכנית ביותר — מותר לה לקחת בעלות על ה-refs המשותפים.
    // connect() (הפונקציה, לא המתודה) — אותה סיבה כמו sharedScheduling.ts: .connect() כמתודה
    // על OutputNode לא תמיד נבחר ל-overload הנכון (ראה DECISIONS.md).
    connect(provider.output, getDestination());
    previewProviderRef.current = provider;

    const durationTicks = Math.round(
      PREVIEW_DURATION_SECONDS * (PREVIEW_TEMPO_BPM / 60) * TICKS_PER_BEAT,
    );
    provider.playNote(
      { startTick: 0, durationTicks, pitch: PREVIEW_PITCH[role], velocity: 0.8 },
      now(),
    );

    // ⭐ משאיר זמן לזנב-release (עד ~1.2s בחלק מהפריסטים) לפני שמנקים — לא חותכים את הצליל.
    // בדיקת-דור נוספת כאן: אם קריאה חדשה-יותר כבר לקחה בעלות על ה-ref (ותזמן dispose משלה),
    // אסור לטיימר הישן הזה לגעת ב-provider השייך לה עכשיו.
    disposeTimeoutRef.current = setTimeout(() => {
      if (generationRef.current === myGeneration) {
        previewProviderRef.current?.dispose();
        previewProviderRef.current = null;
      }
    }, 2000);
  }, []);

  return previewSound;
}
