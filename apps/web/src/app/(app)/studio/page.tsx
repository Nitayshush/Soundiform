/**
 * @file        page.tsx
 * @description ⭐ הסטודיו — הקנבס הראשי ליצירה. ליבת חוויית המוצר.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 7: כפתור "שמור" + useSaveProject — ה-Suspense כאן קיים כי ה-hook קורא
 * useSearchParams (autoSave=1 אחרי חזרה מהתחברות, ראה useSaveProject.ts).
 */

'use client';

import { Suspense } from 'react';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { MusicalGrid } from '@/components/canvas/MusicalGrid';
import { Playhead } from '@/components/canvas/Playhead';
import { RevealOverlay } from '@/components/canvas/RevealOverlay';
import { GenreSelector } from '@/components/controls/GenreSelector';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useSaveProject } from '@/hooks/useSaveProject';
import { useShapeStore } from '@/stores/shapeStore';

function StudioContent() {
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const clear = useShapeStore((state) => state.clear);
  const { isPlaying, isLoading, currentSeconds, durationSeconds, error, canPlay, play, stop } =
    useAudioEngine();
  const { requestSave, isSaving, saveError, savedProjectId } = useSaveProject();

  const progress = durationSeconds > 0 ? currentSeconds / durationSeconds : 0;

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h1 className="text-lg font-semibold">Studio</h1>
        <GenreSelector />
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {error && <span className="text-destructive">{error}</span>}
          {saveError && <span className="text-destructive">{saveError}</span>}
          <button
            type="button"
            onClick={() => void (isPlaying ? stop() : play())}
            disabled={!canPlay || isLoading}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            {isLoading ? 'טוען…' : isPlaying ? 'עצור' : 'נגן'}
          </button>
          <button
            type="button"
            onClick={requestSave}
            disabled={!canPlay || isSaving}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            {isSaving ? 'שומר…' : savedProjectId ? 'נשמר ✓' : 'שמור'}
          </button>
          {durationSeconds > 0 && (
            <span className="font-mono" data-testid="playback-time">
              {currentSeconds.toFixed(1)}s / {durationSeconds.toFixed(1)}s
            </span>
          )}
          <span className="font-mono" title="shapeHash — דטרמיניזם, §1">
            {shapeHash ? shapeHash.slice(0, 12) : 'ציירו צורה'}
          </span>
          <button type="button" onClick={clear} className="underline">
            נקה
          </button>
        </div>
      </header>
      <div className="relative flex-1">
        <DrawingCanvas />
        <MusicalGrid />
        <Playhead progress={progress} />
        <RevealOverlay />
      </div>
    </main>
  );
}

export default function StudioPage() {
  return (
    <Suspense>
      <StudioContent />
    </Suspense>
  );
}
