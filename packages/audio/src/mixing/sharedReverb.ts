/**
 * @file        sharedReverb.ts
 * @description ⭐ 2026-08-28 (שדרוג-תשתית, לפי בקשה חיה: "חירחורים בנייד עם כמה צלילים
 *              נבחרים"): אפיק-ריוורב **אחד משותף לכל היצירה** (לא Convolver נפרד לכל
 *              טראק) — עלות: קונבולוציה יקרה *פעם אחת* במקום *לכל טראק ששולח ריוורב*.
 * @author      Soundiform
 * @created     2026-08-28
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️⚠️ היסטוריה חשובה — למה זה קונבולוציה ולא ריוורב-אלגוריתמי (comb-filter feedback bank):
 * הניסיון הראשון בסבב הזה היה בדיוק כזה (8 ענפי comb-filter מוחלשים-בהדרגה, כמו Freeverb).
 * זה עבר את **כל** הבדיקות הקצרות (רינדור-PCM אמיתי, 3-8 שניות, "לא שקט"+"דועך"+"דטרמיניסטי"
 * וגם בדיקת-רב-טראקים ל-maxAbs≤1) — אבל בבדיקה חיה בנייד (שלולאת-הניגון האמיתית חוזרת
 * הרבה יותר זמן, `transport.loop=true` ב-browserRenderer.ts) נשמעה שריקה-הולכת-ומתחזקת.
 * הרצתי בדיקה ארוכה-הרבה-יותר (76 שניות, ~20 חזרות-לולאה) וגיליתי בפועל: הרמה נשארת יציבה
 * ~3 חזרות (~15 שניות) ואז **מתפוצצת וממשיכה לגדול לינארית בכל חזרה נוספת** (peak מ-0.17
 * ל-5.6+ תוך 60 שניות) — חוסר-יציבות אמיתי בלולאת-המשוב שלא נחשף בבדיקות-הקצרות בכלל, למרות
 * feedback-gain<1 ותיקון-Q מוקדם יותר (השורש-המדויק לא אותר לגמרי). קונבולוציה (הקובץ הזה)
 * **אין לה בכלל לולאת-משוב** — היא פילטר FIR קבוע-אורך, לא רקורסיבי — יציבה מתמטית מבנייה,
 * בלי קשר לכמה זמן מריצים אותה. זו הסיבה שהוחזרה, למרות שהיא יקרה יותר מ-comb-filters —
 * "בלי קליפינג/עיוות" (§4.3) גובר על "הכי-זול-אפשרי", במיוחד אחרי שנתפס בפועל.
 */

import type { InputNode } from 'tone';
import { createDeterministicReverb } from './deterministicReverb';

export interface SharedReverbBus {
  /** נקודת-החיבור לטראקים ששולחים ריוורב (reverbSendGain.connect(bus.input)). */
  readonly input: InputNode;
  dispose(): void;
}

/**
 * בונה אפיק-ריוורב משותף אחד (קונבולוציה דטרמיניסטית, ראה deterministicReverb.ts), מחובר
 * ל-destination (בדרך כלל אפיק המאסטר) — כל הטראקים ששולחים ריוורב מתחברים לאותו input
 * בודד; Web Audio מסכם חיבורים מרובים לצומת אחת אוטומטית, אז אין צורך במיקסר נפרד בכניסה.
 * @param reverbSeed  ערך יציב אחד ליצירה כולה (למשל `score.seed`) — לא per-track יותר,
 *                    כי יש רק Convolver אחד משותף עכשיו, לא אחד לכל טראק.
 */
export function createSharedReverbBus(
  decaySeconds: number,
  destination: InputNode,
  reverbSeed: string,
): SharedReverbBus {
  const reverb = createDeterministicReverb(reverbSeed, decaySeconds);
  reverb.connect(destination);

  return {
    input: reverb,
    dispose: () => {
      reverb.dispose();
    },
  };
}
