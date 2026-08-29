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

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize, Minimize } from 'lucide-react';
import { DrawingCanvas } from '@/components/canvas/DrawingCanvas';
import { MusicalGrid } from '@/components/canvas/MusicalGrid';
import { ScoreStaff } from '@/components/canvas/ScoreStaff';
import { RevealOverlay } from '@/components/canvas/RevealOverlay';
import { GenreSelector } from '@/components/controls/GenreSelector';
import { SoundSelector } from '@/components/controls/SoundSelector';
import { UploadButton } from '@/components/controls/UploadButton';
import { Logo } from '@/components/branding/Logo';
import { AudioDebugHUD } from '@/components/debug/AudioDebugHUD';
import { Button } from '@/components/ui/button';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useSaveProject } from '@/hooks/useSaveProject';
import { useDownload } from '@/hooks/useDownload';
import { useFitAspectRatio } from '@/hooks/useFitAspectRatio';
import { useNoteBoardGrid } from '@/hooks/useNoteBoardGrid';
import { useVisibleViewport } from '@/hooks/useVisibleViewport';
import { useShapeStore } from '@/stores/shapeStore';

function StudioContent() {
  const shapeHash = useShapeStore((state) => state.shapeHash);
  const clear = useShapeStore((state) => state.clear);
  const {
    isPlaying,
    isLoading,
    currentSeconds,
    durationSeconds,
    error,
    canPlay,
    play,
    stop,
    renderElapsedSeconds,
    renderProgress,
  } = useAudioEngine();
  // ⭐ נקרא פעם אחת בלבד — מועבר גם לכפתור Save וגם ל-useDownload (ראה הערת useDownload.ts
  // ל-why). קריאה כפולה ל-useSaveProject() הייתה יוצרת שני state instances לא-מסונכרנים.
  const saveProject = useSaveProject();
  const { requestSave, isSaving, saveError, savedProjectId } = saveProject;
  const { requestDownload, isDownloading, downloadError, statusMessage, unsupportedNotice } =
    useDownload(saveProject);
  const noteBoardGrid = useNoteBoardGrid();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  // ⭐ 2026-08-29 (לפי בקשה חיה): מצב-ציור מוגדל בנייד. מימוש ב-CSS (fixed inset-0) ולא דרך
  // Fullscreen API בכוונה — ב-iOS Safari requestFullscreen לא נתמך על אלמנטים רגילים (רק
  // וידאו), כך שה-API היה עובד באנדרואיד ונכשל בשקט באייפון. CSS עובד זהה בשתיהן.
  const [isStageExpanded, setIsStageExpanded] = useState(false);
  // ⚠️ נמדד רק במצב מורחב — ראה useVisibleViewport.ts: `dvh` לבדו לא הספיק בנייד אחרי סיבוב,
  // ותחתית הלוח (עם כפתור ההקטנה) נחתכה.
  const visibleViewport = useVisibleViewport(isStageExpanded);

  // ⚠️ יציאה ב-Escape (מקלדת חיצונית/טאבלט) + מניעת גלילת-רקע מאחורי הלוח המוגדל, שגורמת
  // ל"קפיצות" מטרידות תוך כדי ציור בנייד.
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
  // ⭐ תואם max-w-5xl (64rem @ 16px root) — הקאפ הזה *חייב* להיכנס לחישוב ב-useFitAspectRatio
  // עצמו, לא להישאר class Tailwind נפרד; ראה התיעוד ב-useFitAspectRatio.ts לבאג שזה תיקן.
  const fittedSize = useFitAspectRatio(stageContainerRef, 1024);

  const progress = durationSeconds > 0 ? currentSeconds / durationSeconds : 0;

  return (
    <main className="flex h-dvh flex-col bg-background">
      {/* ⭐ 2026-08-24 (מובייל): flex-col sm:flex-row — שורות מכוונות מתחת ל-sm (ראש עם
          הפעולות התכופות, אחר-כך בקרות משניות), במקום flex-wrap "מקרי" שיצר שורות דחוסות.
          ⭐ 2026-08-24 (בדיקה חיה, 320px): GenreSelector קיבל שורה נפרדת-לגמרי מתחת ל-sm
          (במקום לשתף שורה עם Sound/Upload/Save שדחקו אותו לגלילה-אופקית סמויה שהמשתמש לא
          מצא) — sm:contents "ממיס" את המיכל ב-sm+ בדיוק כמו הקבוצה הראשונה למעלה, כך
          שהתצוגה בדסקטופ נשארת זהה (שורה אחת), רק מתחת ל-sm זו שורה עצמאית. */}
      {/* ⭐ 2026-08-24: relative z-40 — בלי זה, הפאנל הנפתח של SoundSelector (absolute, z-30
          בתוך הכותרת) נתפס מאחורי קנבס הבמה שמתחתיו (pixi/WebGL, נתפס בבדיקת Playwright
          חיה — קליק על כפתור בפאנל "יורט" ע"י הקנבס). z-40 תואם את אותו ערך שכבר בשימוש
          ב-Header.tsx הראשי (sticky top-0 z-40) — לא ערך שרירותי חדש. */}
      <header className="relative z-40 flex flex-col gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:contents">
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
            <Logo markOnly className="sm:hidden" />
            <Logo className="hidden sm:block" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isPlaying ? 'secondary' : 'default'}
              onClick={() => void (isPlaying ? stop() : play())}
              disabled={!canPlay || isLoading}
            >
              {isLoading ? 'Creating…' : isPlaying ? 'Stop' : 'Play'}
            </Button>
            {/* ⭐ §11 item 8: וידאו-כברירת-מחדל להורדה (נגיש ל-YouTube) — הכפתור הראשון-אי-פעם
                שבפועל מפעיל את שרשרת render→share→download; ראה useDownload.ts. */}
            <Button type="button" onClick={requestDownload} disabled={!canPlay || isDownloading}>
              {isDownloading ? 'Working…' : 'Download'}
            </Button>
          </div>
        </div>
        <div className="sm:contents">
          <GenreSelector />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-1 sm:flex-wrap sm:overflow-visible">
          {/* ⭐ 2026-08-24 (Area 1): כפתור+פאנל קומפקטי (לא כמה שורות-תמיד-גלויות, ראה
              SoundSelector.tsx) — נעלם לגמרי כשלז'אנר הפעיל אין לו soundOptions
              (chill/cinematic/reggae). */}
          <SoundSelector />
          <UploadButton />
          <Button
            type="button"
            variant="outline"
            onClick={() => requestSave()}
            disabled={!canPlay || isSaving}
          >
            {isSaving ? 'Saving…' : savedProjectId ? 'Saved ✓' : 'Save'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {/* ⭐ 2026-08-29 (לפי בקשה חיה): הרינדור-מראש לוקח זמן ממשי בנייד (נמדד: ~88 שניות
              ליצירה של 40 שניות) — בלי משוב נראה כאילו הכפתור לא הגיב. מציגים מונה עולה,
              ואחוז אמיתי כשיש כבר מדידת-מהירות למכשיר הזה (renderSpeedMemory.ts). */}
          {isLoading && (
            <span
              className="flex items-center gap-2 font-medium text-foreground"
              role="status"
              aria-live="polite"
              data-testid="render-progress"
            >
              <span
                className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Creating your sound… {renderElapsedSeconds.toFixed(0)}s
              {renderProgress !== null && ` · ${Math.round(renderProgress * 100).toFixed(0)}%`}
            </span>
          )}
          {error && <span className="text-destructive">{error}</span>}
          {saveError && <span className="text-destructive">{saveError}</span>}
          {downloadError && <span className="text-destructive">{downloadError}</span>}
          {/* ⚠️ לא שגיאה — המכשיר לא יכול לקודד וידאו, אבל היצירה נשמרה ומשותפת. */}
          {unsupportedNotice && <span className="text-amber-500">{unsupportedNotice}</span>}
          {statusMessage && <span>{statusMessage}</span>}
          {durationSeconds > 0 && (
            <span className="font-mono" data-testid="playback-time">
              {currentSeconds.toFixed(1)}s / {durationSeconds.toFixed(1)}s
            </span>
          )}
          {/* ⭐ מובייל: פרט לבדיקת-דטרמיניזם (§1), לא חיוני למשתמש הרגיל — מפנה מקום. */}
          <span className="hidden font-mono text-xs sm:inline" title="shapeHash — determinism, §1">
            {shapeHash ? shapeHash.slice(0, 12) : 'Draw a shape'}
          </span>
          <Button type="button" variant="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      </header>
      {/* ⭐ 2026-08-23/24: מיכל-מיישר עם רקע ניטרלי, במקום flex-1 מלא-מסך — כדי שכל הציור
          תמיד נראה במלואו, בלי גלילה, בכל גודל מסך. הגודל בפועל מחושב ב-JS (useFitAspectRatio,
          למטה) — ריבועי מתחת ל-sm (יותר גובה שימושי לציור על נייד מ-16:9, שהיה הופך לרצועה
          דקה ~193px גובה על טלפון), 16:9 מעליו (תואם את הוידאו המיוצא) — CSS טהור
          (aspect-ratio+max-width+max-height) לא מחשב נכון כששני הצירים יכולים להיות המגביל
          (למשל landscape נייד, איפה שהגובה, לא הרוחב, קובע). */}
      {/* ⭐ min-h-0 קריטי: בלעדיו, ברירת המחדל של flexbox (min-height:auto על flex item)
          מונעת מהמיכל הזה להתכווץ מתחת לגודל-התוכן שלו — ה-box הפנימי (עם aspect-video
          כברירת מחדל לפני שה-hook מודד) "דוחף" את המיכל לגבוה מדי, מה שגורם למדידה
          שגויה (rect.height מנופח) ולקופסה שיוצאת מטווח ה-viewport ב-landscape. */}
      {/* ⭐⭐ 2026-08-29 (לפי בקשה חיה: "הלוח קטן בנייד, וגם לא גדל כשהופכים את המכשיר"):
          במצב מורחב המיכל הופך ל-fixed inset-0 ומכסה גם את הכותרת — כל המסך לציור.
          ⚠️ לא נדרש שום חישוב-גודל חדש: useFitAspectRatio ו-DrawingCanvas שניהם עובדים עם
          ResizeObserver, אז שינוי גודל המיכל מודד מחדש מעצמו — כולל **בחירת יחס-הצורה**
          (ריבוע מתחת ל-640px רוחב, 16:9 מעליו), ולכן סיבוב לרוחב במצב מורחב באמת מנצל את
          המסך במקום להישאר ריבוע קטן. זו הסיבה שלא נגעתי ב-hook עצמו. */}
      {/* ⚠️⚠️ 2026-08-29 (נתפס בבדיקה חיה בנייד): `inset-0` נמדד מול ה-layout viewport, שבנייד
          **גבוה מהאזור הנראה** כשסרגל-הכתובת מוצג — ולכן תחתית הלוח (ואיתה כפתור ההקטנה)
          נחתכה מתחת לקצה המסך. `h-[100dvh]` הוא ה-viewport ה**דינמי**, שמתכווץ/מתרחב יחד עם
          כרום-הדפדפן, ולכן תמיד תואם למה שבאמת נראה. `relative` — כדי שכפתור ההקטנה ימוקם
          מול המסך ולא מול קופסת-הציור (ראה הכפתור למטה). */}
      <div
        ref={stageContainerRef}
        className={
          isStageExpanded
            ? 'fixed inset-x-0 z-50 flex h-[100dvh] items-center justify-center bg-background p-1'
            : 'relative flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4'
        }
        // ⚠️ המידה הנמדדת גוברת על h-[100dvh] (שנשאר כגיבוי לרגע שלפני המדידה הראשונה
        // ולדפדפנים בלי visualViewport). offsetTop נדרש כי כרום מרחף דוחף את האזור הנראה
        // כלפי מטה — בלעדיו הלוח מתחיל מעל ראש המסך והתחתית נחתכת.
        style={
          isStageExpanded && visibleViewport
            ? { height: visibleViewport.height, top: visibleViewport.offsetTop }
            : isStageExpanded
              ? { top: 0 }
              : undefined
        }
      >
        {/* ⭐ הרקע הזה לבן במכוון (לא bg-background) — סרגל התווים/קנבס הציור, בניגוד
            ל-header שנשאר על הפלטה הכהה. text-[#211B4A] נותן ל-MusicalGrid (currentColor)
            קו כהה-על-לבן במקום הבהיר-על-כהה שהיה מתאים לרקע הקודם. */}
        {/* ⭐ בלי max-w-5xl כ-class: הקאפ הזה חייב לחיות רק בתוך useFitAspectRatio (הועבר
            כ-maxWidthPx למעלה) — max-width מה-CSS היה מתנגש עם ה-style המחושב (חותך רוחב
            בלי לעדכן גובה בהתאם, ראה תיעוד ב-useFitAspectRatio.ts). aspect-video/max-h-full/
            w-full נשארים רק כברירת-מחדל לרגע שלפני שה-hook מודד לראשונה. */}
        {/* ⭐ 2026-08-24: overflow-hidden — קו-הביטחון האחרון נגד ציור/סמנים שדולפים מחוץ
            לקופסה (דווח בבדיקה חיה: קווים שנראו בורחים מהתיבה הלבנה). DrawingCanvas.tsx כבר
            מהדק (clamp) כל נקודה ל-[0,1] בזמן הלכידה, אבל ה-backing-store שלו (canvas.width/
            height) נגזר מ-getBoundingClientRect() ברגע ה-resize — כל פער תת-פיקסל בין המדידה
            לגודל-CSS בפועל (זום דפדפן, מעבר-רזולוציה) יכול לגרום לקנבס לצייר קצת יותר-גדול
            מהקופסה שסביבו; overflow-hidden מבטיח שזה תמיד נחתך חזותית, בלי קשר למקור הפער. */}
        {/* ⭐ 2026-08-29 (לפי בקשה חיה: "שיגדל לגודל של כל המסך"): במצב מורחב הלוח **ממלא**
            את המסך במקום להשתבץ ביחס-צורה קבוע. מותר: הציור מנורמל ל-[0,1] בשני הצירים
            (toShapeData), אז יחס-הלוח לא משפיע על המוזיקה שנוצרת — והוידאו המיוצא ממילא
            מקבל את היחס שלו בנפרד. לכן במצב מורחב לא מחילים את fittedSize בכלל. */}
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
          <ScoreStaff progress={progress} />
          <RevealOverlay />
        </div>
        {/* ⭐ 2026-08-29 (לפי בקשה חיה): כפתור הגדלה/הקטנה כמו בנגני וידאו — **בנייד בלבד**
            (sm:hidden), כי בדסקטופ הלוח ממילא גדול.
            ⚠️⚠️ ממוקם מול **המיכל** ולא מול קופסת-הציור — נתפס בבדיקה חיה: כשהוא ישב בתוך
            הקופסה, סיבוב המכשיר גרם לתחתית הקופסה להיחתך ואיתה נעלם כפתור ההקטנה, כלומר
            המשתמש נתקע במצב מורחב בלי דרך לצאת. המיכל תמיד תופס בדיוק את האזור הנראה
            (h-[100dvh] למעלה), ולכן הכפתור גלוי תמיד.
            ⚠️ touch-none מונע מהמגע על הכפתור להתחיל שרטוט על הקנבס שמתחתיו. */}
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
      <AudioDebugHUD />
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
