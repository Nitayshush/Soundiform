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
 * ⭐⭐⭐ 2026-09-05 (דווח חי, מובייל — "הכפתורים גדולים מדי, הלוח קטן מדי, בנוף הלוח נעלם"):
 * isStageExpanded/useVisibleViewport **כן** מיובאים עכשיו — פורטו נאמנה מ-studio/page.tsx
 * (אותה סיבה בדיוק: fixed inset-x-0 + מדידת visualViewport, לא Fullscreen API — לא נתמך
 * ב-iOS Safari על אלמנטים רגילים). זו הדרך היחידה לתת ללוח "גדול ככל שניתן" בפועל, גם
 * בנוף שבו כרום-הדפדפן דוחס את הגובה הזמין כמעט לאפס. כל שאר הכרום (כותרת/סגנון/טולבר)
 * קיבל גדלים מגיבים (קטן כברירת מחדל, גדל מ-sm ומעלה) כדי לצמצם כמה שיותר את מה שהלוח
 * הרגיל (הלא-מורחב) צריך לחלוק איתו — ראה ColorPicker.tsx/KidsGenrePicker.tsx וכו' לפירוט.
 *
 * ⭐⭐⭐⭐ 2026-09-05 (דווח חי: "כשהופכים את המסך בנייד הלוח נעלם", גם אחרי התיקון הראשון):
 * מקור הבאג האמיתי — useFitAspectRatio.ts (משותף עם Studio הרגיל) עושה `if (availableWidth
 * <= 0 || availableHeight <= 0) return;` **בלי לאפס את size** — אם המדידה תוך-כדי-סיבוב
 * נתפסת ברגע שהמיכל (flex-1 בתוך h-dvh נוקשה) נסחט לגובה 0-או-שלילי, ה-hook פשוט קופא על
 * הגודל הישן (מהפורטרט), שעכשיו גדול/קטן-לא-נכון ביחס לנוף. main היה `h-dvh` (גובה קשיח —
 * שום צד לא יכול "לברוח" אם הכרום+הלוח לא נכנסים יחד), ומיכל-הבמה היה `min-h-0` (מרשה
 * לו להיסחט עד 0 לגמרי). ⚠️ בכוונה **לא** נגעתי ב-useFitAspectRatio.ts עצמו (משותף, עדין,
 * ומסוכן לשנות בלי בדיקה חיה ב-Studio הרגיל) — התיקון כאן מונע מהתנאי ה-baguy להתרחש בכלל:
 * main עבר ל-`min-h-dvh` (יכול לגדול, לא רק לצמצם) ומיכל-הבמה קיבל `min-h-[220px]` קבוע
 * (לא `min-h-0`) — הבמה **לעולם** לא נסחטת ל-0, ואם הכרום+הרצפה-הזו לא נכנסים יחד בגובה
 * הנוף, הדף פשוט גולל אנכית (עדיף על "הלוח נעלם" לגמרי).
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
import { Maximize, Minimize } from 'lucide-react';
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
import { useVisibleViewport } from '@/hooks/useVisibleViewport';
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
  // ⭐ 2026-09-05 (לפי בקשה חיה: כפתור הגדלה/הקטנה כמו ב-Studio הרגיל) — פורט נאמן, ראה
  // ⭐⭐⭐ למעלה וההערות המקוריות ב-studio/page.tsx (fixed inset-x-0, לא Fullscreen API).
  const [isStageExpanded, setIsStageExpanded] = useState(false);
  const visibleViewport = useVisibleViewport(isStageExpanded);

  useEffect(() => {
    if (!isStageExpanded) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsStageExpanded(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isStageExpanded]);

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
  const hasStatusMessage =
    isLoading ||
    Boolean(error) ||
    Boolean(downloadError) ||
    Boolean(unsupportedNotice) ||
    Boolean(statusMessage);

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-col gap-1.5 border-b border-border/60 bg-card/60 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
            <Logo markOnly />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => void (isPlaying ? stop() : play())}
              disabled={!canPlay || isLoading}
              className="flex h-8 items-center justify-center rounded-2xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-md active:scale-95 disabled:opacity-40 sm:h-14 sm:px-6 sm:text-lg"
            >
              {isLoading ? 'Creating…' : isPlaying ? 'Stop' : 'Play'}
            </button>
            <button
              type="button"
              onClick={requestDownload}
              disabled={!canPlay || isDownloading}
              className="flex h-8 items-center justify-center rounded-2xl bg-secondary px-3 text-xs font-semibold text-secondary-foreground shadow-md active:scale-95 disabled:opacity-40 sm:h-14 sm:px-6 sm:text-lg"
            >
              {isDownloading ? 'Working…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 text-[9px] font-medium text-muted-foreground sm:text-xs">
            Style
          </span>
          <KidsGenrePicker />
        </div>
      </header>

      {hasStatusMessage && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-2 py-1 text-[11px] text-muted-foreground sm:gap-3 sm:px-4 sm:py-2 sm:text-sm">
          {isLoading && (
            <span role="status">Creating your sound… {renderElapsedSeconds.toFixed(0)}s</span>
          )}
          {error && <span className="text-destructive">{error}</span>}
          {downloadError && <span className="text-destructive">{downloadError}</span>}
          {unsupportedNotice && <span className="text-amber-500">{unsupportedNotice}</span>}
          {statusMessage && <span>{statusMessage}</span>}
        </div>
      )}

      {/* ⚠️ ראה studio/page.tsx להסבר המלא על כל שורה כאן — הפורט נאמן ב-100%: fixed
          inset-x-0 + מדידת visibleViewport (לא inset-0/100dvh לבד, שלא מספיקים בנייד עם
          כרום-דפדפן מרחף/אחרי סיבוב), ו-fittedSize לא חל כלל במצב מורחב (הציור מנורמל
          [0,1] בשני הצירים, יחס-הלוח לא משפיע על המוזיקה). */}
      <div
        ref={stageContainerRef}
        className={
          isStageExpanded
            ? 'fixed inset-x-0 z-50 flex h-[100dvh] items-center justify-center bg-background p-1'
            : 'relative flex min-h-[220px] flex-1 items-center justify-center bg-muted/30 p-2 sm:p-4'
        }
        style={
          isStageExpanded && visibleViewport
            ? { height: visibleViewport.height, top: visibleViewport.offsetTop }
            : isStageExpanded
              ? { top: 0 }
              : undefined
        }
      >
        <div
          className={
            isStageExpanded
              ? 'relative h-full w-full overflow-hidden bg-white text-[#211B4A] shadow-lg'
              : 'relative aspect-video max-h-full w-full overflow-hidden bg-white text-[#211B4A] shadow-lg'
          }
          style={
            !isStageExpanded && fittedSize
              ? { width: fittedSize.width, height: fittedSize.height }
              : undefined
          }
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
        {/* ⭐ 2026-09-05 (לפי בקשה חיה): כפתור הגדלה/הקטנה — **בנייד בלבד** (sm:hidden), בדיוק
            כמו ב-Studio הרגיל. ⚠️ ממוקם מול המיכל ולא מול קופסת-הציור — ראה studio/page.tsx
            להסבר (סיבוב מכשיר לא יחתוך את הכפתור מחוץ לתחום). */}
        <button
          type="button"
          onClick={() => {
            setIsStageExpanded((expanded) => !expanded);
          }}
          aria-label={isStageExpanded ? 'Exit full screen' : 'Draw in full screen'}
          aria-pressed={isStageExpanded}
          className="absolute right-3 bottom-3 z-20 flex size-11 touch-none items-center justify-center rounded-full bg-[#211B4A]/80 text-white shadow-lg backdrop-blur-sm active:bg-[#211B4A] sm:hidden"
        >
          {isStageExpanded ? (
            <Minimize className="size-5" aria-hidden="true" />
          ) : (
            <Maximize className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/60 bg-card/60 px-2 py-1.5 sm:gap-4 sm:px-4 sm:py-3">
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
          className="flex h-8 items-center justify-center rounded-2xl border-2 border-border bg-card px-3 text-xs font-medium text-muted-foreground shadow-sm active:scale-95 sm:h-12 sm:px-4 sm:text-base"
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
