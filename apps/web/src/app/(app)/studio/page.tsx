/**
 * @file        page.tsx
 * @description ⭐ הסטודיו — הקנבס הראשי ליצירה. ליבת חוויית המוצר.
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { MusicalGrid } from '@/components/canvas/MusicalGrid';
import { useShapeStore } from '@/stores/shapeStore';

// TODO(Sprint 4+): GenreSelector + Playhead + פריוויו אודיו.

export default function StudioPage() {
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const clear = useShapeStore((state) => state.clear);

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">Studio</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
      </div>
    </main>
  );
}
