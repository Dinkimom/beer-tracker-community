/**
 * Утилиты для работы с кварталами и датами
 */

import type { Quarter } from '@/types';

/**
 * Получить текущий квартал
 */
export function getCurrentQuarter(): { year: number; quarter: Quarter } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const quarter = (Math.floor(month / 3) + 1) as Quarter;

  return { year, quarter };
}
