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
 *
 * ⭐⭐ 2026-09-13 (נתפס בבדיקה חיה, שינוי-החלטה מפורש): **בעבר** addPath איפס sourceType/
 * uploadKey/previewImageUrl בחזרה ל-'drawing'/null ברגע שהמשתמש מוסיף קו על גבי תמונה
 * שהועלתה — הרציונל היה "זו כבר לא בדיוק התמונה שהועלתה, אז אל תראה משהו שאינו מקור הצליל".
 * **זה התהפך במפורש**: המשתמש לעולם לא אמור לראות את השלד (potrace) בכלל — רק את התמונה
 * המקורית, גם אחרי הוספת קווים מעליה. addPath כבר לא נוגע ב-sourceType/uploadKey/
 * previewImageUrl בכלל — רק savedProjectId מתאפס (הצורה השתנתה, השמירה הקודמת כבר לא
 * תואמת). ראה uploadedProjectId למטה — זה מה שמאפשר לתמונה לשרוד גם את איפוס savedProjectId.
 *
 * ⭐ 2026-09-04 (Kids Studio v1): pathStyles — עיצוב חזותי בלבד (צבע/עובי קו) לכל path,
 * במקביל ל-paths (index-aligned). **לא חלק מ-ShapeData/shapeHash** — המנוע (core/audio/video)
 * לא צריך לדעת שום דבר על צבע. Studio הרגיל אף פעם לא קורא ל-setCurrentColor/setCurrentStrokeWidth,
 * ולכן pathStyles נשאר ריק שם ו-DrawingCanvas נופל לברירות המחדל הישנות בדיוק כמו היום.
 * ⚠️ קריטי: addPath/loadShape/clear חייבים לשמור את pathStyles מסונכרן עם paths (אותו אורך,
 * אותו index) — אחרת Remix (loadShape, מחליף paths בבת אחת) משאיר pathStyles עם אורך ישן.
 *
 * ⭐ 2026-09-05 (דווח חי: "מזיזים את האימוג'י ומופיע עיגול, לא ניתן לעדכן את מיקומו"):
 * updatePath — מחליף path קיים **במקום** (אותו index, לא append) ומחשב shapeHash מחדש
 * פעם אחת. נועד ל-EmojiStickerLayer: כשגוררים סטיקר-אימוג'י שכבר הונח, הצליל חייב לזוז
 * יחד איתו (אחרת העיגול-מקור נשאר "יתום" במקום הישן, חשוף וגלוי — בדיוק הבאג שדווח). לא
 * נקרא בכל pointermove — פעם אחת ב-pointerup, אותה משמעת בדיוק כמו addPath ב-ShapePlacementOverlay.
 */

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { computeShapeHash, type ShapeData, type ShapePath } from '@soundiform/shared';

const SHAPE_VERSION = '1.0.0';
const STORAGE_KEY = 'soundiform:current-shape';

export type ShapeSourceType = 'drawing' | 'svg' | 'raster';

/** עיצוב חזותי של path בודד — ראה ⭐ 2026-09-04 למעלה. */
export interface PathStyle {
  color: string;
  strokeWidth: number;
}

// ⚠️ תואמים בכוונה ל-fallback constants ב-DrawingCanvas.tsx (STROKE_COLOR/LINE_WIDTH) — כך
// שהקו הראשון ב-Kids Studio, לפני שהילד נגע בבורר-הצבע, נראה בדיוק כמו קו רגיל ב-Studio.
const DEFAULT_STROKE_COLOR = '#211b4a';
const DEFAULT_STROKE_WIDTH = 6;

interface ShapeStoreState {
  paths: ShapePath[];
  pathStyles: PathStyle[];
  currentColor: string;
  currentStrokeWidth: number;
  setCurrentColor: (color: string) => void;
  setCurrentStrokeWidth: (width: number) => void;
  shapeHash: string | null;
  sourceType: ShapeSourceType;
  uploadKey: string | null;
  /**
   * ⭐ 2026-09-02: object URL של הקובץ שהמשתמש בחר — **מה שהוא רואה על הלוח**. השלד ממשיך
   * לייצר את הצליל בדיוק כמו קודם; זו שכבת תצוגה בלבד ואין לה שום השפעה על המוזיקה.
   *
   * ⚠️ **לא נשמר ב-localStorage** (ראה partialize למטה): object URL תקף רק לחיי הדף, ו-data
   * URL של עד 10MB היה מפוצץ את מכסת ה-localStorage. אחרי רענון נשארת הצורה בלי התמונה —
   * ההמשכיות המלאה תגיע מ-R2 (uploadKey) בשלב הבא.
   */
  previewImageUrl: string | null;
  /**
   * ⭐ 2026-09-02: מזהה הפרויקט האחרון שנשמר. **נשמר ב-localStorage** — בניגוד לתמונה עצמה,
   * זו מחרוזת קצרה ולא קובץ.
   *
   * ⚠️ זה מה שמאפשר לתמונה המקורית לשרוד רענון: אחרי שמירה אפשר למשוך אותה מ-R2 דרך
   * `api/projects/[id]/upload`. **לפני** שמירה היא לא נשמרת בכלל — החלטת מוצר מפורשת,
   * כדי לא להחזיק קבצים של משתמשים שלא ביקשו לשמור כלום.
   */
  savedProjectId: string | null;
  setSavedProjectId: (projectId: string | null) => void;
  /**
   * ⭐⭐ 2026-09-13: זהה ל-savedProjectId **ברגע שנקבע**, אבל בניגוד אליו לא מתאפס ב-addPath —
   * זה מה שמאפשר ל-UploadedImageLayer.tsx להמשיך למשוך את התמונה המקורית מהשרת גם אחרי
   * שהמשתמש הוסיף קווים (ש-addPath מאפס בגללם את savedProjectId, כי הצורה כבר לא תואמת
   * את מה שנשמר). מתעדכן אוטומטית בכל קריאה ל-setSavedProjectId(id) עם id לא-null.
   */
  uploadedProjectId: string | null;
  addPath: (path: ShapePath) => void;
  /** מחליף path[index] במקום (לא append) — ראה ⭐ 2026-09-05 למעלה. no-op אם index לא תקף. */
  updatePath: (index: number, path: ShapePath) => void;
  /**
   * ⭐ 2026-09-05 (Kids Studio — סטיקר-אימוג'י): קובע עיצוב ל-path קיים בלי לגעת ב-
   * currentColor/currentStrokeWidth הגלובליים (בניגוד ל-addPath, שתמיד לוקח אותם). נחוץ כי
   * ה-path של סטיקר-אימוג'י צריך color='transparent' קבוע (בלתי-נראה מעצמו — האימוג'י הוא
   * הייצוג היחיד), בלי קשר לצבע-הקו הנוכחי שהילד בחר לציור-יד. no-op אם index לא תקף.
   */
  setPathStyle: (index: number, style: PathStyle) => void;
  /**
   * ⭐ 2026-09-05 (דווח חי: "מחיקת סטיקר חייבת להסיר גם את הצליל שלו"): מסיר path **בפועל**
   * (לא רק מסתיר) — משנה אורך המערך, ולכן כל אינדקס-path אחר ששמור במקום אחר (pathIndex
   * ב-EmojiSticker) חייב להתעדכן בהתאם (ראה EmojiStickerLayer.removeSticker, שמזיז את
   * pathIndex של כל סטיקר אחר שמצביע על path שבא *אחרי* הנמחק). no-op אם index לא תקף.
   */
  removePath: (index: number) => void;
  loadShape: (
    paths: ShapePath[],
    source?: {
      sourceType: ShapeSourceType;
      uploadKey: string | null;
      /** ⭐ 2026-09-02: אופציונלי — קוראים קיימים (Remix מדף שיתוף) לא משתנים. */
      previewImageUrl?: string | null;
    },
  ) => void;
  clear: () => void;
}

/** משחרר object URL קודם כדי לא לדלוף זיכרון בכל העלאה חוזרת. */
function revokePreview(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/** מיוצא (בנוסף לשימוש הפנימי) כדי ש-useAudioEngine יוכל לבנות ShapeData מ-paths.state באותה צורה בדיוק. */
export function toShapeData(paths: ShapePath[]): ShapeData {
  return { version: SHAPE_VERSION, paths };
}

export const useShapeStore = create<ShapeStoreState>()(
  persist(
    (set, get) => ({
      paths: [],
      pathStyles: [],
      currentColor: DEFAULT_STROKE_COLOR,
      currentStrokeWidth: DEFAULT_STROKE_WIDTH,
      setCurrentColor: (color) => {
        set({ currentColor: color });
      },
      setCurrentStrokeWidth: (width) => {
        set({ currentStrokeWidth: width });
      },
      shapeHash: null,
      sourceType: 'drawing',
      uploadKey: null,
      previewImageUrl: null,
      savedProjectId: null,
      uploadedProjectId: null,
      setSavedProjectId: (projectId) => {
        set({ savedProjectId: projectId, ...(projectId && { uploadedProjectId: projectId }) });
      },
      addPath: (path) => {
        const nextPaths = [...get().paths, path];
        const nextStyles = [
          ...get().pathStyles,
          { color: get().currentColor, strokeWidth: get().currentStrokeWidth },
        ];
        // ⚠️ 2026-09-13: sourceType/uploadKey/previewImageUrl **לא** מתאפסים יותר כאן — ראה
        // ⭐⭐ למעלה. המשתמש ממשיך לראות את התמונה המקורית גם אחרי הוספת קווים מעליה.
        // savedProjectId כן מתאפס: הצורה השתנתה, השמירה הקודמת כבר לא תואמת את המצב הנוכחי.
        set({
          paths: nextPaths,
          pathStyles: nextStyles,
          savedProjectId: null,
        });
        computeShapeHash(toShapeData(nextPaths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            // אין הודעת שגיאה למשתמש עדיין (אין UI לכך) — לפחות לא נבלע בשקט (§0.3/§0.4).
            console.error('shapeStore: computeShapeHash נכשל', error);
          });
      },
      updatePath: (index, path) => {
        const currentPaths = get().paths;
        if (index < 0 || index >= currentPaths.length) {
          return;
        }
        const nextPaths = currentPaths.map((existing, i) => (i === index ? path : existing));
        set({ paths: nextPaths });
        computeShapeHash(toShapeData(nextPaths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            console.error('shapeStore: computeShapeHash נכשל (updatePath)', error);
          });
      },
      setPathStyle: (index, style) => {
        const currentStyles = get().pathStyles;
        if (index < 0 || index >= get().paths.length) {
          return;
        }
        const nextStyles = [...currentStyles];
        nextStyles[index] = style;
        set({ pathStyles: nextStyles });
      },
      removePath: (index) => {
        const currentPaths = get().paths;
        if (index < 0 || index >= currentPaths.length) {
          return;
        }
        const nextPaths = currentPaths.filter((_, i) => i !== index);
        const nextStyles = get().pathStyles.filter((_, i) => i !== index);
        set({ paths: nextPaths, pathStyles: nextStyles });
        computeShapeHash(toShapeData(nextPaths))
          .then((hash) => {
            set({ shapeHash: hash });
          })
          .catch((error: unknown) => {
            console.error('shapeStore: computeShapeHash נכשל (removePath)', error);
          });
      },
      loadShape: (paths, source) => {
        revokePreview(get().previewImageUrl);
        set({
          paths,
          // ⚠️ לצורה שנטענת (Remix/שיתוף) אין עיצוב-per-path משלה — מערך ריק, לא מערך
          // "יתום" באורך הישן. DrawingCanvas נופל ל-fallback הרגיל לכל path כזה.
          pathStyles: [],
          shapeHash: null,
          sourceType: source?.sourceType ?? 'drawing',
          uploadKey: source?.uploadKey ?? null,
          previewImageUrl: source?.previewImageUrl ?? null,
          savedProjectId: null,
          // ⚠️ מתאפס כאן; קורא שממשיך מיד ב-setSavedProjectId(id) (ContinueDraftButton.tsx)
          // יקבע אותו מחדש (setSavedProjectId ממפה אליו כל id לא-null) — קורא שלא (Remix)
          // בצדק לא משאיר תמונה-קודמת "יתומה".
          uploadedProjectId: null,
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
        revokePreview(get().previewImageUrl);
        set({
          paths: [],
          pathStyles: [],
          shapeHash: null,
          sourceType: 'drawing',
          uploadKey: null,
          previewImageUrl: null,
          savedProjectId: null,
          uploadedProjectId: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        paths: state.paths,
        pathStyles: state.pathStyles,
        shapeHash: state.shapeHash,
        sourceType: state.sourceType,
        uploadKey: state.uploadKey,
        // ⚠️ previewImageUrl **לא** נשמר (object URL מת ברענון); savedProjectId/uploadedProjectId
        // כן — הם מה שמאפשר למשוך את התמונה מחדש מהשרת אחרי רענון.
        savedProjectId: state.savedProjectId,
        uploadedProjectId: state.uploadedProjectId,
      }),
    },
  ),
);
