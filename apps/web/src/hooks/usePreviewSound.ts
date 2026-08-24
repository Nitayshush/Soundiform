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

  const previewSound = useCallback(async (role: TrackRole, preset: SynthPresetConfig) => {
    if (disposeTimeoutRef.current !== null) {
      clearTimeout(disposeTimeoutRef.current);
    }
    previewProviderRef.current?.dispose();
    previewProviderRef.current = null;

    const { connect, start, getDestination, now } = await import('tone');
    const { SynthProvider } = await import('@soundiform/audio');
    await start();

    const provider = new SynthProvider(role, PREVIEW_TEMPO_BPM, preset);
    await provider.load('preview');
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
    disposeTimeoutRef.current = setTimeout(() => {
      previewProviderRef.current?.dispose();
      previewProviderRef.current = null;
    }, 2000);
  }, []);

  return previewSound;
}
