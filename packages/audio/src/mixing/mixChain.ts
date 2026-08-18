/**
 * @file        mixChain.ts
 * @description שרשרת מיקס לכל טראק — בנויה מ-Track.mixSettings (§4.6), לא מ-MixChainConfig
 *              של GenrePack (עדיין לא קיים בפועל — Sprint 5).
 * @author      Shape-to-Sound
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * מבנה השרשרת לכל טראק:
 *   instrument.output → panner ─────────────────────────→ outputGain → destination (master)
 *                              ├─ reverbSendGain → reverb ↗
 *                              └─ delaySendGain  → delay  ↗
 * reverb/delay נוצרים רק אם ה-send המתאים גדול מאפס — נמנע מיצירת Reverb (יקר, אסינכרוני)
 * לטראקים כמו בס שאין להם שום send.
 */

import { FeedbackDelay, Gain, Panner, Reverb } from 'tone';
import type { InputNode } from 'tone';
import type { MixSettings } from '@shape-sound/core';

const REVERB_DECAY_SECONDS = 2;
const DELAY_TIME = '8n';
const DELAY_FEEDBACK = 0.25;
/** מתחת לסף הזה, send נחשב "כבוי" — לא שווה להקים אפקט (עלות CPU/זמן ready של Reverb). */
const SEND_EPSILON = 0.001;

export interface MixChainHandle {
  /** נקודת החיבור עבור instrumentProvider.output.connect(mixChain.input). */
  readonly input: InputNode;
  dispose(): void;
}

/**
 * בונה שרשרת מיקס עבור טראק בודד ומחבר אותה ל-destination (בדרך כלל אפיק המאסטר).
 * אסינכרוני כי Tone.Reverb מייצר Impulse Response ברקע (`reverb.ready`).
 */
export async function buildMixChain(
  mixSettings: MixSettings,
  destination: InputNode,
): Promise<MixChainHandle> {
  const panner = new Panner(mixSettings.pan);
  const outputGain = new Gain(mixSettings.volume);
  panner.connect(outputGain);
  outputGain.connect(destination);

  const disposables: { dispose(): void }[] = [panner, outputGain];
  const readyPromises: Promise<void>[] = [];

  if (mixSettings.reverbSend > SEND_EPSILON) {
    const reverb = new Reverb(REVERB_DECAY_SECONDS);
    const reverbSendGain = new Gain(mixSettings.reverbSend);
    panner.connect(reverbSendGain);
    reverbSendGain.connect(reverb);
    reverb.connect(outputGain);
    disposables.push(reverb, reverbSendGain);
    readyPromises.push(reverb.ready);
  }

  if (mixSettings.delaySend > SEND_EPSILON) {
    const delay = new FeedbackDelay(DELAY_TIME, DELAY_FEEDBACK);
    const delaySendGain = new Gain(mixSettings.delaySend);
    panner.connect(delaySendGain);
    delaySendGain.connect(delay);
    delay.connect(outputGain);
    disposables.push(delay, delaySendGain);
  }

  await Promise.all(readyPromises);

  return {
    input: panner,
    dispose: () => {
      disposables.forEach((node) => {
        node.dispose();
      });
    },
  };
}
