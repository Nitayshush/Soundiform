/**
 * @file        shapeStore.ts
 * @description ⭐ מצב הצורה הנוכחית + התמדה ב-localStorage (§11 Sprint 1 "שמירה ב-localStorage").
 * @author      Soundiform
 * @created     2026-08-17
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * למה ה-store הוא מקור האמת ל-paths/shapeHash ולא useShapeCapture:
 * זה מה שמאפשר לצורה לשרוד רענון דף — useShapeCapture אחראי רק על אינטראקציית הציור החיה
 * (מסלול שטרם הושלם לא נשמר — הוא לא צורה תקפה עדיין).
 *
 * ⭐ Sprint 8: loadShape — טעינה מרוכזת של paths קיימים (למשל צורה מ-render משותף, ל-Remix).
 * שונה מ-addPath (שמוסיף מסלול בודד תוך ציור חי) — כאן מחליפים את כל הצורה בבת אחת.
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { computeShapeHash, type ShapeData, type ShapePath } from '@soundiform/shared';

const SHAPE_VERSION = '1.0.0';
const STORAGE_KEY = 'soundiform:current-shape';

interface ShapeStoreState {
  paths: ShapePath[];
  shapeHash: string | null;
  addPath: (path: ShapePath) => void;
  loadShape: (paths: ShapePath[]) => void;
  clear: () => void;
}

/** מיוצא (בנוסף לשימוש הפנימי) כדי ש-useAudioEngine יוכל לבנות ShapeData מ-paths.state באותה צורה בדיוק. */
export function toShapeData(paths: ShapePath[]): ShapeData {
  return { version: SHAPE_VERSION, paths };
}

export const useShapeStore = create<ShapeStoreState>()(
  persist(
    (set, get) => ({
      paths: [],
      shapeHash: null,
      addPath: (path) => {
        const nextPaths = [...get().paths, path];
        set({ paths: nextPaths });
        computeShapeHash(toShapeData(nextPaths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            // אין הודעת שגיאה למשתמש עדיין (אין UI לכך) — לפחות לא נבלע בשקט (§0.3/§0.4).
            console.error('shapeStore: computeShapeHash נכשל', error);
          });
      },
      loadShape: (paths) => {
        set({ paths, shapeHash: null });
        computeShapeHash(toShapeData(paths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            console.error('shapeStore: computeShapeHash נכשל (loadShape)', error);
          });
      },
      clear: () => {
        set({ paths: [], shapeHash: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ paths: state.paths, shapeHash: state.shapeHash }),
    },
  ),
);
