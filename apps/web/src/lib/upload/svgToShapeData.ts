/**
 * @file        svgToShapeData.ts
 * @description ⭐ ממיר SVG (טקסט מסונן — ראה sanitizeSvg.ts) ל-ShapeData, באותו פורמט בדיוק
 *              שמפיק DrawingCanvas (§4.5, §11 Sprint 2 "העלאת SVG/PNG → ShapeData").
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ jsdom משמש כאן רק בתוך route בצד-שרת (api/upload) — לא נטען אף פעם מקוד שנטען לדפדפן.
 * זה שונה מהסיבה ש-paper.js לא מיובא סטטית ב-useShapeCapture.ts (שם המטרה למנוע jsdom
 * מלהיטען *בכלל*, כי אין בו צורך אמיתי בדפדפן). כאן יש צורך אמיתי: DOMPurify (sanitizeSvg.ts)
 * דורש איזושהי implementation של DOM כדי לפרסר/לנקות SVG כ-markup, וללא jsdom.getCTM() לא
 * ממומש ל-SVG ממילא — לכן נדרש parseTransformAttribute משלנו (svgTransform.ts) בכל מקרה.
 *
 * ⭐ נאמנות-צורה: התאמת aspect-ratio נשמרת (fit-to-square, ממורכז) — בניגוד ל-DrawingCanvas
 * שמנרמל כל ציר בנפרד לפי רוחב/גובה הקנבס (שבפועל כמעט תמיד ריבועי). ל-SVG/לוגו שהיחס
 * רוחב:גובה שלו רחוק מ-1:1, נרמול-עצמאי-לכל-ציר היה מעוות את הצורה (עיגול הופך לאליפסה).
 */

import { JSDOM } from 'jsdom';
import type { ShapeData, ShapePath, ShapePoint } from '@soundiform/shared';
import {
  flattenPathData,
  MAX_POINTS_PER_SUBPATH,
  MAX_SUBPATHS,
  type FlatSubpath,
} from './svgPathFlatten';
import {
  applyMatrix,
  IDENTITY_MATRIX,
  multiplyMatrices,
  parseTransformAttribute,
  type Matrix2D,
} from './svgTransform';

const SHAPE_VERSION = '1.0.0';
const CIRCLE_SAMPLE_COUNT = 48;
const MAX_VISITED_ELEMENTS = 20000;
const NON_RENDERED_TAGS = new Set(['defs', 'clippath', 'mask', 'symbol', 'style', 'title', 'desc']);

export class SvgConversionError extends Error {}

const NUMBER_LIST = /-?[\d.]+(?:e-?\d+)?/gi;

function numbersOf(text: string | null): number[] {
  if (!text) return [];
  return (text.match(NUMBER_LIST) ?? []).map(Number);
}

function attr(element: Element, name: string): number {
  return Number(element.getAttribute(name) ?? '0') || 0;
}

function transformSubpath(subpath: FlatSubpath, matrix: Matrix2D): FlatSubpath {
  return {
    points: subpath.points.map((point) => applyMatrix(matrix, point)),
    closed: subpath.closed,
  };
}

function pointsFromPointsAttribute(element: Element): { x: number; y: number }[] {
  const numbers = numbersOf(element.getAttribute('points'));
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index] as number, y: numbers[index + 1] as number });
  }
  return points;
}

function rectSubpath(element: Element): FlatSubpath {
  const x = attr(element, 'x');
  const y = attr(element, 'y');
  const width = attr(element, 'width');
  const height = attr(element, 'height');
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    closed: true,
  };
}

function ellipseSubpath(cx: number, cy: number, rx: number, ry: number): FlatSubpath {
  const points: FlatPointList = [];
  for (let index = 0; index < CIRCLE_SAMPLE_COUNT; index += 1) {
    const angle = (index / CIRCLE_SAMPLE_COUNT) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return { points, closed: true };
}

type FlatPointList = { x: number; y: number }[];

function shapeElementSubpaths(element: Element): FlatSubpath[] {
  const tag = element.tagName.toLowerCase();
  switch (tag) {
    case 'path': {
      const d = element.getAttribute('d');
      return d ? flattenPathData(d) : [];
    }
    case 'rect':
      return [rectSubpath(element)];
    case 'circle': {
      const r = attr(element, 'r');
      return r > 0 ? [ellipseSubpath(attr(element, 'cx'), attr(element, 'cy'), r, r)] : [];
    }
    case 'ellipse': {
      const rx = attr(element, 'rx');
      const ry = attr(element, 'ry');
      return rx > 0 && ry > 0
        ? [ellipseSubpath(attr(element, 'cx'), attr(element, 'cy'), rx, ry)]
        : [];
    }
    case 'line':
      return [
        {
          points: [
            { x: attr(element, 'x1'), y: attr(element, 'y1') },
            { x: attr(element, 'x2'), y: attr(element, 'y2') },
          ],
          closed: false,
        },
      ];
    case 'polyline': {
      const points = pointsFromPointsAttribute(element);
      return points.length >= 2 ? [{ points, closed: false }] : [];
    }
    case 'polygon': {
      const points = pointsFromPointsAttribute(element);
      return points.length >= 2 ? [{ points, closed: true }] : [];
    }
    default:
      return [];
  }
}

interface WalkState {
  subpaths: FlatSubpath[];
  visitedCount: number;
}

function walk(element: Element, parentMatrix: Matrix2D, state: WalkState): void {
  state.visitedCount += 1;
  if (state.visitedCount > MAX_VISITED_ELEMENTS) {
    throw new SvgConversionError('SVG exceeds the allowed number of elements');
  }
  const tag = element.tagName.toLowerCase();
  if (NON_RENDERED_TAGS.has(tag)) {
    return;
  }

  const worldMatrix = multiplyMatrices(
    parentMatrix,
    parseTransformAttribute(element.getAttribute('transform')),
  );

  for (const rawSubpath of shapeElementSubpaths(element)) {
    if (state.subpaths.length >= MAX_SUBPATHS) {
      throw new SvgConversionError('SVG exceeds the allowed number of subpaths');
    }
    state.subpaths.push(transformSubpath(rawSubpath, worldMatrix));
  }

  for (const child of Array.from(element.children)) {
    walk(child, worldMatrix, state);
  }
}

function boundingBoxOf(subpaths: FlatSubpath[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const subpath of subpaths) {
    for (const point of subpath.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

const MIN_MEANINGFUL_EXTENT = 1e-6;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** מתאים-לריבוע (fit-to-square) תוך שמירת יחס-רוחב-גובה, ממורכז — ראה הערת הקובץ. */
function normalizeSubpaths(subpaths: FlatSubpath[]): ShapePath[] {
  const { minX, minY, width, height } = boundingBoxOf(subpaths);
  const side = Math.max(width, height, MIN_MEANINGFUL_EXTENT);
  const offsetX = (side - width) / 2;
  const offsetY = (side - height) / 2;

  const normalizePoint = (point: { x: number; y: number }): ShapePoint => ({
    x: clampUnit((point.x - minX + offsetX) / side),
    y: clampUnit((point.y - minY + offsetY) / side),
  });

  return subpaths.map((subpath) => ({
    points: subpath.points.map(normalizePoint),
    closed: subpath.closed,
  }));
}

/**
 * הופך SVG (טקסט, כבר מסונן — ראה sanitizeSvg.ts) ל-ShapeData. זורק SvgConversionError אם
 * ה-SVG לא תקין/חורג ממגבלות הגנתיות, או אם לא נמצא בו אף צורה גיאומטרית.
 */
export function svgMarkupToShapeData(svgMarkup: string): ShapeData {
  let svgRoot: Element | null;
  try {
    svgRoot = new JSDOM(svgMarkup, { contentType: 'image/svg+xml' }).window.document.querySelector(
      'svg',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SvgConversionError(`Invalid SVG: ${message}`);
  }
  if (!svgRoot) {
    throw new SvgConversionError('No valid <svg> element found');
  }

  const state: WalkState = { subpaths: [], visitedCount: 0 };
  walk(svgRoot, IDENTITY_MATRIX, state);

  const validSubpaths = state.subpaths.filter(
    (subpath) => subpath.points.length >= 2 && subpath.points.length <= MAX_POINTS_PER_SUBPATH,
  );
  if (validSubpaths.length === 0) {
    throw new SvgConversionError('No geometric shape found in the SVG');
  }

  return { version: SHAPE_VERSION, paths: normalizeSubpaths(validSubpaths) };
}
