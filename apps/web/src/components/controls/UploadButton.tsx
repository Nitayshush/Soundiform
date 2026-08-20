/**
 * @file        UploadButton.tsx
 * @description ⭐ העלאת SVG/PNG/JPEG/WebP → ShapeData (§11 Sprint 2/9, api/upload/route.ts).
 *              נקודת כניסה נוספת לסטודיו, לצד ציור-יד — "אותה צורה + אותו סגנון" חל גם כאן.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useRef, useState } from 'react';
import { useShapeStore, type ShapeSourceType } from '@/stores/shapeStore';

interface UploadResponseBody {
  shape?: { paths: { points: { x: number; y: number }[]; closed: boolean }[] };
  sourceType?: ShapeSourceType;
  uploadKey?: string;
  error?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'העלאה נכשלה';
}

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const loadShape = useShapeStore((state) => state.loadShape);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = ''; // מאפשר להעלות אותו קובץ שוב ברצף (input לא משדר change אחרת)
    if (!file) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const parsed = (await response.json()) as UploadResponseBody;
      if (!response.ok || !parsed.shape || !parsed.sourceType) {
        throw new Error(parsed.error ?? 'העלאה נכשלה');
      }
      loadShape(parsed.shape.paths, {
        sourceType: parsed.sourceType,
        uploadKey: parsed.uploadKey ?? null,
      });
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="rounded border px-3 py-1 text-sm disabled:opacity-40"
      >
        {isUploading ? 'מעלה…' : 'העלאת קובץ'}
      </button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
