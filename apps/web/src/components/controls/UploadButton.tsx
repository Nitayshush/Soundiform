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
import { Button } from '@/components/ui/button';

interface UploadResponseBody {
  shape?: { paths: { points: { x: number; y: number }[]; closed: boolean }[] };
  sourceType?: ShapeSourceType;
  uploadKey?: string;
  error?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed';
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
        throw new Error(parsed.error ?? 'Upload failed');
      }
      // ⭐ 2026-09-02: התמונה שתוצג על הלוח נלקחת מהקובץ **שבמכשיר**, לא מהשרת — אפס
      // המתנה לרשת, ובאיכות המקורית המלאה. השרת ממשיך להחזיר את השלד בדיוק כמו קודם.
      // ⚠️ SVG לא מקבל תצוגת-תמונה: שם ה"שלד" *הוא* הגרפיקה, וכיסוי שלה היה מסתיר את
      // הצורה עצמה במקום להעשיר אותה.
      const previewImageUrl = parsed.sourceType === 'raster' ? URL.createObjectURL(file) : null;
      loadShape(parsed.shape.paths, {
        sourceType: parsed.sourceType,
        uploadKey: parsed.uploadKey ?? null,
        previewImageUrl,
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
        // ⚠️ 2026-09-02: image/* בסוף בכוונה — בלעדיו iOS מסתיר קבצי HEIC בבורר הקבצים
        // גם כשהשרת תומך בהם, כי חלק מהמכשירים לא מדווחים סיומת/mime שתואמת לרשימה.
        // הרשימה המפורשת עדיין ראשונה, כדי שבדסקטופ הסינון יישאר הדוק.
        accept=".svg,.png,.jpg,.jpeg,.webp,.tif,.tiff,.heic,.heif,.avif,image/svg+xml,image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif,image/avif,image/*"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? 'Uploading…' : 'Upload file'}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
