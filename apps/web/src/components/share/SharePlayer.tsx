/**
 * @file        SharePlayer.tsx
 * @description נגן לדף שיתוף — מנגן MusicalScore שכבר קיים (לא מרכיב מחדש). ראה usePlayScore.ts.
 * @author      Shape-to-Sound
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import type { MusicalScore } from '@shape-sound/core';
import { usePlayScore } from '@/hooks/usePlayScore';

export interface SharePlayerProps {
  score: MusicalScore;
  genreId: string;
}

export function SharePlayer({ score, genreId }: SharePlayerProps) {
  const { isPlaying, isLoading, currentSeconds, durationSeconds, error, play, stop } = usePlayScore(
    score,
    genreId,
  );

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <button
        type="button"
        onClick={() => void (isPlaying ? stop() : play())}
        disabled={isLoading}
        className="rounded border px-4 py-2 disabled:opacity-40"
      >
        {isLoading ? 'טוען…' : isPlaying ? 'עצור' : 'נגן'}
      </button>
      {durationSeconds > 0 && (
        <span className="font-mono text-sm">
          {currentSeconds.toFixed(1)}s / {durationSeconds.toFixed(1)}s
        </span>
      )}
    </div>
  );
}
