/**
 * @file        page.tsx
 * @description ⭐ 2026-09-04 (Kids Studio v1): כניסה נפרדת ומפושטת ל-Studio — לילדים ולמי
 *              שנהנה מממשק פשוט יותר. אותו מנוע מוזיקלי בדיוק (useAudioEngine/useSaveProject/
 *              useDownload, בלי שינוי), UI שונה לגמרי: בלי Header.tsx (ניווט-שיווקי למבוגרים),
 *              בלי SoundSelector/UploadButton (מורכבים מדי), בורר ז'אנר כאייקונים, פלטת
 *              צבע/עובי-קו, ותצרף צורות-מוכנות (ShapeTray).
 * @author      Soundiform
 * @created     2026-09-04
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ קומפוננטה **נפרדת** מ-studio/page.tsx, לא flag בתוכה — אותו קובץ כבר גדול ומכוון-בקפידה
 * (fullscreen נייד, viewport דינמי וכו', ראה ההערות שם) והלייאאוט כאן שונה מספיק (פחות
 * בקרות, כרום אחר) שכמעט שום JSX לא היה משותף בפועל.
 *
 * ⚠️ אין כאן isStageExpanded/useVisibleViewport (מצב מסך-מלא בנייד, קיים ב-studio הרגיל) —
 * הוקטן במכוון מ-v1 הזה: מקטין סיכון (לא מעתיקים תזמורת viewport עדינה לקובץ חדש) ומשאיר
 * מיקוד בלולאת-היצירה הליבתית. ניתן להוסיף בסבב הבא אם יתברר שצריך.
 *
 * ⚠️ Suspense: כמו ב-studio הרגיל — useSaveProject/useDownload קוראים useSearchParams.
 *
 * ⚠️ ברירת-מחדל פרטיות: useDownload({defaultVisibility:'private'}) — יצירות מכאן לא
 * מתפרסמות אוטומטית לגלריה הציבורית (הפוך מה-Studio הרגיל). המשתמש (הורה/מורה, אחרי login)
 * יכול לפרסם ידנית מ-My Gallery דרך PublishToggleButton. login עדיין נדרש לשמירה/הורדה,
 * בדיוק כמו Studio הרגיל — זו בכוונה נקודת-המסירה "קרא להורה כדי לסיים".
 *
 * ⭐ 2026-09-04 (דווח חי): stickers (EmojiStickerLayer) — קישוט ויזואלי בלבד, state מקומי
 * כאן ולא ב-shapeStore (ראה EmojiStickerLayer.tsx). Clear מנקה גם אותם, לא רק את הציור.
 * ⚠️ 2026-09-05 (דווח חי: "כפתורי סגנון לא צריכים להוסיף אימוג'י ללוח"): המקור היחיד
 * לסטיקרים עכשיו הוא EmojiPickerButton — KidsGenrePicker חזר לבחור ז'אנר בלבד, בלי
 * תופעת-לוואי על הלוח (ראה שם).
 *
 * ⭐⭐ 2026-09-05 (דווח חי: "צריך כפתור וי לאשר אימוג'י כדי שישפיע על המנגינה"): pendingEmoji —
 * בחירת אימוג'י מ-EmojiPickerButton כבר לא יוצרת sticker ישירות. היא פותחת
 * ShapePlacementOverlay (kind='circle', emoji=...) בדיוק כמו pendingShapeKind — רק אחרי
 * אישור (✓) גם נוצר sticker (addStickerAt, במיקום/גודל **המדויקים** מ-onCommit) וגם
 * מתחייבת צורת-עיגול ל-shapeStore, כך שהאימוג'י באמת משפיע על המנגינה. ⚠️ שני ה-pending
 * (צורה/אימוג'י) חוסמים זה את זה (disabled בשני הכיוונים) — שתי תצוגות-מקדימה בו-זמנית
 * היו מתנגשות על אותה שכבת z-30.
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { MusicalGrid } from '@/components/canvas/MusicalGrid';
import { ScoreStaff } from '@/components/canvas/ScoreStaff';
import { RevealOverlay } from '@/components/canvas/RevealOverlay';
import { EmojiStickerLayer, type EmojiSticker } from '@/components/kids/EmojiStickerLayer';
import { EmojiPickerButton } from '@/components/kids/EmojiPickerButton';
import {
  ShapePlacementOverlay,
  type ShapePlacementResult,
} from '@/components/kids/ShapePlacementOverlay';
import { ShapeTray } from '@/components/kids/ShapeTray';
import { ColorPicker } from '@/components/kids/ColorPicker';
import { ThicknessPicker } from '@/components/kids/ThicknessPicker';
import { KidsGenrePicker } from '@/components/kids/KidsGenrePicker';
import { Logo } from '@/components/branding/Logo';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useSaveProject } from '@/hooks/useSaveProject';
import { useDownload } from '@/hooks/useDownload';
import { useFitAspectRatio } from '@/hooks/useFitAspectRatio';
import { useNoteBoardGrid } from '@/hooks/useNoteBoardGrid';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { useShapeStore } from '@/stores/shapeStore';
import { KIDS_SOUND_DEFAULTS } from '@/lib/kidsSoundDefaults';
import type { KidsShapeKind } from '@/lib/kidsShapes';

/** מונע ערימת-אימוג'ים בלתי-מוגבלת אם ילד לוחץ שוב ושוב — הישן ביותר יורד (FIFO). */
const MAX_STICKERS = 12;
const DEFAULT_STICKER_SIZE = 40;

function KidsStudioContent() {
  const clear = useShapeStore((state) => state.clear);
  const genreId = useGenreStore((state) => state.genreId);
  // ⚠️⚠️ 2026-09-05 (דווח חי: "Genre not found: trance" בלחיצה על Play): studio/page.tsx
  // הרגיל טוען את רשימת ה-genre packs דרך useEffect בתוך GenreSelector.tsx — קומפוננטה
  // שהעמוד הזה בכוונה לא מרכיב (יש לו KidsGenrePicker משלו). בלי הטעינה הזו packs נשאר []
  // לנצח, ו-useAudioEngine/useNoteBoardGrid לא מוצאים אף ז'אנר, לא רק את זה שנבחר.
  const fetchGenrePacks = useGenrePacksStore((state) => state.fetchPacks);
  useEffect(() => {
    void fetchGenrePacks();
  }, [fetchGenrePacks]);
  // ⭐ 2026-09-05 (לפי בקשה חיה: ברירת-מחדל "אהובה, מגניבה, וואוו" בלי בורר-צלילים) —
  // ראה kidsSoundDefaults.ts. מוזרם ל-useAudioEngine/useDownload כ-override, לא נכתב
  // ל-useSoundSelectionStore המשותף עם Studio הרגיל.
  const soundSelectionsOverride = KIDS_SOUND_DEFAULTS[genreId];
  const {
    isPlaying,
    isLoading,
    currentSeconds,
    musicalDurationSeconds,
    error,
    canPlay,
    play,
    stop,
    renderElapsedSeconds,
  } = useAudioEngine({ soundSelectionsOverride });
  const saveProject = useSaveProject();
  const { requestDownload, isDownloading, downloadError, statusMessage, unsupportedNotice } =
    useDownload(saveProject, { defaultVisibility: 'private', soundSelectionsOverride });
  const noteBoardGrid = useNoteBoardGrid();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const fittedSize = useFitAspectRatio(stageContainerRef, 1024);
  const [pendingShapeKind, setPendingShapeKind] = useState<KidsShapeKind | null>(null);
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);
  const [stickers, setStickers] = useState<EmojiSticker[]>([]);

  /** נקרא מ-ShapePlacementOverlay.onCommit — placement הוא ה-cx/cy/size/pathIndex **המדויקים** שאושרו. */
  const addStickerAt = (placement: ShapePlacementResult, emoji: string): void => {
    // ⚠️ ה-path (עיגול) שנוצר ב-addPath מקבל בכוונה pathStyle שקוף — האימוג'י (למטה) הוא
    // הייצוג החזותי היחיד שלו, לא "עיגול + אימוג'י" זה-על-גבי-זה (ראה DrawingCanvas.tsx).
    useShapeStore
      .getState()
      .setPathStyle(placement.pathIndex, { color: 'transparent', strokeWidth: 0 });
    const sticker: EmojiSticker = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      emoji,
      x: placement.cx,
      y: placement.cy,
      pathIndex: placement.pathIndex,
      // ⚠️ size מגיע מנורמל (יחסי לרוחב הלוח) — DEFAULT_STICKER_SIZE הוא fallback רק
      // למקרה הקצה שבו fittedSize עדיין null (לא אמור לקרות בפועל בשלב שבו כבר הציבו משהו).
      size: fittedSize ? placement.size * fittedSize.width : DEFAULT_STICKER_SIZE,
    };
    setStickers((current) => [...current, sticker].slice(-MAX_STICKERS));
  };

  const clearAll = (): void => {
    clear();
    setStickers([]);
  };

  const progress =
    musicalDurationSeconds > 0 ? Math.min(1, currentSeconds / musicalDurationSeconds) : 0;

  return (
    <main className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-3">
        <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
          <Logo markOnly />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void (isPlaying ? stop() : play())}
            disabled={!canPlay || isLoading}
            className="flex h-14 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-semibold text-primary-foreground shadow-md active:scale-95 disabled:opacity-40"
          >
            {isLoading ? 'Creating…' : isPlaying ? 'Stop' : 'Play'}
          </button>
          <button
            type="button"
            onClick={requestDownload}
            disabled={!canPlay || isDownloading}
            className="flex h-14 items-center justify-center rounded-2xl bg-secondary px-6 text-lg font-semibold text-secondary-foreground shadow-md active:scale-95 disabled:opacity-40"
          >
            {isDownloading ? 'Working…' : 'Save'}
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium text-muted-foreground">Music Style</span>
          <KidsGenrePicker />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm text-muted-foreground">
        {isLoading && (
          <span role="status">Creating your sound… {renderElapsedSeconds.toFixed(0)}s</span>
        )}
        {error && <span className="text-destructive">{error}</span>}
        {downloadError && <span className="text-destructive">{downloadError}</span>}
        {unsupportedNotice && <span className="text-amber-500">{unsupportedNotice}</span>}
        {statusMessage && <span>{statusMessage}</span>}
      </div>

      <div
        ref={stageContainerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4"
      >
        <div
          className="relative aspect-video max-h-full w-full overflow-hidden bg-white text-[#211B4A] shadow-lg"
          style={fittedSize ? { width: fittedSize.width, height: fittedSize.height } : undefined}
        >
          <DrawingCanvas hidden={isPlaying} />
          <MusicalGrid
            {...(noteBoardGrid && {
              rows: noteBoardGrid.rows,
              columns: noteBoardGrid.columns,
              rowLabels: noteBoardGrid.rowLabels,
            })}
          />
          <EmojiStickerLayer stickers={stickers} onChange={setStickers} />
          <ScoreStaff progress={progress} />
          <RevealOverlay />
          {pendingShapeKind && (
            <ShapePlacementOverlay
              kind={pendingShapeKind}
              onDone={() => {
                setPendingShapeKind(null);
              }}
            />
          )}
          {pendingEmoji && (
            <ShapePlacementOverlay
              kind="circle"
              emoji={pendingEmoji}
              onDone={() => {
                setPendingEmoji(null);
              }}
              onCommit={(placement) => {
                addStickerAt(placement, pendingEmoji);
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border/60 bg-card/60 px-4 py-3">
        <ColorPicker />
        <ThicknessPicker />
        <ShapeTray
          onSelect={setPendingShapeKind}
          disabled={pendingShapeKind !== null || pendingEmoji !== null}
        />
        <EmojiPickerButton
          onPick={setPendingEmoji}
          disabled={pendingShapeKind !== null || pendingEmoji !== null}
        />
        <button
          type="button"
          onClick={clearAll}
          className="flex h-12 items-center justify-center rounded-2xl border-2 border-border bg-card px-4 text-base font-medium text-muted-foreground shadow-sm active:scale-95"
        >
          Clear
        </button>
      </div>
    </main>
  );
}

export default function KidsStudioPage() {
  return (
    <Suspense>
      <KidsStudioContent />
    </Suspense>
  );
}
