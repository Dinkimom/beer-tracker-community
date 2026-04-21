import { useEffect, useMemo, useState } from 'react';

import { getWorkingDaysRange } from '@/utils/dateUtils';

/**
 * Хук для получения индексов дней (0..N-1), которые являются нерабочими/праздничными
 * по данным isDayOff. Один запрос на весь диапазон через наш API (прокси), чтобы избежать CORS.
 *
 * @param sprintStartDate — дата начала (первого спринта)
 * @param workingDaysCount — число рабочих дней (10 для одного спринта, 10*N для N спринтов)
 */
export function useHolidayDays(
  sprintStartDate: Date | null | undefined,
  workingDaysCount?: number
): Set<number> {
  const [holidayDayIndices, setHolidayDayIndices] = useState<Set<number>>(new Set());

  const { workingDays, date1, date2 } = useMemo(() => {
    if (!sprintStartDate) {
      return { workingDays: [] as Date[], date1: '', date2: '' };
    }
    const count = workingDaysCount ?? 10;
    const days = getWorkingDaysRange(sprintStartDate, count);
    if (days.length === 0) {
      return { workingDays: [], date1: '', date2: '' };
    }
    const first = new Date(days[0]);
    const last = new Date(days[days.length - 1]);
    first.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const d1 = `${first.getFullYear()}${String(first.getMonth() + 1).padStart(2, '0')}${String(first.getDate()).padStart(2, '0')}`;
    const d2 = `${last.getFullYear()}${String(last.getMonth() + 1).padStart(2, '0')}${String(last.getDate()).padStart(2, '0')}`;
    return { workingDays: days, date1: d1, date2: d2 };
  }, [sprintStartDate, workingDaysCount]);

  useEffect(() => {
    if (!date1 || !date2 || workingDays.length === 0) {
      queueMicrotask(() => setHolidayDayIndices(new Set()));
      return;
    }

    const controller = new AbortController();
    const firstDay = new Date(workingDays[0]);
    firstDay.setHours(0, 0, 0, 0);

    async function load() {
      try {
        const resp = await fetch(
          `/api/holidays/isdayoff?date1=${date1}&date2=${date2}`,
          { signal: controller.signal }
        );
        if (!resp.ok) return;
        const text = await resp.text();
        if (!text) return;

        const next = new Set<number>();
        for (let i = 0; i < workingDays.length; i += 1) {
          const day = new Date(workingDays[i]);
          day.setHours(0, 0, 0, 0);
          const offsetDays = Math.round(
            (day.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)
          );
          const code = text[offsetDays];
          if (code === '1' || code === '8') next.add(i);
        }
        setHolidayDayIndices(next);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }

    load();
    return () => controller.abort();
  }, [date1, date2, workingDays.length]);

  return holidayDayIndices;
}

