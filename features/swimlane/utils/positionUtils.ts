import type { PhaseSegment, TaskPosition } from '@/types';

import { WORKING_DAYS, PARTS_PER_DAY } from '@/constants';
import { mergeAdjacentSegments, positionToStartCell } from '@/lib/planner-timeline';

/**
 * Вычисляет начальную позицию в ячейках (минимальная по всем отрезкам, если есть segments).
 */
export function getStartCell(position: TaskPosition): number {
  return positionToStartCell(position);
}

const defaultTimelineTotalParts = () => WORKING_DAYS * PARTS_PER_DAY;

/** Левая граница отрезка в процентах ширины таймлайна спринта. */
export function getLeftPercentForSegmentStartCell(
  startCell: number,
  timelineTotalParts: number = defaultTimelineTotalParts()
): number {
  return (startCell / timelineTotalParts) * 100;
}

/**
 * Вычисляет процентную позицию слева для карточки
 */
export function getLeftPercent(
  position: TaskPosition,
  timelineTotalParts: number = defaultTimelineTotalParts()
): number {
  return getLeftPercentForSegmentStartCell(getStartCell(position), timelineTotalParts);
}

/**
 * Вычисляет процентную ширину карточки
 */
export function getWidthPercent(
  duration: number,
  timelineTotalParts: number = defaultTimelineTotalParts()
): number {
  return (duration / timelineTotalParts) * 100;
}

/** Отрезки плана для свимлейна: из segments или один блок из startDay/startPart/duration; по возрастанию времени. */
export function getOrderedPlanSegments(position: TaskPosition): PhaseSegment[] {
  if (position.segments && position.segments.length > 0) {
    return [...position.segments].sort(
      (a, b) =>
        a.startDay * PARTS_PER_DAY + a.startPart - (b.startDay * PARTS_PER_DAY + b.startPart)
    );
  }
  return [
    {
      startDay: position.startDay,
      startPart: position.startPart,
      duration: position.duration,
    },
  ];
}

/**
 * Переносит один отрезок плана на newStartCell; остальные не двигаются.
 * null — вне спринта или пересечение с другим отрезком этой же позиции.
 */
export function moveSwimlanePlanSegmentToStartCell(
  position: TaskPosition,
  segmentIndex: number,
  newStartCell: number,
  totalCells: number = WORKING_DAYS * PARTS_PER_DAY
): TaskPosition | null {
  if (!position.segments?.length) return null;
  const ordered = getOrderedPlanSegments(position);
  if (segmentIndex < 0 || segmentIndex >= ordered.length) return null;
  const seg = ordered[segmentIndex]!;
  const dur = seg.duration;
  const newEnd = newStartCell + dur;
  if (newStartCell < 0 || newEnd > totalCells) return null;

  const updated = ordered.map((s, i) =>
    i === segmentIndex
      ? {
          ...s,
          startDay: Math.floor(newStartCell / PARTS_PER_DAY),
          startPart: newStartCell % PARTS_PER_DAY,
          duration: dur,
        }
      : s
  );

  const ranges = updated.map((s) => {
    const sc = s.startDay * PARTS_PER_DAY + s.startPart;
    return { startCell: sc, endCell: sc + s.duration };
  });
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i]!;
      const b = ranges[j]!;
      if (a.startCell < b.endCell && a.endCell > b.startCell) return null;
    }
  }

  const merged = mergeAdjacentSegments(updated);
  const effDur = merged.reduce((sum, s) => sum + s.duration, 0);
  const first = merged[0]!;
  return {
    ...position,
    segments: merged,
    startDay: first.startDay,
    startPart: first.startPart,
    duration: effDur,
  };
}

/**
 * Меняет длительность (и при необходимости начало) одного отрезка плана; остальные не двигаются.
 * null — выход за спринт или пересечение с соседним отрезком.
 */
export function resizeSwimlanePlanSegment(
  position: TaskPosition,
  segmentIndex: number,
  newDuration: number,
  newStartCell?: number,
  totalCells: number = WORKING_DAYS * PARTS_PER_DAY
): TaskPosition | null {
  if (!position.segments?.length) return null;
  const ordered = getOrderedPlanSegments(position);
  if (segmentIndex < 0 || segmentIndex >= ordered.length) return null;
  if (newDuration < 1) return null;

  const segs = ordered.map((s) => ({ ...s }));
  const seg = segs[segmentIndex]!;
  let startCell = seg.startDay * PARTS_PER_DAY + seg.startPart;
  if (newStartCell !== undefined) {
    startCell = newStartCell;
  }
  const endCell = startCell + newDuration;
  if (startCell < 0 || endCell > totalCells) return null;

  if (segmentIndex > 0) {
    const prev = segs[segmentIndex - 1]!;
    const prevEnd = prev.startDay * PARTS_PER_DAY + prev.startPart + prev.duration;
    if (startCell < prevEnd) return null;
  }
  if (segmentIndex < segs.length - 1) {
    const next = segs[segmentIndex + 1]!;
    const nextStart = next.startDay * PARTS_PER_DAY + next.startPart;
    if (endCell > nextStart) return null;
  }

  segs[segmentIndex] = {
    startDay: Math.floor(startCell / PARTS_PER_DAY),
    startPart: startCell % PARTS_PER_DAY,
    duration: newDuration,
  };

  const merged = mergeAdjacentSegments(segs);
  const effDur = merged.reduce((sum, s) => sum + s.duration, 0);
  const first = merged[0]!;
  return {
    ...position,
    segments: merged,
    startDay: first.startDay,
    startPart: first.startPart,
    duration: effDur,
  };
}

/**
 * Вычисляет максимальную длительность задачи от текущей позиции
 */
export function getMaxDuration(
  position: TaskPosition,
  timelineTotalParts: number = defaultTimelineTotalParts()
): number {
  const currentStart = getStartCell(position);
  return timelineTotalParts - currentStart;
}

export { calculateCellFromElement, calculateCellFromMouse } from '@/lib/swimlane/swimlaneCellFromGeometry';
