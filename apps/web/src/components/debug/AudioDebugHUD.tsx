/**
 * @file        AudioDebugHUD.tsx
 * @description ⭐ 2026-08-28 (אבחון זמני, לפי בקשה חיה: "חירחורי-סאונד בנייד בכל הסגנונות"):
 *              מציג כמה BrowserRendererHandle "חיים" כרגע בפועל (getRendererDiagnostics,
 *              packages/audio) — לא אמור לעלות מעל 1 בשימוש תקין. מוצג רק כש-?debug=audio
 *              קיים ב-URL, כדי שלא ישפיע/ייראה למשתמשים רגילים בכלל.
 * @author      Soundiform
 * @created     2026-08-28
 *
 * ⚠️ כלי-בדיקה זמני — לא נועד להישאר קבוע בקוד-הפרודקשן. להסיר אחרי שהחקירה מסתיימת.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getRendererDiagnostics, type RendererDiagnostics } from '@soundiform/audio';

const POLL_INTERVAL_MS = 500;

const INITIAL_DIAGNOSTICS: RendererDiagnostics = {
  totalCreated: 0,
  active: 0,
  lastRenderMilliseconds: null,
  lastRenderSampleRate: null,
  lastRenderDurationSeconds: null,
  lastRenderFromCache: false,
};

export function AudioDebugHUD() {
  const searchParams = useSearchParams();
  const enabled = searchParams.get('debug') === 'audio';
  const [diagnostics, setDiagnostics] = useState<RendererDiagnostics>(INITIAL_DIAGNOSTICS);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const intervalId = setInterval(() => {
      setDiagnostics(getRendererDiagnostics());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  // ⭐ 2026-08-28: "כמה מהר הרינדור-מראש רץ על *המכשיר הזה*" — היחס בין זמן-הרינדור לאורך
  // היצירה הוא המספר היחיד שבאמת קובע אם ההמתנה סבירה, וזה מה שצריך לחזור מבדיקה בנייד.
  const { lastRenderMilliseconds, lastRenderDurationSeconds } = diagnostics;
  const realtimeFactor =
    lastRenderMilliseconds !== null && lastRenderMilliseconds > 0 && lastRenderDurationSeconds
      ? lastRenderDurationSeconds / (lastRenderMilliseconds / 1000)
      : null;

  return (
    <div className="fixed bottom-2 left-2 z-50 rounded-md bg-black/80 px-3 py-2 font-mono text-xs text-white">
      <div>renderers alive: {diagnostics.active}</div>
      <div>total created: {diagnostics.totalCreated}</div>
      <div>
        render:{' '}
        {lastRenderMilliseconds === null ? '—' : `${(lastRenderMilliseconds / 1000).toFixed(2)}s`}
        {realtimeFactor !== null && ` (${realtimeFactor.toFixed(1)}x)`}
        {diagnostics.lastRenderFromCache && ' [cached]'}
      </div>
      <div>
        track:{' '}
        {lastRenderDurationSeconds === null ? '—' : `${lastRenderDurationSeconds.toFixed(1)}s`}
        {diagnostics.lastRenderSampleRate !== null &&
          ` @ ${(diagnostics.lastRenderSampleRate / 1000).toFixed(1)}kHz`}
      </div>
    </div>
  );
}
