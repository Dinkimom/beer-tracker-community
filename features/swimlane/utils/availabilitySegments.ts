/**
 * Сегменты отпуска/техспринта по рабочим дням спринта (для свимлейна и занятости).
 */

import type { AvailabilityCardKind } from '@/features/swimlane/components/AvailabilityCard';
import type { BoardAvailabilityEvent } from '@/types/quarterly';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { getWorkingDaysRange } from '@/utils/dateUtils';

function normalizeDayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function normalizeDayEnd(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function parseIsoDateOnlyUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function dayOverlapsEntry(dayDate: Date, entry: BoardAvailabilityEvent): boolean {
  const dayStart = normalizeDayStart(dayDate);
  const dayEnd = normalizeDayEnd(dayDate);
  const entryStart = normalizeDayStart(parseIsoDateOnlyUtc(entry.startDate));
  const entryEnd = normalizeDayEnd(parseIsoDateOnlyUtc(entry.endDate));
  return entryStart <= dayEnd && entryEnd >= dayStart;
}

function formatDDMM(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDDMM(new Date(startDate));
  const end = formatDDMM(new Date(endDate));
  return start === end ? start : `${start}–${end}`;
}

function boardEventToKind(ev: BoardAvailabilityEvent): AvailabilityCardKind {
  switch (ev.eventType) {
    case 'duty':
      return 'duty';
    case 'sick_leave':
      return 'sick_leave';
    case 'vacation':
      return 'vacation';
    case 'tech_sprint': {
      const t = ev.techSprintSubtype;
      if (t === 'web') return 'tech-sprint-web';
      if (t === 'back') return 'tech-sprint-back';
      return 'tech-sprint-qa';
    }
    default:
      return 'vacation';
  }
}

export interface AvailabilitySegment {
  dateRangeLabel: string;
  durationInParts: number;
  kind: AvailabilityCardKind;
  startDay: number;
}

export function getSegmentsForDeveloper(
  developerId: string,
  sprintStartDate: Date,
  boardEvents: BoardAvailabilityEvent[],
  workingDaysCount: number = WORKING_DAYS
): AvailabilitySegment[] {
  const count = Math.max(1, workingDaysCount);
  const workingDays = getWorkingDaysRange(sprintStartDate, count);
  const segments: AvailabilitySegment[] = [];

  const entries = boardEvents.filter((v) => v.memberId === developerId);

  for (const entry of entries) {
    const kind = boardEventToKind(entry);
    const overlappingDays: number[] = [];
    for (let dayIndex = 0; dayIndex < workingDays.length; dayIndex++) {
      if (dayOverlapsEntry(workingDays[dayIndex]!, entry)) {
        overlappingDays.push(dayIndex);
      }
    }
    if (overlappingDays.length === 0) continue;
    const firstDay = Math.min(...overlappingDays);
    const lastDay = Math.max(...overlappingDays);
    const startDay = firstDay;
    const durationInParts = (lastDay - firstDay + 1) * PARTS_PER_DAY;
    const dateRangeLabel = formatDateRange(entry.startDate, entry.endDate);
    segments.push({ startDay, durationInParts, kind, dateRangeLabel });
  }

  return segments;
}
