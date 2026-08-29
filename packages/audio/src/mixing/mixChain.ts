/**
 * @file        mixChain.ts
 * @description שרשרת מיקס לכל טראק — send-amounts מ-Track.mixSettings (§4.6, כמה reverb/delay).
 *              אופי-האפקטים עצמם (ריוורב/דיליי) חי באפיקים משותפים חד-פעמיים ל-כל היצירה
 *              (createSharedReverbBus, sharedScheduling.ts) — לא כאן ולא פר-טראק.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⭐ Sprint 5: MixCharacterConfig מגיע מ-GenrePack.mixChain (§5.1) — packages/audio לא יכול
 * לייבא GenrePack ישירות (§3: audio → core, shared בלבד), אז apps/web ממיר. בלי קונפיג
 * מפורש נופלים ל-DEFAULT_MIX_CHARACTER.
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * מבנה השרשרת לכל טראק:
 *   instrument.output → panner → [eq?] ──────────────────────────→ outputGain → destination (master)
 *                                      ├─ reverbSendGain → sharedReverbBus (משותף לכל היצירה)
 *                                      └─ delaySendGain  → sharedDelayBus  (משותף לכל היצירה)
 * ⭐ 2026-08-28 (שדרוג-תשתית, לפי בקשה חיה: "חירחורים בנייד עם כמה צלילים נבחרים"): לפני
 * הסבב הזה, כל טראק בנה Convolver+FeedbackDelay **משלו** — יקר במיוחד (קונבולוציה, אחת
 * הפעולות הכבדות ביותר ב-Web Audio) כשכמה טראקים שולחים ריוורב בו-זמנית (לדוגמה lead+pad
 * בטראנס/האוס). עכשיו כל טראק רק שולח (reverbSendGain/delaySendGain) לאפיק **משותף אחד**
 * שנבנה פעם אחת לכל היצירה (sharedScheduling.ts) — לא בונה פה שום אפקט בעצמו. ה-wet-signal
 * חוזר ישירות ל-destination (המאסטר), לא דרך outputGain של הטראק הספציפי — בדיוק כמו send
 * אמיתי בקונסולת-מיקס (reverb/delay return הוא תמיד מרכזי, לא ממוקם-פאן פר-מקור).
 *
 * ⭐ 2026-08-24 (Area 2): ה-EQ (אם מוגדר) יושב *לפני* ה-sends — דינמיקה/גוון תחילה, אפקטי-מרחב
 * אחר-כך, כמו בשרשרת מיקס אמיתית — כך שהריוורב/דיליי משדרים את הסיגנל *אחרי* עיצוב-הטון.
 *
 * ⭐ 2026-08-22: sidechainDuck אופציונלי (ראה sidechain.ts) — כשמוגדר, מוכנס אחרי ה-EQ (אם יש)
 * ולפני outputGain (המסלול היבש בלבד; reverb/delay wet ממשיכים ישר לאפיק המשותף, לא נדחקים —
 * פישוט מכוון, sidechain אמיתי בהפקה מקצועית גם משאיר את ה-tail קצת פחות דחוק).
 */

import { Gain, Panner } from 'tone';
import type { InputNode } from 'tone';
import type { MixSettings } from '@soundiform/core';
import { createTrackEq, type TrackEqConfig } from './eq';

export interface MixCharacterConfig {
  reverbDecaySeconds: number;
  /** בתחביר זמן של Tone.js, למשל "8n". */
  delayTime: string;
  delayFeedback: number;
}

export const DEFAULT_MIX_CHARACTER: MixCharacterConfig = {
  reverbDecaySeconds: 2,
  delayTime: '8n',
  delayFeedback: 0.25,
};

/**
 * מתחת לסף הזה, send נחשב "כבוי" — לא שווה לבנות reverbSendGain/delaySendGain בכלל.
 * מיוצא: sharedScheduling.ts משתמש באותו סף כדי להחליט אם בכלל שווה לבנות את אפיק-
 * הריוורב/דיליי המשותף ליצירה (createSharedReverbBus/FeedbackDelay) — אין טעם לבנות
 * אפיק-אפקט שאף טראק לא באמת שולח אליו משהו.
 */
export const SEND_EPSILON = 0.001;

export interface MixChainHandle {
  /** נקודת החיבור עבור instrumentProvider.output.connect(mixChain.input). */
  readonly input: InputNode;
  dispose(): void;
}

/**
 * בונה שרשרת מיקס עבור טראק בודד ומחבר אותה ל-destination (בדרך כלל אפיק המאסטר).
 * @param reverbBus  אפיק-הריוורב המשותף ליצירה כולה (createSharedReverbBus) — undefined
 *                   אם אף טראק ביצירה לא שולח ריוורב (לא נבנה בכלל, ראה sharedScheduling.ts).
 * @param delayBus   אותו רעיון, לדיליי (Tone.FeedbackDelay משותף אחד).
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Promise<MixChainHandle> נשמר כחלק מהחוזה הציבורי (קוראים תמיד עם await); אין await אמיתי כרגע.
export async function buildMixChain(
  mixSettings: MixSettings,
  destination: InputNode,
  reverbBus: InputNode | undefined,
  delayBus: InputNode | undefined,
  sidechainDuck?: Gain,
  trackEq?: TrackEqConfig,
): Promise<MixChainHandle> {
  const panner = new Panner(mixSettings.pan);
  const outputGain = new Gain(mixSettings.volume);
  const disposables: { dispose(): void }[] = [panner, outputGain];

  // ⭐ 2026-08-24 (Area 2): postToneNode = הצומת האחרון לפני sends/duck/output — ה-EQ (אם
  // מוגדר) או הפאנר עצמו. כל מה שמשדר/מתחבר-הלאה עושה את זה מ-postToneNode, לא מ-panner
  // ישירות, כדי שה-EQ יחול על הסיגנל היבש *וגם* על מה שנשלח ל-reverb/delay.
  let postEqNode: InputNode = panner;
  if (trackEq) {
    const eq = createTrackEq(trackEq);
    panner.connect(eq);
    postEqNode = eq;
    disposables.push(eq);
  }

  if (sidechainDuck) {
    postEqNode.connect(sidechainDuck);
    sidechainDuck.connect(outputGain);
  } else {
    postEqNode.connect(outputGain);
  }
  outputGain.connect(destination);

  if (reverbBus && mixSettings.reverbSend > SEND_EPSILON) {
    const reverbSendGain = new Gain(mixSettings.reverbSend);
    postEqNode.connect(reverbSendGain);
    reverbSendGain.connect(reverbBus);
    disposables.push(reverbSendGain);
  }

  if (delayBus && mixSettings.delaySend > SEND_EPSILON) {
    const delaySendGain = new Gain(mixSettings.delaySend);
    postEqNode.connect(delaySendGain);
    delaySendGain.connect(delayBus);
    disposables.push(delaySendGain);
  }

  return {
    input: panner,
    dispose: () => {
      disposables.forEach((node) => {
        node.dispose();
      });
    },
  };
}
