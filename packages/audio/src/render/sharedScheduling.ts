/**
 * @file        sharedScheduling.ts
 * @description ⭐⭐ הלוגיקה המשותפת ל-browserRenderer.ts ו-serverRenderer.ts — בונה
 *              SynthProvider+mixChain+Part לכל טראק על ה-Tone.js context הפעיל, יהיה אשר יהיה.
 * @author      Soundiform
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ זה בפועל מה שמבטיח "פריוויו ≈ פלט סופי" (§11 Sprint 6) — לא כוונה טובה, אלא מנגנון:
 * שני ה-renderers קוראים לאותן הפונקציות בדיוק. ההבדל היחיד המותר ביניהם הוא איזה
 * Tone.js context פעיל ברגע הקריאה (Tone.setContext) — קובעים את זה *לפני* קריאה לכאן,
 * לא כאן. הפונקציות כאן לא יודעות אם מדובר ב-AudioContext אמיתי או OfflineAudioContext.
 */

import { connect, FeedbackDelay, Gain, Part } from 'tone';
import type { InputNode } from 'tone';
import type { MusicalScore, Note, Track, TrackRole } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';
import {
  DEFAULT_SYNTH_PRESET,
  SynthProvider,
  type SynthPresetConfig,
} from '../providers/SynthProvider';
import { SamplerProvider, type SamplerPresetConfig } from '../providers/SamplerProvider';
import { DrumKitProvider, type DrumKitPresetConfig } from '../providers/DrumKitProvider';
import type { InstrumentProvider } from '../providers/InstrumentProvider';
import {
  buildMixChain,
  DEFAULT_MIX_CHARACTER,
  SEND_EPSILON,
  type MixCharacterConfig,
  type MixChainHandle,
} from '../mixing/mixChain';
import { createSharedReverbBus, type SharedReverbBus } from '../mixing/sharedReverb';
import {
  createSidechainDuck,
  DEFAULT_DUCK_DEPTH,
  DEFAULT_DUCK_RELEASE_SECONDS,
  type SidechainDuck,
} from '../mixing/sidechain';
import type { TrackEqConfig } from '../mixing/eq';
import { ticksToSeconds } from '../internal/audioUtils';

/**
 * מה ש-renderer צריך מסגנון (GenrePack) בלי לתלות ב-@soundiform/genres — §3.
 * apps/web בונה את זה מ-GenrePack.synthMap/mixChain; ברירת המחדל היא באחריות הקורא.
 */
export interface GenreAudioConfig {
  synthPresets: Partial<Record<TrackRole, SynthPresetConfig>>;
  /**
   * ⭐ 2026-08-30: כלים דגומים לתפקיד — מנוגנים **לצד** הסינת', לא במקומו, כך שמשתמש יכול
   * לערבב פסנתר אמיתי עם פאד סינתטי באותו תפקיד. ⚠️ הדגימות חייבות להיות מפוענחות מראש
   * (preloadSampledInstrument) לפני הרינדור — ראה providers/sampleLoader.ts.
   */
  samplerPresets?: Partial<Record<TrackRole, SamplerPresetConfig[]>>;
  /**
   * ⭐ 2026-08-31: ערכת תופים לתפקיד — אחת לכל היותר. ⚠️ בניגוד ל-samplerPresets, ערכה
   * **מחליפה** את הסינת' של התפקיד ולא מתנגנת לצידו: שתי ערכות-מקבילות היו מכפילות כל מכה.
   */
  drumKitPresets?: Partial<Record<TrackRole, DrumKitPresetConfig>>;
  mixCharacter: MixCharacterConfig;
  /** ⭐ 2026-08-22: trance/house — ראה sidechain.ts. undefined/false = בלי pumping. */
  sidechainEnabled?: boolean;
  /** ⭐ 2026-08-24 (Area 2): כיוונון סיידצ'יין לפי-סגנון — undefined נופל לברירות המחדל. */
  sidechainDepth?: number;
  sidechainReleaseSeconds?: number;
  /** ⭐ 2026-08-24 (Area 2): EQ תלת-פס אופציונלי לפי-טראק — ראה mixing/eq.ts. */
  trackEq?: Partial<Record<TrackRole, TrackEqConfig>>;
  /**
   * ⭐ 2026-08-24 (Area 1, לפי בקשה חיה): תפקידים שהמשתמש בחר "לכבות" לגמרי (SoundSelector.tsx's
   * "Off" pill) — לא רק צליל אחר, אלא בלי טראק בכלל. מטופל ב-createAllTrackRuntimes (מסנן
   * לפני בניית provider/mixChain/part — לא מבזבז קול על טראק שממילא ב-0 גיין).
   */
  mutedRoles?: readonly TrackRole[];
}

export const DEFAULT_AUDIO_CONFIG: GenreAudioConfig = {
  synthPresets: {},
  mixCharacter: DEFAULT_MIX_CHARACTER,
};

export interface ScheduledNoteEvent {
  time: number;
  note: Note;
}

export interface TrackRuntime {
  /**
   * ⭐ 2026-08-30: **רשימה** ולא provider יחיד — טראק יכול לנגן סינת' וכלים דגומים יחד.
   * ⚠️ החוק של §4.7 נשמר: הקוד כאן לא יודע מי מהם מה — כולם `InstrumentProvider`, וכולם
   * מקבלים את אותו playNote מאותו Part.
   */
  providers: InstrumentProvider[];
  mixChain: MixChainHandle;
  part: Part<ScheduledNoteEvent>;
}

/**
 * תקרה לתוספת-זנב — מונעת padding בלתי-סביר גם אם קונפיג עתידי יגדיר reverb ארוך מאוד.
 *
 * ⚠️ 2026-09-01: הוקטן מ-8 ל-3 לפי בקשה חיה ("שהסיומת תהיה ב-2-3 השניות האחרונות").
 * הזנב הוא **ריפוד** בסוף היצירה שבו כבר לא מתנגן שום תו — רק דעיכה. סינמטי קיבל 5 שניות
 * כאלה ו-צ'יל 4, ועם הסורק שמגיע עכשיו לסוף יחד עם התו האחרון (ראה
 * computeMusicalDurationSeconds) זה היה משאיר את התמונה קפואה 5 שניות.
 * ⚠️ זה **לא** משנה את הריוורב עצמו — `reverbDecaySeconds` ממשיך להיקרא כמו שהוא ע"י
 * createSharedReverbBus למטה. רק אורך הריפוד נחתך, ובנקודה הזו הדעיכה כבר מתחת ל--30dB.
 */
const MAX_RELEASE_TAIL_SECONDS = 3;

/**
 * ⭐ 2026-09-01: האורך ה**מוזיקלי** — עד התו האחרון, בלי זנב-הריוורב שמרופד אחריו.
 *
 * ⚠️ **זה מה שהסורק חייב להימדד מולו, לא computeDurationSeconds.** דווח בבדיקה חיה:
 * "המוזיקה מושתקת לפני שהסורק מגיע לסוף הלוח". הסיבה הייתה שקו-הסריקה מיפה את מיקומו
 * לאורך האודיו **כולל הזנב**, בעוד שכל התווים חיים בחלק הנומינלי בלבד — כלומר הסורק המשיך
 * לנוע על פני שקט. בסינמטי זה היה 27% מהמסע על יצירה קצרה.
 *
 * ⚠️ הפונקציה הזו קיימת כדי ששלושת מקומות-הציור (הסטודיו החי, הווידאו בדפדפן, והווידאו
 * בוורקר) ימפו **בדיוק אותו דבר**. שלושתם חישבו קודם התקדמות בנפרד; מקור-אמת אחד הוא מה
 * שמונע "פריוויו ≠ פלט".
 */
export function computeMusicalDurationSeconds(score: MusicalScore): number {
  const [beatsPerBar] = score.timeSignature;
  const ticksPerBar = TICKS_PER_BEAT * beatsPerBar;
  return ticksToSeconds(score.durationBars * ticksPerBar, score.tempo);
}

/**
 * מיקום הסורק (0–1) לזמן נתון — מהודק ל-1 כדי שהזנב לא ידחוף אותו מעבר לקצה הלוח.
 */
export function scannerProgress(elapsedSeconds: number, score: MusicalScore): number {
  const musicalSeconds = computeMusicalDurationSeconds(score);
  if (musicalSeconds <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, elapsedSeconds / musicalSeconds));
}

/**
 * ⭐ 2026-08-22 — באג אמיתי שנתפס ע"י בדיקה חיה: המשך היה מחושב *רק* מ-durationBars,
 * בלי לתת זמן לזנב-ריוורב/release להישמע — outro (Item 4) עם ריוורב ארוך (chill 4s,
 * cinematic 5s) היה נחתך אמצע-דעיכה, ממש ההיפך מ"outro". audioConfig?.mixCharacter.
 * reverbDecaySeconds (אם סופק) קובע תוספת-זנב אמיתית, לא ניחוש קבוע — genre-aware.
 */
export function computeDurationSeconds(
  score: MusicalScore,
  audioConfig?: GenreAudioConfig,
): number {
  const nominalSeconds = computeMusicalDurationSeconds(score);
  const releaseTailSeconds = Math.min(
    MAX_RELEASE_TAIL_SECONDS,
    audioConfig?.mixCharacter.reverbDecaySeconds ?? 0,
  );
  return nominalSeconds + releaseTailSeconds;
}

export async function createTrackRuntime(
  track: Track,
  tempoBpm: number,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
  reverbBus: InputNode | undefined,
  delayBus: InputNode | undefined,
  sidechainDuck?: Gain,
): Promise<TrackRuntime> {
  const samplerPresets = audioConfig.samplerPresets?.[track.role] ?? [];
  const drumKitPreset = audioConfig.drumKitPresets?.[track.role];
  const synthPreset = audioConfig.synthPresets[track.role];

  // ⚠️ ברירת המחדל (DEFAULT_SYNTH_PRESET) מוחלת רק כשאין **שום** כלי לתפקיד. כשנבחרו רק
  // כלים דגומים, הוספת סינת' ברירת-מחדל הייתה משמיעה צליל שהמשתמש לא ביקש.
  const providers: InstrumentProvider[] = [];
  if (synthPreset || (samplerPresets.length === 0 && !drumKitPreset)) {
    providers.push(new SynthProvider(track.role, tempoBpm, synthPreset ?? DEFAULT_SYNTH_PRESET));
  }
  for (const samplerPreset of samplerPresets) {
    providers.push(new SamplerProvider(track.role, tempoBpm, samplerPreset));
  }
  if (drumKitPreset) {
    providers.push(new DrumKitProvider(track.role, drumKitPreset));
  }

  const mixChain = await buildMixChain(
    track.mixSettings,
    destination,
    reverbBus,
    delayBus,
    sidechainDuck,
    audioConfig.trackEq?.[track.role],
  );

  for (const provider of providers) {
    await provider.load(track.instrumentId);
    // connect() (הפונקציה, לא המתודה) מטפלת נכון באיחוד OutputNode/InputNode של Tone.js —
    // .connect() כמתודה על טיפוס OutputNode לא נבחר תמיד ל-overload הנכון (ראה DECISIONS.md).
    connect(provider.output, mixChain.input);
  }

  const events: ScheduledNoteEvent[] = track.notes.map((note) => ({
    time: ticksToSeconds(note.startTick, tempoBpm),
    note,
  }));
  const part = new Part<ScheduledNoteEvent>((time, event) => {
    // ⚠️ אותו תו נשלח לכל ה-providers של הטראק — זה מה שגורם לסינת' ולדגימה להישמע יחד.
    for (const provider of providers) {
      provider.playNote(event.note, time);
    }
  }, events);
  part.start(0);

  return { providers, mixChain, part };
}

export interface TrackRuntimeSet {
  trackRuntimes: TrackRuntime[];
  /** משחרר גם את ה-sidechain duck המשותף (אם נבנה) בנוסף לכל track runtime. פונקציה-כערך
   * (לא method-shorthand) בכוונה — הקוראים תמיד מפרקים ({ disposeAll }), ו-method-shorthand
   * מפעיל @typescript-eslint/unbound-method על destructuring כזה. */
  disposeAll: () => void;
}

/** אפיק-דיליי משותף מינימלי — Tone.FeedbackDelay יחיד משמש כ"input" גם: Web Audio מסכם
 * חיבורים מרובים לצומת אחת אוטומטית, אז כמה delaySendGain יכולים להתחבר ישירות אליו. */
function createSharedDelayBus(
  character: MixCharacterConfig,
  destination: InputNode,
): { input: InputNode; dispose(): void } {
  const delay = new FeedbackDelay(character.delayTime, character.delayFeedback);
  delay.connect(destination);
  return { input: delay, dispose: () => delay.dispose() };
}

/**
 * יוצר runtime (provider+mixChain+part מתוזמן) לכל טראק ב-score, על ה-context הפעיל.
 * ⭐ 2026-08-22: כשaudioConfig.sidechainEnabled ויש טראק 'drums' — בונה gain node משותף אחד
 * (ראה sidechain.ts) מתוזמן לפי פגיעות התופים, ומחבר אותו לכל טראק *חוץ* מה-drums עצמו
 * (קיק לא דוחק את עצמו).
 * ⭐ 2026-08-24: mutedRoles מסונן *לפני* בניית ה-runtimes (לא audioConfig.synthPresets[role]
 * ל-0-גיין) — טראק מושתק לא בונה provider/mixChain/part בכלל. ⚠️ עיתוי-הסיידצ'יין ממשיך
 * להתבסס על drumsTrack המקורי מה-score (לא מהרשימה המסוננת) — גם אם התופים עצמם מושתקים,
 * שאר הטראקים עדיין "פועמים" באותו הקצב שהקיק היה יוצר, לא רק כשהתופים גם מנוגנים בפועל.
 * ⭐ 2026-08-28 (שדרוג-תשתית): אפיק-ריוורב/דיליי **משותף אחד ליצירה כולה** (לא פר-טראק) —
 * נבנה רק אם יש בכלל טראק פעיל ששולח משהו אליו (אחרת בזבוז-CPU נטו על אפקט שאף אחד לא
 * שומע). ראה mixChain.ts/sharedReverb.ts לפירוט המלא.
 */
/**
 * ⚠️ **הסיידצ'יין נורה על הקיק בלבד, לא על כל מכה.** עד סבב ערכת-התופים טראק ה-drums היה
 * דליל ו"פגיעה" הייתה בעיקר קיק, ולכן "כל התווים" היה קירוב סביר. מאז יש בטראק גם היי-האט,
 * סנר, מחיאה, טום וקראש — 8-15 מכות בבר — וכל אחת מהן יצרה דחיקה. התוצאה: הדחיקה **לא
 * מספיקה להשתחרר בין מכות**, הפאמפינג מתמרח לרעש רציף, והקיק מאבד בדיוק את הבליטה שהוא
 * אמור לקבל. זו הסיבה שהתופים נשמעו חלשים דווקא בטראנס ובהאוס.
 *
 * ⚠️ נפילה-לאחור לכל התווים כשאין `drumPiece` בכלל: ציונים שנשמרו לפני 2026-08-31
 * (renders.score) חייבים להמשיך להישמע בדיוק כמו שנשמרו.
 */
export function sidechainTriggerNotes(drumNotes: readonly Note[]): readonly Note[] {
  const kicks = drumNotes.filter((note) => note.drumPiece === 'kick');
  if (kicks.length > 0) {
    return kicks;
  }
  return drumNotes.some((note) => note.drumPiece !== undefined) ? [] : drumNotes;
}

export async function createAllTrackRuntimes(
  score: MusicalScore,
  destination: InputNode,
  audioConfig: GenreAudioConfig,
): Promise<TrackRuntimeSet> {
  const drumsTrack = score.tracks.find((track) => track.role === 'drums');
  const duckTriggerNotes = drumsTrack ? sidechainTriggerNotes(drumsTrack.notes) : [];
  const sidechainDuck: SidechainDuck | null =
    audioConfig.sidechainEnabled && duckTriggerNotes.length > 0
      ? createSidechainDuck(
          duckTriggerNotes,
          score.tempo,
          audioConfig.sidechainDepth ?? DEFAULT_DUCK_DEPTH,
          audioConfig.sidechainReleaseSeconds ?? DEFAULT_DUCK_RELEASE_SECONDS,
        )
      : null;

  const mutedRoles = new Set(audioConfig.mutedRoles ?? []);
  const activeTracks = score.tracks.filter((track) => !mutedRoles.has(track.role));

  const reverbBus: SharedReverbBus | null = activeTracks.some(
    (track) => track.mixSettings.reverbSend > SEND_EPSILON,
  )
    ? createSharedReverbBus(audioConfig.mixCharacter.reverbDecaySeconds, destination, score.seed)
    : null;
  const delayBus = activeTracks.some((track) => track.mixSettings.delaySend > SEND_EPSILON)
    ? createSharedDelayBus(audioConfig.mixCharacter, destination)
    : null;

  const trackRuntimes = await Promise.all(
    activeTracks.map((track) =>
      createTrackRuntime(
        track,
        score.tempo,
        destination,
        audioConfig,
        reverbBus?.input,
        delayBus?.input,
        track.role === 'drums' ? undefined : (sidechainDuck?.gain ?? undefined),
      ),
    ),
  );

  return {
    trackRuntimes,
    disposeAll: () => {
      disposeTrackRuntimes(trackRuntimes);
      sidechainDuck?.dispose();
      reverbBus?.dispose();
      delayBus?.dispose();
    },
  };
}

export function disposeTrackRuntimes(trackRuntimes: readonly TrackRuntime[]): void {
  trackRuntimes.forEach(({ providers, mixChain, part }) => {
    part.dispose();
    for (const provider of providers) {
      provider.dispose();
    }
    mixChain.dispose();
  });
}
