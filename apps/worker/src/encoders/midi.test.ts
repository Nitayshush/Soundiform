/**
 * @file        midi.test.ts
 * @description בדיקת מבנה בייטים אמיתי של קובץ MIDI (SMF) מקודד — פענוח ידני של ה-VLQ/events,
 *              לא רק בדיקת אורך. לא מוק.
 * @author      Shape-to-Sound
 * @created     2026-08-18
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { describe, expect, it } from 'vitest';
import type { MusicalScore } from '@shape-sound/core';
import { encodeMidi } from './midi';

const TEST_SCORE: MusicalScore = {
  version: '1.0.0',
  seed: 'midi-test-seed',
  tempo: 120,
  timeSignature: [4, 4],
  key: { root: 0, mode: 'aeolian' },
  genreId: 'test',
  durationBars: 1,
  tracks: [
    {
      role: 'bass',
      instrumentId: 'default-bass',
      notes: [
        { startTick: 0, durationTicks: 480, pitch: 36, velocity: 0.7, articulation: 'staccato' },
        { startTick: 480, durationTicks: 480, pitch: 38, velocity: 0.5 },
      ],
      mixSettings: { volume: 0.8, pan: 0, reverbSend: 0, delaySend: 0 },
    },
  ],
  sections: [],
  metadata: { avgNoteDensity: 0, dominantMode: 'aeolian', rootFrequencyHz: 65.4 },
};

interface ParsedNoteEvent {
  tick: number;
  type: 'on' | 'off';
  channel: number;
  pitch: number;
  velocity: number;
}

function readVariableLengthQuantity(
  bytes: Buffer,
  offset: number,
): { value: number; nextOffset: number } {
  let value = 0;
  let position = offset;
  for (;;) {
    const byte = bytes[position];
    if (byte === undefined) {
      throw new Error('VLQ לא תקין: הגענו לסוף ה-buffer');
    }
    value = (value << 7) | (byte & 0x7f);
    position += 1;
    if ((byte & 0x80) === 0) {
      break;
    }
  }
  return { value, nextOffset: position };
}

/** מפענח track chunk (MTrk) יחיד — מחזיר רק note-on/note-off (מתעלם ממטא-אירועים). */
function parseTrackNoteEvents(track: Buffer): ParsedNoteEvent[] {
  const events: ParsedNoteEvent[] = [];
  let offset = 0;
  let absoluteTick = 0;

  while (offset < track.length) {
    const delta = readVariableLengthQuantity(track, offset);
    absoluteTick += delta.value;
    offset = delta.nextOffset;

    const statusByte = track[offset];
    if (statusByte === undefined) {
      break;
    }

    if (statusByte === 0xff) {
      // meta event: 0xFF, type, length, data...
      const length = track[offset + 2];
      if (length === undefined) {
        throw new Error('meta event חתוך');
      }
      offset += 3 + length;
      continue;
    }

    const eventType = statusByte & 0xf0;
    const channel = statusByte & 0x0f;
    // ⚠️ Program Change (0xC0) ו-Channel Aftertouch (0xD0) הם הודעות 2-בייט (status + דאטה
    // אחת) — לא 3, בניגוד ל-Note On/Off. חייבים לצרוך את מספר הבייטים הנכון לכל סוג הודעה.
    const isTwoByteMessage = eventType === 0xc0 || eventType === 0xd0;
    const dataByte1 = track[offset + 1] ?? 0;
    const dataByte2 = isTwoByteMessage ? 0 : (track[offset + 2] ?? 0);

    if (eventType === 0x90 && dataByte2 > 0) {
      events.push({
        tick: absoluteTick,
        type: 'on',
        channel,
        pitch: dataByte1,
        velocity: dataByte2,
      });
    } else if (eventType === 0x80 || (eventType === 0x90 && dataByte2 === 0)) {
      events.push({
        tick: absoluteTick,
        type: 'off',
        channel,
        pitch: dataByte1,
        velocity: dataByte2,
      });
    }
    offset += isTwoByteMessage ? 2 : 3;
  }

  return events;
}

function splitTrackChunks(midi: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 14; // אחרי MThd (14 בייטים)
  while (offset < midi.length) {
    const chunkId = midi.subarray(offset, offset + 4).toString('ascii');
    const chunkLength = midi.readUInt32BE(offset + 4);
    expect(chunkId).toBe('MTrk');
    chunks.push(midi.subarray(offset + 8, offset + 8 + chunkLength));
    offset += 8 + chunkLength;
  }
  return chunks;
}

describe('encodeMidi', () => {
  it('כותב MThd תקני עם division=480 (=TICKS_PER_BEAT) ו-ntrks נכון (conductor + טראק אחד)', () => {
    const midi = encodeMidi(TEST_SCORE);
    expect(midi.subarray(0, 4).toString('ascii')).toBe('MThd');
    expect(midi.readUInt32BE(4)).toBe(6);
    expect(midi.readUInt16BE(8)).toBe(1); // format 1
    expect(midi.readUInt16BE(10)).toBe(2); // conductor + bass
    expect(midi.readUInt16BE(12)).toBe(480); // division
  });

  it('ה-track chunks נחתכים נכון לפי האורך המוצהר, וה-note events תואמים בדיוק לתווים ב-score', () => {
    const midi = encodeMidi(TEST_SCORE);
    const trackChunks = splitTrackChunks(midi);
    expect(trackChunks).toHaveLength(2);

    const instrumentTrack = trackChunks[1];
    expect(instrumentTrack).toBeDefined();
    const noteEvents = parseTrackNoteEvents(instrumentTrack ?? Buffer.alloc(0));

    // 2 תווים → 2 note-on + 2 note-off, ממוינים לפי tick
    expect(noteEvents).toHaveLength(4);
    expect(noteEvents[0]).toMatchObject({ tick: 0, type: 'on', pitch: 36 });
    expect(noteEvents[1]).toMatchObject({ tick: 480, type: 'off', pitch: 36 });
    expect(noteEvents[2]).toMatchObject({ tick: 480, type: 'on', pitch: 38 });
    expect(noteEvents[3]).toMatchObject({ tick: 960, type: 'off', pitch: 38 });

    // כל ה-events של track ה-bass על ערוץ MIDI 0 (ROLE_TO_CHANNEL.bass)
    expect(noteEvents.every((event) => event.channel === 0)).toBe(true);
  });
});
