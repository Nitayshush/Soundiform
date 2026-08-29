/**
 * @file        useNoteBoardGrid.ts
 * @description ⭐ 2026-08-27 (לוח-תווים אבסולוטי): מחשב rows/columns/rowLabels אמיתיים
 *              ל-MusicalGrid.tsx עבור סגנונות עם absoluteNoteBoard (טראנס/האוס) — אותו מקור-
 *              אמת (noteBoard.ts) שגם harmonyEngine.ts משתמש בו ביצירת המנגינה בפועל, כדי
 *              שהרשת החזותית תמיד תואמת למה שבאמת מתנגן. undefined עבור סגנונות אחרים
 *              (MusicalGrid נופל לברירת-המחדל הדקורטיבית הישנה, ללא שינוי).
 * @author      Soundiform
 * @created     2026-08-27
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useMemo } from 'react';
import {
  ABSOLUTE_BOARD_ROOT_PITCH_CLASS,
  buildNoteBoardRows,
  COLUMNS_PER_BAR,
} from '@soundiform/core';
import { useGenreStore } from '@/stores/genreStore';
import { useGenrePacksStore } from '@/stores/genrePacksStore';

const CHROMATIC_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOT_OCTAVE_BASE_MIDI = 48;

function noteName(midi: number): string {
  const name = CHROMATIC_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export interface NoteBoardGrid {
  rows: number;
  columns: number;
  rowLabels: string[];
}

export function useNoteBoardGrid(): NoteBoardGrid | undefined {
  const genreId = useGenreStore((state) => state.genreId);
  const pack = useGenrePacksStore((state) =>
    state.packs.find((candidate) => candidate.id === genreId),
  );

  return useMemo(() => {
    if (!pack?.absoluteNoteBoard) {
      return undefined;
    }
    const root = ROOT_OCTAVE_BASE_MIDI + ABSOLUTE_BOARD_ROOT_PITCH_CLASS;
    const rowsHighToLow = buildNoteBoardRows(root, pack.defaultMode).slice().reverse();
    return {
      rows: rowsHighToLow.length,
      columns: COLUMNS_PER_BAR,
      rowLabels: rowsHighToLow.map(noteName),
    };
  }, [pack]);
}
