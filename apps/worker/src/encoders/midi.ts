/**
 * @file        midi.ts
 * @description ייצוא MusicalScore לקובץ MIDI סטנדרטי (SMF format 1) — פיצ'ר Studio.
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ MusicalScore.Note.startTick/durationTicks כבר ב-TICKS_PER_BEAT=480 (packages/core
 * groove/quantize.ts) — בדיוק PPQ נפוץ בקבצי MIDI, כך שאין המרת יחידות: משתמשים ב-480
 * כ-division של קובץ ה-MIDI, וה-ticks עוברים 1:1.
 *
 * מבנה: MThd + track 0 (tempo/time-signature, "conductor") + track לכל Track ב-score
 * (role→ערוץ MIDI, program change ל-GM instrument סביר, note-on/note-off ממוינים).
 * ראה https://midi.org/standard-midi-files-specification.
 */

import type { MusicalScore, Note, Track, TrackRole } from '@soundiform/core';
import { TICKS_PER_BEAT } from '@soundiform/core';

const MIDI_DIVISION = TICKS_PER_BEAT;
const DRUM_CHANNEL = 9; // ⚠️ ערוץ 10 (0-based: 9) שמור מוסכם ל-percussion (General MIDI).

const ROLE_TO_CHANNEL: Record<TrackRole, number> = {
  bass: 0,
  lead: 1,
  pad: 2,
  skank: 3,
  drums: DRUM_CHANNEL,
};

/** תוכנית General MIDI סבירה לכל role (0-based program number). drums לא רלוונטי (ערוץ 10). */
const ROLE_TO_GM_PROGRAM: Record<TrackRole, number> = {
  bass: 33, // Electric Bass (finger)
  lead: 80, // Lead 1 (square)
  pad: 89, // Pad 2 (warm)
  skank: 27, // Electric Guitar (clean)
  drums: 0,
};

function encodeVariableLengthQuantity(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  return bytes;
}

class MidiTrackBuilder {
  private readonly bytes: number[] = [];
  private lastEventTick = 0;

  private pushEvent(tick: number, eventBytes: number[]): void {
    this.bytes.push(...encodeVariableLengthQuantity(tick - this.lastEventTick), ...eventBytes);
    this.lastEventTick = tick;
  }

  trackName(name: string): this {
    const nameBytes = Array.from(Buffer.from(name, 'ascii'));
    this.pushEvent(0, [
      0xff,
      0x03,
      ...encodeVariableLengthQuantity(nameBytes.length),
      ...nameBytes,
    ]);
    return this;
  }

  tempo(bpm: number): this {
    const microsecondsPerQuarter = Math.round(60_000_000 / bpm);
    this.pushEvent(0, [
      0xff,
      0x51,
      0x03,
      (microsecondsPerQuarter >> 16) & 0xff,
      (microsecondsPerQuarter >> 8) & 0xff,
      microsecondsPerQuarter & 0xff,
    ]);
    return this;
  }

  timeSignature(numerator: number, denominator: number): this {
    const denominatorPower = Math.round(Math.log2(denominator));
    this.pushEvent(0, [0xff, 0x58, 0x04, numerator, denominatorPower, 24, 8]);
    return this;
  }

  programChange(tick: number, channel: number, program: number): this {
    this.pushEvent(tick, [0xc0 | channel, program]);
    return this;
  }

  noteOn(tick: number, channel: number, pitch: number, velocity: number): this {
    this.pushEvent(tick, [0x90 | channel, pitch & 0x7f, velocity & 0x7f]);
    return this;
  }

  noteOff(tick: number, channel: number, pitch: number): this {
    this.pushEvent(tick, [0x80 | channel, pitch & 0x7f, 0]);
    return this;
  }

  endOfTrack(tick: number): this {
    this.pushEvent(tick, [0xff, 0x2f, 0x00]);
    return this;
  }

  build(): Buffer {
    const header = Buffer.from('MTrk', 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(this.bytes.length, 0);
    return Buffer.concat([header, length, Buffer.from(this.bytes)]);
  }
}

interface TimedMidiEvent {
  tick: number;
  /** Note-off נשמר לפני note-on באותו tick, כדי לא לחתוך תו חדש שמתחיל בדיוק כשקודמו נגמר. */
  kind: 'off' | 'on';
  pitch: number;
  velocity: number;
}

function noteToEvents(note: Note): TimedMidiEvent[] {
  const velocityMidi = Math.max(1, Math.min(127, Math.round(note.velocity * 127)));
  return [
    { tick: note.startTick, kind: 'on', pitch: note.pitch, velocity: velocityMidi },
    { tick: note.startTick + note.durationTicks, kind: 'off', pitch: note.pitch, velocity: 0 },
  ];
}

function buildInstrumentTrack(track: Track): Buffer {
  const channel = ROLE_TO_CHANNEL[track.role];
  const builder = new MidiTrackBuilder();
  builder.trackName(track.role).programChange(0, channel, ROLE_TO_GM_PROGRAM[track.role]);

  const events = track.notes
    .flatMap(noteToEvents)
    .sort((a, b) => a.tick - b.tick || (a.kind === 'off' ? -1 : 1));

  let lastTick = 0;
  for (const event of events) {
    if (event.kind === 'on') {
      builder.noteOn(event.tick, channel, event.pitch, event.velocity);
    } else {
      builder.noteOff(event.tick, channel, event.pitch);
    }
    lastTick = event.tick;
  }

  return builder.endOfTrack(lastTick).build();
}

function buildConductorTrack(score: MusicalScore): Buffer {
  const [numerator, denominator] = score.timeSignature;
  return new MidiTrackBuilder()
    .trackName('conductor')
    .tempo(score.tempo)
    .timeSignature(numerator, denominator)
    .endOfTrack(0)
    .build();
}

/** מקודד MusicalScore ל-Standard MIDI File (format 1) — track מוליך + track לכל Track. */
export function encodeMidi(score: MusicalScore): Buffer {
  const trackChunks = [buildConductorTrack(score), ...score.tracks.map(buildInstrumentTrack)];

  const headerChunk = Buffer.alloc(14);
  headerChunk.write('MThd', 0, 'ascii');
  headerChunk.writeUInt32BE(6, 4); // אורך ה-header chunk (קבוע, 6 בייטים)
  headerChunk.writeUInt16BE(1, 8); // format 1: מספר tracks סימולטניים
  headerChunk.writeUInt16BE(trackChunks.length, 10);
  headerChunk.writeUInt16BE(MIDI_DIVISION, 12);

  return Buffer.concat([headerChunk, ...trackChunks]);
}
