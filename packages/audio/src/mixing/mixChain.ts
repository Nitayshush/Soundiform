/**
 * @file        mixChain.ts
 * @description שרשרת מיקס לכל טראק — send-amounts מ-Track.mixSettings (§4.6, כמה reverb/delay),
 *              אופי האפקט (משך ריוורב, זמן/פידבק דיליי) מ-MixCharacterConfig של הסגנון.
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
 *   instrument.output → panner → [eq?] ──────────────────→ outputGain → destination (master)
 *                                      ├─ reverbSendGain → reverb ↗
 *                                      └─ delaySendGain  → delay  ↗
 * reverb/delay נוצרים רק אם ה-send המתאים גדול מאפס — נמנע מיצירת reverb (יקר) לטראקים
 * כמו בס שאין להם שום send. ⭐ 2026-08-24 (Area 2): ה-EQ (אם מוגדר) יושב *לפני* ה-sends —
 * דינמיקה/גוון תחילה, אפקטי-מרחב אחר-כך, כמו בשרשרת מיקס אמיתית — כך שהריוורב/דיליי
 * משדרים את הסיגנל *אחרי* עיצוב-הטון, לא את הגרסה הגולמית.
 *
 * ⭐ reverbSeed: קובע את ה-impulse response של הריוורב הדטרמיניסטי (ראה deterministicReverb.ts) —
 * חובה להעביר ערך יציב לכל טראק (למשל `${score.seed}:${track.role}`), אחרת נשבר §1.
 *
 * ⭐ 2026-08-22: sidechainDuck אופציונלי (ראה sidechain.ts) — כשמוגדר, מוכנס אחרי ה-EQ (אם יש)
 * ולפני outputGain (המסלול היבש בלבד; reverb/delay wet ממשיכים ישר ל-outputGain, לא נדחקים —
 * פישוט מכוון, sidechain אמיתי בהפקה מקצועית גם משאיר את ה-tail קצת פחות דחוק).
 */

import { FeedbackDelay, Gain, Panner } from 'tone';
import type { InputNode } from 'tone';
import type { MixSettings } from '@soundiform/core';
import { createDeterministicReverb } from './deterministicReverb';
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

/** מתחת לסף הזה, send נחשב "כבוי" — לא שווה להקים אפקט (עלות CPU של בניית ה-impulse response). */
const SEND_EPSILON = 0.001;

export interface MixChainHandle {
  /** נקודת החיבור עבור instrumentProvider.output.connect(mixChain.input). */
  readonly input: InputNode;
  dispose(): void;
}

/**
 * בונה שרשרת מיקס עבור טראק בודד ומחבר אותה ל-destination (בדרך כלל אפיק המאסטר).
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Promise<MixChainHandle> נשמר כחלק מהחוזה הציבורי (קוראים תמיד עם await); אין await אמיתי כרגע כש-reverb/delay נבנים סינכרונית.
export async function buildMixChain(
  mixSettings: MixSettings,
  destination: InputNode,
  reverbSeed: string,
  character: MixCharacterConfig = DEFAULT_MIX_CHARACTER,
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

  if (mixSettings.reverbSend > SEND_EPSILON) {
    const reverb = createDeterministicReverb(reverbSeed, character.reverbDecaySeconds);
    const reverbSendGain = new Gain(mixSettings.reverbSend);
    postEqNode.connect(reverbSendGain);
    reverbSendGain.connect(reverb);
    reverb.connect(outputGain);
    disposables.push(reverb, reverbSendGain);
  }

  if (mixSettings.delaySend > SEND_EPSILON) {
    const delay = new FeedbackDelay(character.delayTime, character.delayFeedback);
    const delaySendGain = new Gain(mixSettings.delaySend);
    postEqNode.connect(delaySendGain);
    delaySendGain.connect(delay);
    delay.connect(outputGain);
    disposables.push(delay, delaySendGain);
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
