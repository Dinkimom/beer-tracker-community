/**
 * Преобразует StatusDuration в позиции ячеек спринта (для отображения фаз факта)
 */

import { PARTS_PER_DAY } from '@/constants';
import { getWorkingDaysRange, getWorkingHoursBetween } from '@/utils/dateUtils';

import { dateTimeToFractionalCellInRange, TOTAL_PARTS } from './sprintCellUtils';

export interface StatusPhaseCell {
  /** Задачи для блока «Задачи» в PhaseTooltip (редко) */
  contributingTaskIds?: string[];
  createdBy?: {
    display?: string;
    id?: string;
  };
  /** Длительность в мс (для отображения) */
  durationMs: number;
  /** Дробная позиция конца (0..TOTAL_PARTS) */
  endCell: number;
  /** Дата/время перехода из статуса (ISO строка или null, если задача ещё в статусе) */
  endTime: string | null;
  /** Дробная позиция начала (0..TOTAL_PARTS) */
  startCell: number;
  /** Дата/время перехода в статус (ISO строка) */
  startTime: string;
  statusKey: string;
  statusName: string;
}

export interface StatusDurationLike {
  contributingTaskIds?: string[];
  createdBy?: {
    display?: string;
    id?: string;
  };
  endTime: string | null;
  endTimeMs: number;
  startTime: string;
  startTimeMs: number;
  statusKey: string;
  statusName: string;
}

/**
 * Преобразует статусные фазы в диапазоны ячеек спринта.
 * Обрезает по границам диапазона (0..totalParts).
 * @param totalParts — если задан (например, 240 для 6 спринтов), диапазон — N рабочих дней от sprintStartDate
 */
export function statusDurationsToCells(
  sprintStartDate: Date,
  durations: StatusDurationLike[],
  totalParts?: number
): StatusPhaseCell[] {
  const cap = totalParts ?? TOTAL_PARTS;
  const workingDaysCount = cap / PARTS_PER_DAY;

  const sprintStartMs = new Date(sprintStartDate).setHours(0, 0, 0, 0);
  const workingDays = getWorkingDaysRange(sprintStartDate, workingDaysCount);
  const lastDay = workingDays[workingDays.length - 1];
  const sprintEndDate = lastDay ? new Date(lastDay) : new Date(sprintStartDate);
  sprintEndDate.setHours(23, 59, 59, 999);
  const sprintEndMs = sprintEndDate.getTime();

  const toCell = (date: Date) =>
    dateTimeToFractionalCellInRange(sprintStartDate, date, cap);

  const result: StatusPhaseCell[] = [];

  for (const d of durations) {
    const startMs = d.startTimeMs;
    const endMs = d.endTime ? d.endTimeMs : Date.now();
    if (endMs < sprintStartMs || startMs > sprintEndMs) continue;

    const startDate = new Date(Math.max(startMs, sprintStartMs));
    const endDate = new Date(Math.min(endMs, sprintEndMs));

    const startCell = Math.max(0, Math.min(cap, toCell(startDate)));
    const endCell = Math.max(0, Math.min(cap, toCell(endDate)));

    const durationMs = getWorkingHoursBetween(startDate.getTime(), endDate.getTime());

    if (startCell < endCell && durationMs > 0) {
      result.push({
        contributingTaskIds: d.contributingTaskIds,
        durationMs,
        endCell,
        endTime: d.endTime,
        startCell,
        startTime: d.startTime,
        statusKey: d.statusKey,
        statusName: d.statusName,
        createdBy: d.createdBy,
      });
    }
  }

  return result;
}
