import type { PhaseSegment, Task, TaskPosition } from '@/types';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { getWorkingDaysRange } from '@/utils/dateUtils';

/**
 * Собирает массив включённых ячеек в отрезки (соседние включённые ячейки — один отрезок).
 * startCell — начальная ячейка диапазона (клетки от 0 до cells.length-1 соответствуют startCell..startCell+cells.length-1).
 */
export function cellsToSegments(startCell: number, cells: boolean[]): PhaseSegment[] {
  const segments: PhaseSegment[] = [];
  let i = 0;
  while (i < cells.length) {
    if (!cells[i]) {
      i++;
      continue;
    }
    const segStartCell = startCell + i;
    let j = i;
    while (j < cells.length && cells[j]) j++;
    const duration = j - i;
    segments.push({
      startDay: Math.floor(segStartCell / PARTS_PER_DAY),
      startPart: segStartCell % PARTS_PER_DAY,
      duration,
    });
    i = j;
  }
  return segments;
}

/** Смежные группы включённых/выключенных ячеек (редактор отрезков по сетке). */
export function getPhaseSegmentCellBlocks(
  cells: boolean[]
): Array<{ type: 'off'; length: number } | { type: 'on'; length: number }> {
  const blocks: Array<{ type: 'off'; length: number } | { type: 'on'; length: number }> = [];
  let i = 0;
  while (i < cells.length) {
    if (cells[i]) {
      let j = i;
      while (j < cells.length && cells[j]) j++;
      blocks.push({ type: 'on', length: j - i });
      i = j;
    } else {
      let j = i;
      while (j < cells.length && !cells[j]) j++;
      blocks.push({ type: 'off', length: j - i });
      i = j;
    }
  }
  return blocks;
}

/**
 * Схлопывает соседние отрезки (конец одного = начало следующего) в один.
 * Сортирует по началу и сливает подряд идущие.
 */
export function mergeAdjacentSegments(segments: PhaseSegment[]): PhaseSegment[] {
  if (segments.length <= 1) return segments;
  const withCells = segments.map((s) => {
    const startCell = s.startDay * PARTS_PER_DAY + s.startPart;
    return { ...s, startCell, endCell: startCell + s.duration };
  });
  withCells.sort((a, b) => a.startCell - b.startCell);
  const merged: PhaseSegment[] = [];
  let cur = { ...withCells[0]!, startCell: withCells[0]!.startCell, endCell: withCells[0]!.endCell };
  for (let i = 1; i < withCells.length; i++) {
    const next = withCells[i]!;
    if (next.startCell <= cur.endCell) {
      cur.endCell = Math.max(cur.endCell, next.endCell);
      cur.duration = cur.endCell - cur.startCell;
    } else {
      merged.push({
        startDay: Math.floor(cur.startCell / PARTS_PER_DAY),
        startPart: cur.startCell % PARTS_PER_DAY,
        duration: cur.duration,
      });
      cur = { ...next, startCell: next.startCell, endCell: next.endCell };
    }
  }
  merged.push({
    startDay: Math.floor(cur.startCell / PARTS_PER_DAY),
    startPart: cur.startCell % PARTS_PER_DAY,
    duration: cur.endCell - cur.startCell,
  });
  return merged;
}

/** Диапазон ячеек одного отрезка занятости */
export interface PositionSegmentRange {
  endCell: number;
  startCell: number;
}

/**
 * Возвращает отрезки занятости для позиции.
 * Если заданы segments — по ним; иначе один отрезок [startDay, startPart, duration].
 */
export function getPositionSegmentRanges(position: TaskPosition): PositionSegmentRange[] {
  if (position.segments && position.segments.length > 0) {
    return position.segments.map((seg) => {
      const startCell = seg.startDay * PARTS_PER_DAY + seg.startPart;
      return { startCell, endCell: startCell + seg.duration };
    });
  }
  const startCell = position.startDay * PARTS_PER_DAY + position.startPart;
  return [{ startCell, endCell: startCell + position.duration }];
}

/** Эффективная длительность позиции в частях (сумма длительностей отрезков или duration). */
export function getPositionEffectiveDuration(position: TaskPosition): number {
  if (position.segments && position.segments.length > 0) {
    return position.segments.reduce((sum, s) => sum + s.duration, 0);
  }
  return position.duration;
}

/**
 * Диапазон и начальные ячейки для inline-редактора отрезков.
 * rangeStartCell, rangeEndCell — границы; totalCells = rangeEndCell - rangeStartCell.
 * initialCells — массив boolean по одной ячейке (true = включён по текущим segments или целой фазе).
 */
export function getSegmentEditorRangeAndCells(position: TaskPosition): {
  rangeStartCell: number;
  totalCells: number;
  initialCells: boolean[];
} {
  const ranges = getPositionSegmentRanges(position);
  if (ranges.length === 0) {
    const startCell = position.startDay * PARTS_PER_DAY + position.startPart;
    return {
      rangeStartCell: startCell,
      totalCells: position.duration,
      initialCells: Array.from({ length: position.duration }, () => true),
    };
  }
  const rangeStartCell = Math.min(...ranges.map((r) => r.startCell));
  const rangeEndCell = Math.max(...ranges.map((r) => r.endCell));
  const totalCells = rangeEndCell - rangeStartCell;
  const initialCells = Array.from({ length: totalCells }, () => false);
  for (const r of ranges) {
    for (let c = r.startCell; c < r.endCell; c++) {
      initialCells[c - rangeStartCell] = true;
    }
  }
  return { rangeStartCell, totalCells, initialCells };
}

export function getDayDate(
  sprintStartDate: Date,
  dayIndex: number,
  workingDaysCount: number = WORKING_DAYS
): Date {
  const days = getWorkingDaysRange(sprintStartDate, Math.max(1, workingDaysCount));
  const picked = days[dayIndex] ?? days[days.length - 1] ?? sprintStartDate;
  const d = new Date(picked);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getPlannedPositionCellRange(
  position: {
    duration: number;
    plannedStartDay?: number | null;
    plannedStartPart?: number | null;
    plannedDuration?: number | null;
    segments?: PhaseSegment[] | null;
  }
): { endCell: number; startCell: number } | null {
  if (position.segments && position.segments.length > 0) {
    const ranges = position.segments
      .filter((seg) => seg.duration > 0)
      .map((seg) => {
        const startCell = seg.startDay * PARTS_PER_DAY + seg.startPart;
        return { endCell: startCell + seg.duration, startCell };
      });

    if (ranges.length === 0) return null;

    return {
      endCell: Math.max(...ranges.map((range) => range.endCell)),
      startCell: Math.min(...ranges.map((range) => range.startCell)),
    };
  }

  const { plannedStartDay, plannedStartPart, plannedDuration, duration } = position;

  if (plannedStartDay == null || plannedStartPart == null) return null;
  const plannedDurationParts = plannedDuration ?? duration;
  if (plannedDurationParts <= 0) return null;

  const startCell = plannedStartDay * PARTS_PER_DAY + plannedStartPart;
  return { endCell: startCell + plannedDurationParts, startCell };
}

export function getPlannedCellRangeDateRange(
  range: { endCell: number; startCell: number },
  sprintStartDate: Date,
  workingDaysCount: number
): { startDate: Date; endDate: Date } | null {
  if (range.endCell <= range.startCell) return null;
  const startDayIndex = Math.floor(range.startCell / PARTS_PER_DAY);
  const lastCellIndexInclusive = range.endCell - 1;
  const endDayIndex = Math.floor(lastCellIndexInclusive / PARTS_PER_DAY);

  const startDate = getDayDate(sprintStartDate, startDayIndex, workingDaysCount);
  const endDate = getDayDate(sprintStartDate, endDayIndex, workingDaysCount);

  return { startDate, endDate };
}

export function getPlannedPositionDateRange(
  position: {
    duration: number;
    plannedStartDay?: number | null;
    plannedStartPart?: number | null;
    plannedDuration?: number | null;
    segments?: PhaseSegment[] | null;
  },
  sprintStartDate: Date,
  workingDaysCount: number
): { startDate: Date; endDate: Date } | null {
  const range = getPlannedPositionCellRange(position);
  if (!range) return null;
  return getPlannedCellRangeDateRange(range, sprintStartDate, workingDaysCount);
}

/** При cellsPerDay===1 одна ячейка = один день (dayIndex — индекс дня). */
export function isCellOccupiedByTask(
  dayIndex: number,
  partIndex: number,
  position: TaskPosition,
  cellsPerDay?: 1 | 3
): boolean {
  if (cellsPerDay === 1) {
    const endDay = position.startDay + Math.max(1, Math.ceil(position.duration / PARTS_PER_DAY));
    return dayIndex >= position.startDay && dayIndex < endDay;
  }
  const cellIndex = dayIndex * PARTS_PER_DAY + partIndex;
  const ranges = getPositionSegmentRanges(position);
  return ranges.some((r) => cellIndex >= r.startCell && cellIndex < r.endCell);
}

export function positionToStartCell(position: TaskPosition): number {
  const ranges = getPositionSegmentRanges(position);
  if (ranges.length === 0) return 0;
  return Math.min(...ranges.map((r) => r.startCell));
}

export function positionToEndCell(position: TaskPosition): number {
  const ranges = getPositionSegmentRanges(position);
  if (ranges.length === 0) return 0;
  return Math.max(...ranges.map((r) => r.endCell));
}

/** Конец плана для бейзлайна занятости: после последнего отрезка при segments; иначе planned/root start + duration. */
export function occupancyPlanEndCell(position: TaskPosition): number {
  if (position.segments && position.segments.length > 0) {
    return positionToEndCell(position);
  }
  const plannedStartDay = position.plannedStartDay ?? position.startDay;
  const plannedStartPart = position.plannedStartPart ?? position.startPart;
  const plannedDuration = position.plannedDuration ?? position.duration;
  return plannedStartDay * PARTS_PER_DAY + plannedStartPart + plannedDuration;
}

export function getCombinedPhaseCellRange(
  position?: TaskPosition,
  qaPosition?: TaskPosition,
  qaTask?: Task | null
): { startCell: number; endCell: number } | null {
  const devStartCell = position ? positionToStartCell(position) : null;
  const devEndCell = position ? positionToEndCell(position) : null;

  const qaStartCell =
    qaPosition && qaTask ? positionToStartCell(qaPosition) : null;
  const qaEndCell =
    qaPosition && qaTask ? positionToEndCell(qaPosition) : null;

  const startCell =
    devStartCell != null && qaStartCell != null
      ? Math.min(devStartCell, qaStartCell)
      : devStartCell ?? qaStartCell;
  const endCell =
    devEndCell != null && qaEndCell != null
      ? Math.max(devEndCell, qaEndCell)
      : devEndCell ?? qaEndCell;

  if (startCell == null || endCell == null) return null;

  return { startCell, endCell };
}
