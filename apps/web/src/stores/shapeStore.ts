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
 *
 * ⭐ Sprint 9: sourceType/uploadKey — מגיעים מ-api/upload (העלאת SVG/raster, ראה UploadButton.tsx),
 * עוברים כמו-שהם ל-api/projects בשמירה כדי שהפרויקט יסומן נכון (ומודרציה תיפתח לו — §8).
 * ציור-יד ידני (addPath) מאפס אותם בחזרה ל-'drawing'/null — ברגע שהמשתמש מצייר על גבי צורה
 * שהועלתה, זו כבר לא "בדיוק הקובץ שהועלה" (§9 remix/provenance מתייחס לזה באופן דומה).
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { computeShapeHash, type ShapeData, type ShapePath } from '@soundiform/shared';

const SHAPE_VERSION = '1.0.0';
const STORAGE_KEY = 'soundiform:current-shape';

export type ShapeSourceType = 'drawing' | 'svg' | 'raster';

interface ShapeStoreState {
  paths: ShapePath[];
  shapeHash: string | null;
  sourceType: ShapeSourceType;
  uploadKey: string | null;
  addPath: (path: ShapePath) => void;
  loadShape: (
    paths: ShapePath[],
    source?: { sourceType: ShapeSourceType; uploadKey: string | null },
  ) => void;
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
      sourceType: 'drawing',
      uploadKey: null,
      addPath: (path) => {
        const nextPaths = [...get().paths, path];
        set({ paths: nextPaths, sourceType: 'drawing', uploadKey: null });
        computeShapeHash(toShapeData(nextPaths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            // אין הודעת שגיאה למשתמש עדיין (אין UI לכך) — לפחות לא נבלע בשקט (§0.3/§0.4).
            console.error('shapeStore: computeShapeHash נכשל', error);
          });
      },
      loadShape: (paths, source) => {
        set({
          paths,
          shapeHash: null,
          sourceType: source?.sourceType ?? 'drawing',
          uploadKey: source?.uploadKey ?? null,
        });
        computeShapeHash(toShapeData(paths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            console.error('shapeStore: computeShapeHash נכשל (loadShape)', error);
          });
      },
      clear: () => {
        set({ paths: [], shapeHash: null, sourceType: 'drawing', uploadKey: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        paths: state.paths,
        shapeHash: state.shapeHash,
        sourceType: state.sourceType,
        uploadKey: state.uploadKey,
      }),
    },
  ),
);
