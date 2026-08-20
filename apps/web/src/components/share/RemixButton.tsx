/**
 * @file        RemixButton.tsx
 * @description ⭐ "כל צופה הופך ליוצר בקליק" (§9, מנוע הצמיחה) — טוען את הצורה המשותפת
 *              ל-shapeStore ומעביר ל-studio. שורת remixes נרשמת רק כשהפרויקט-הבן נשמר בפועל
 *              (api/projects/route.ts, remixOf ב-query params).
 * @author      Soundiform
 * @created     2026-08-19
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useRouter } from 'next/navigation';
import type { ShapePath } from '@soundiform/shared';
import { useShapeStore } from '@/stores/shapeStore';

export interface RemixButtonProps {
  renderId: string;
  paths: ShapePath[];
}

export function RemixButton({ renderId, paths }: RemixButtonProps) {
  const router = useRouter();
  const loadShape = useShapeStore((state) => state.loadShape);

  return (
    <button
      type="button"
      onClick={() => {
        loadShape(paths);
        router.push(`/studio?remixOf=${renderId}`);
      }}
      className="rounded bg-foreground px-4 py-2 text-background"
    >
      Remix
    </button>
  );
}
