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
import Link from 'next/link';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { MusicalGrid } from '@/components/canvas/MusicalGrid';
import { ScoreStaff } from '@/components/canvas/ScoreStaff';
import { RevealOverlay } from '@/components/canvas/RevealOverlay';
import { GenreSelector } from '@/components/controls/GenreSelector';
import { UploadButton } from '@/components/controls/UploadButton';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/button';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useSaveProject } from '@/hooks/useSaveProject';
import { useDownload } from '@/hooks/useDownload';
import { useShapeStore } from '@/stores/shapeStore';

function StudioContent() {
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const clear = useShapeStore((state) => state.clear);
  const { isPlaying, isLoading, currentSeconds, durationSeconds, error, canPlay, play, stop } =
    useAudioEngine();
  // ⭐ נקרא פעם אחת בלבד — מועבר גם לכפתור Save וגם ל-useDownload (ראה הערת useDownload.ts
  // ל-why). קריאה כפולה ל-useSaveProject() הייתה יוצרת שני state instances לא-מסונכרנים.
  const saveProject = useSaveProject();
  const { requestSave, isSaving, saveError, savedProjectId } = saveProject;
  const { requestDownload, isDownloading, downloadError, statusMessage } = useDownload(saveProject);

  const progress = durationSeconds > 0 ? currentSeconds / durationSeconds : 0;

  return (
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo markOnly className="sm:hidden" />
          <Logo className="hidden sm:block" />
        </Link>
        <GenreSelector />
        <UploadButton />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {error && <span className="text-destructive">{error}</span>}
          {saveError && <span className="text-destructive">{saveError}</span>}
          {downloadError && <span className="text-destructive">{downloadError}</span>}
          {statusMessage && <span>{statusMessage}</span>}
          <Button
            type="button"
            variant={isPlaying ? 'secondary' : 'default'}
            onClick={() => void (isPlaying ? stop() : play())}
            disabled={!canPlay || isLoading}
          >
            {isLoading ? 'Loading…' : isPlaying ? 'Stop' : 'Play'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={requestSave}
            disabled={!canPlay || isSaving}
          >
            {isSaving ? 'Saving…' : savedProjectId ? 'Saved ✓' : 'Save'}
          </Button>
          {/* ⭐ §11 item 8: וידאו-כברירת-מחדל להורדה (נגיש ל-YouTube) — הכפתור הראשון-אי-פעם
              שבפועל מפעיל את שרשרת render→share→download; ראה useDownload.ts. */}
          <Button type="button" onClick={requestDownload} disabled={!canPlay || isDownloading}>
            {isDownloading ? 'Working…' : 'Download'}
          </Button>
          {durationSeconds > 0 && (
            <span className="font-mono" data-testid="playback-time">
              {currentSeconds.toFixed(1)}s / {durationSeconds.toFixed(1)}s
            </span>
          )}
          <span className="font-mono text-xs" title="shapeHash — determinism, §1">
            {shapeHash ? shapeHash.slice(0, 12) : 'Draw a shape'}
          </span>
          <Button type="button" variant="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      </header>
      {/* ⭐ הרקע הזה לבן במכוון (לא bg-background) — סרגל התווים/קנבס הציור, בניגוד
          ל-header שנשאר על הפלטה הכהה. text-[#211B4A] נותן ל-MusicalGrid (currentColor)
          קו כהה-על-לבן במקום הבהיר-על-כהה שהיה מתאים לרקע הקודם. */}
      <div className="relative flex-1 bg-white text-[#211B4A]">
        <DrawingCanvas />
        <MusicalGrid />
        <ScoreStaff progress={progress} />
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
