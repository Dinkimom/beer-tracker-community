/**
 * Хук для вычисления данных графика берндауна
 */

import type { BurndownDayChangelogItem } from '@/lib/api/types';

import { useMemo } from 'react';

import { isWeekend, countWorkingDays } from '../utils/dateUtils';

export type { BurndownDayChangelogItem };

interface BurndownDataPoint {
  date: string;
  dateKey?: string;
  remainingSP: number;
  remainingTP: number;
}

interface BurndownData {
  dailyChangelog?: Record<string, BurndownDayChangelogItem[]>;
  dataPoints: BurndownDataPoint[];
  initialSP: number;
  initialTP: number;
  sprintInfo: {
    endDate: string;
    startDate: string;
  };
}

export interface ChartDataPoint {
  date: string;
  dayChangelog: BurndownDayChangelogItem[];
  fullDate: string;
  idealSP?: number;
  idealTP?: number;
  remainingSP?: number;
  remainingTP?: number;
}

interface UseBurndownChartDataProps {
  burndownData: BurndownData | null | undefined;
  isArchived: boolean;
  isDraft: boolean;
}

/**
 * Вычисляет данные для отображения на графике берндауна
 */
export function useBurndownChartData({
  burndownData,
  isArchived,
  isDraft,
}: UseBurndownChartDataProps): ChartDataPoint[] {
  return useMemo(() => {
    if (!burndownData?.dataPoints) return [];

    const startDate = new Date(burndownData.sprintInfo.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(burndownData.sprintInfo.endDate);
    endDate.setHours(0, 0, 0, 0);

    // Для активных спринтов ограничиваем отрисовку фактических данных текущей датой
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDataDate = isArchived ? endDate : today;

    // Подсчитываем общее количество рабочих дней в спринте
    const totalWorkingDays = countWorkingDays(startDate, endDate);

    let lastWorkingDayIdealSP = burndownData.initialSP;
    let lastWorkingDayIdealTP = burndownData.initialTP;

    // Показываем все дни спринта
    // Фактические данные рисуем только до текущей даты (и не показываем для черновиков)
    // Плановая сходимость рисуется на весь спринт
    return burndownData.dataPoints.map((point) => {
      const date = new Date(point.date);
      date.setHours(0, 0, 0, 0);

      const isAfterCurrentDate = date > maxDataDate;

      // Плановая сходимость рассчитываем для всех дней спринта
      let idealSP: number | undefined = undefined;
      let idealTP: number | undefined = undefined;

      if (burndownData.initialSP > 0 || burndownData.initialTP > 0) {
        if (isWeekend(date)) {
          // В выходные дни плановая сходимость остается на уровне последнего рабочего дня
          idealSP = lastWorkingDayIdealSP;
          idealTP = lastWorkingDayIdealTP;
        } else {
          // В рабочие дни рассчитываем плановую сходимость
          const workingDaysPassed = countWorkingDays(startDate, date);

          if (totalWorkingDays > 0) {
            const progress = Math.min(workingDaysPassed / totalWorkingDays, 1);
            idealSP = Math.max(0, burndownData.initialSP * (1 - progress));
            idealTP = Math.max(0, burndownData.initialTP * (1 - progress));

            // Обновляем значения для последнего рабочего дня
            lastWorkingDayIdealSP = idealSP;
            lastWorkingDayIdealTP = idealTP;
          }
        }
      }

      return {
        date: date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        }),
        fullDate: date.toISOString(),
        dayChangelog: burndownData.dailyChangelog?.[point.dateKey ?? point.date.slice(0, 10)] ?? [],
        // Фактические данные показываем только до текущей даты (или до конца для архивных)
        // Для черновиков не показываем фактические данные
        // Используем undefined вместо null для правильной работы Recharts
        remainingSP: (isDraft || isAfterCurrentDate) ? undefined : point.remainingSP,
        remainingTP: (isDraft || isAfterCurrentDate) ? undefined : point.remainingTP,
        // Плановая сходимость рисуется на весь спринт
        idealSP,
        idealTP,
      };
    });
  }, [burndownData, isArchived, isDraft]);
}

