/**
 * @file        SoundSelector.tsx
 * @description ⭐ 2026-08-24 (מקצה שיפורים לסאונד, Area 1): בורר-צליל לפי-תפקיד
 *              (bass/lead/drums/pad) — נגלה רק כשהז'אנר הפעיל מגדיר soundOptions (טראנס/
 *              האוס, סינתטי) עם יותר מאופציה אחת לתפקיד. ראה PROJECT.md §0.1.
 * @author      Soundiform
 * @created     2026-08-24
 *
 * ⭐ 2026-08-24 (בדיקה חיה): הפך מ-4 שורות-תמיד-גלויות (שהציפו את הכותרת) לכפתור-דלת+פאנל
 * נפתח, אותה תבנית בדיוק כמו תפריט-ההמבורגר במובייל (Header.tsx) — לא דפוס חדש לקודבייס
 * הזה. כל לחיצה על אופציה גם בוחרת אותה *וגם* משמיעה דגימה קצרה (usePreviewSound.ts) —
 * "לבחור נכון" דורש לשמוע קודם, לא רק שם טקסטואלי.
 *
 * ⭐ 2026-08-24 (בדיקה חיה שנייה, מובייל): הפאנל נבנה דרך createPortal ל-document.body,
 * לא כ-absolute רגיל בתוך ה-DOM המקומי — כי ה-container שהכפתור יושב בו (studio/page.tsx's
 * genre/sound/upload/save row) הוא overflow-x-auto מתחת ל-sm (לגלילה אופקית של הפילים,
 * ראה GenreSelector.tsx). לפי ה-spec, overflow-x שאינו visible מאלץ גם overflow-y ל-auto
 * (לא visible) — כלומר הפאנל היה נחתך *אנכית* ע"י האב, בלתי-נראה לגמרי מתחת ל-sm, גם
 * שהיה קיים ב-DOM (נתפס רק בבדיקה חיה עם viewport מובייל, לא בדסקטופ שבו יש
 * sm:overflow-visible שמבטל את זה). portal + מיקום מחושב לפי getBoundingClientRect() של
 * הכפתור פותר את זה לחלוטין — הפאנל כבר לא צאצא של שום container עם overflow מוגבל.
 *
 * ⭐ 2026-08-24 (בדיקה חיה שלישית, מובייל): מיקום ראשוני לפי left=trigger.rect.left בלבד
 * (בלי לדעת עדיין את רוחב-הפאנל בפועל) גרם לפאנל לגלוש מעבר לקצה-ימין ב-viewport צר —
 * max-width מבוסס-vw לא מספיק כי הוא לא לוקח בחשבון *איפה* left ממוקם. התיקון: מדידה
 * דו-שלבית (useLayoutEffect אחרי mount) — הפאנל מצטייר invisible קודם, נמדד בפועל
 * (getBoundingClientRect), left/top נהדקים (clamp) לגבולות ה-viewport עם שוליים, ורק אז
 * נחשף — אותה טכניקה שספריות popover אמיתיות (Floating UI וכו') כבר עושות.
 *
 * ⭐ 2026-08-24 (בדיקה חיה רביעית, מובייל): אחרי שהתוכן גדל (הרבה יותר אופציות-צליל, ראה
 * git history) הפאנל נהיה גבוה מספיק שעל מסך קטן ה-clamp האנכי (useLayoutEffect למעלה)
 * דוחף את top לשלילי/חופף את כפתור-הטריגר עצמו — לא ניתן היה לסגור (הכפתור לא נגיש-למגע).
 * שני תיקונים: (1) max-h-[70vh]+overflow-y-auto על גוף-הפאנל — הפאנל *לעולם* לא גדל
 * בלתי-מוגבל, גולל בפנים אם צריך; (2) כפתור-סגירה מפורש (✕) בכותרת-הפאנל, sticky למעלה —
 * דרך-סגירה מובטחת שלא תלויה בכלל בזה שהטריגר עדיין נגיש/גלוי.
 *
 * ⭐ 2026-08-24 (לפי בקשה חיה): "Off" — אופציה נוספת בכל שורת-תפקיד, לא רק בין הצלילים —
 * מכבה את הטראק לגמרי (MUTED_SOUND_OPTION_ID, genreAdapter.ts → GenreAudioConfig.mutedRoles
 * → sharedScheduling.ts מסנן את הטראק *לפני* בניית provider/mixChain, ראה שם).
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ "בחר כלי" (chill/cinematic/reggae, דגימות אמיתיות) הוא הרחבה עתידית נפרדת (Area 1
 * ב-plan, gate על בדיקת-דטרמיניזם) — לא בהיקף הקומפוננטה הזו, שמכסה רק soundOptions
 * מסוג synth (טראנס/האוס).
 */

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TrackRole } from '@soundiform/core';
import type { SoundOption } from '@soundiform/genres';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';
import { useSoundSelectionStore } from '@/stores/soundSelectionStore';
import { usePreviewSound } from '@/hooks/usePreviewSound';
import { MUTED_SOUND_OPTION_ID } from '@/lib/genreAdapter';
import { Button } from '@/components/ui/button';

const ROLE_LABEL: Record<TrackRole, string> = {
  bass: 'Bass',
  lead: 'Lead',
  pad: 'Pad',
  drums: 'Drums',
  skank: 'Skank',
};

interface PanelPosition {
  top: number;
  left: number;
}

/** מרווח מינימלי מקצה ה-viewport, לא רק max-width מבוסס-vw (ראה הערת הקובץ). */
const VIEWPORT_MARGIN_PX = 16;

export function SoundSelector() {
  const genreId = useGenreStore((state) => state.genreId);
  const packs = useGenrePacksStore((state) => state.packs);
  const selectionsByGenre = useSoundSelectionStore((state) => state.selectionsByGenre);
  const toggleSound = useSoundSelectionStore((state) => state.toggleSound);
  const previewSound = usePreviewSound();

  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  // ⭐ נשאר false עד שהמדידה-בפועל (useLayoutEffect למטה) מהדקת את המיקום לגבולות ה-viewport —
  // מונע "קפיצה" גלויה של הפאנל מהמיקום הגולמי למיקום המהודק.
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ⭐ "התאמת state לשינוי prop" (React docs pattern) — לא useEffect+setState (cascading
  // render, מסומן ע"י react-hooks/set-state-in-effect): משווים ל-genreId הקודם *בזמן render*
  // וסוגרים את הפאנל מיד אם הוא השתנה, בלי סבב-render נוסף.
  const [previousGenreId, setPreviousGenreId] = useState(genreId);
  if (genreId !== previousGenreId) {
    setPreviousGenreId(genreId);
    setIsOpen(false);
  }

  // סוגר את הפאנל בלחיצה מחוץ לו (גם מחוץ לכפתור וגם מחוץ לפאנל המפורטל) — ובגלילה/שינוי-
  // גודל, כי מיקום מחושב-פעם-אחת (fixed) לא עוקב אחרי גלילה כמו absolute רגיל היה עושה.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    // ⭐ 2026-08-24 (בדיקה חיה): גלילה *בתוך* גוף-הפאנל עצמו (overflow-y-auto, ראה הערת
    // הקובץ) לא אמורה לסגור אותו — רק גלילה *מחוצה* לו (הדף מאחוריו). capture:true תופס
    // גם גלילה בתוך containers פנימיים אחרים בדף, לא רק window עצמו.
    const handleScrollOrResize = (event: Event): void => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        panelRef.current.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const pack = packs.find((candidate) => candidate.id === genreId);
  const soundOptions = pack?.soundOptions;
  const rolesWithChoices = soundOptions
    ? (Object.entries(soundOptions) as [TrackRole, SoundOption[]][]).filter(
        ([, options]) => options.length > 1,
      )
    : [];

  const currentSelections = selectionsByGenre[genreId] ?? {};

  const toggleOpen = (): void => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setIsPositioned(false);
      setPanelPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen((open) => !open);
  };

  // ⭐ מדידה דו-שלבית — ראה הערת הקובץ. panelPosition (הגולמי) הוא ה-dependency בכוונה, לא
  // isPositioned — קריאת setPanelPosition בפנים מתייצבת אחרי ריצה שנייה לכל היותר (clamp
  // הוא אידמפוטנטי: תוצאה מהודקת נשארת מהודקת), לא לולאה אינסופית.
  useLayoutEffect(() => {
    if (!isOpen || !panelPosition || !panelRef.current) {
      return;
    }
    const rect = panelRef.current.getBoundingClientRect();
    const clampedLeft = Math.min(
      Math.max(VIEWPORT_MARGIN_PX, panelPosition.left),
      window.innerWidth - rect.width - VIEWPORT_MARGIN_PX,
    );
    const clampedTop = Math.min(
      panelPosition.top,
      window.innerHeight - rect.height - VIEWPORT_MARGIN_PX,
    );
    if (clampedLeft !== panelPosition.left || clampedTop !== panelPosition.top) {
      setPanelPosition({ left: clampedLeft, top: clampedTop });
      return;
    }
    setIsPositioned(true);
  }, [isOpen, panelPosition]);

  if (rolesWithChoices.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggleOpen}
      >
        Sound {isOpen ? '▲' : '▼'}
      </Button>
      {isOpen &&
        panelPosition &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 flex max-h-[70vh] w-max min-w-64 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border/60 bg-card shadow-xl"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              visibility: isPositioned ? 'visible' : 'hidden',
            }}
          >
            {/* ⭐ sticky, לא בתוך אזור-הגלילה — דרך-סגירה שתמיד נגישה, גם כשגוף הפאנל ארוך
                מספיק לגלול (ראה הערת הקובץ). */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="text-sm font-semibold">Sound</span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Close"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                ✕
              </Button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto p-3">
              {rolesWithChoices.map(([role, options]) => {
                // ⭐ 2026-08-25 (בחירת-צליל מרובה): בלי בחירה מפורשת, שום פיל לא מסומן כאן —
                // ברירת-המחדל בפועל (seededIndex, genreAdapter.ts) לא נחשפת ב-UI כ"נבחרה",
                // כדי לא לרמז על בחירה שהמשתמש לא עשה בעצמו. לוחצים → זו הבחירה הראשונה שלו.
                const selectedOptionIds = currentSelections[role] ?? [];
                const isMuted = selectedOptionIds.includes(MUTED_SOUND_OPTION_ID);

                return (
                  <div key={role} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {ROLE_LABEL[role]}
                    </span>
                    <div
                      className="flex flex-wrap items-center gap-1.5"
                      role="group"
                      aria-label={`${ROLE_LABEL[role]} sound`}
                    >
                      {options.map((option) => {
                        const isSelected = selectedOptionIds.includes(option.id);
                        return (
                          <Button
                            key={option.id}
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            className="shrink-0 rounded-full"
                            aria-pressed={isSelected}
                            onClick={() => {
                              toggleSound(genreId, role, option.id);
                              void previewSound(role, option.preset);
                            }}
                          >
                            {option.displayName.en}
                          </Button>
                        );
                      })}
                      {/* ⭐ לפי בקשה חיה: מכבה את הטראק לגמרי — לא עוד צליל, אלא היעדר-טראק.
                          "Mute" (לא "Off") בכוונה — כמה פריסטים כבר נקראים "...-Off" (למשל
                          Off-Bass, ראה trance.json) והתקבצות ליד "Off" גנרי הייתה מבלבלת. */}
                      <Button
                        type="button"
                        size="sm"
                        variant={isMuted ? 'secondary' : 'outline'}
                        className="shrink-0 rounded-full"
                        aria-pressed={isMuted}
                        onClick={() => {
                          toggleSound(genreId, role, MUTED_SOUND_OPTION_ID);
                        }}
                      >
                        Mute
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
