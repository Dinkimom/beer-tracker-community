/**
 * Спринты квартала и разбивка по рабочим дням (одна ячейка = один день).
 */

import type { Quarter } from '@/types';

export const WORKING_DAYS_PER_SPRINT = 10;

export interface QuarterSprintInfo {
  endDate: Date;
  id: number;
  name: string;
  startDate: Date;
  /** Рабочие дни в этом спринте (для отображения колонок) */
  workingDays: number;
}

/**
 * Диапазон дат квартала.
 */
export function getQuarterDateRange(
  year: number,
  quarter: Quarter
): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endMonth = startMonth + 3;
  const endDate = new Date(year, endMonth, 0);
  return { startDate, endDate };
}

/**
 * Фильтрует спринты доски, попадающие в квартал.
 */
export function filterSprintsByQuarter<T extends { id: number; name?: string; startDate: Date | string; endDate: Date | string }>(
  sprints: T[],
  year: number,
  quarter: Quarter
): QuarterSprintInfo[] {
  const { startDate: quarterStart, endDate: quarterEnd } = getQuarterDateRange(year, quarter);
  quarterEnd.setHours(23, 59, 59, 999);

  return sprints
    .filter((s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return start <= quarterEnd && end >= quarterStart;
    })
    .map((s) => ({
      id: s.id,
      name: s.name ?? `Sprint ${s.id}`,
      startDate: new Date(s.startDate),
      endDate: new Date(s.endDate),
      workingDays: WORKING_DAYS_PER_SPRINT,
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}
