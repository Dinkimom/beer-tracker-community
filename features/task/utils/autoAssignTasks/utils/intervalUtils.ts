/**
 * Утилиты для работы с интервалами времени
 */

import type { TimeInterval } from '../types';

import { WORKING_DAYS, PARTS_PER_DAY } from '@/constants';

/**
 * Проверяет пересечение двух интервалов
 */
export function intervalsIntersect(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Вычисляет занятые интервалы для каждого разработчика на основе позиций задач
 */
export function calculateOccupiedIntervals(
  positions: Map<string, { assignee: string; startDay: number; startPart: number; duration: number }>,
  developerIds: string[]
): Map<string, TimeInterval[]> {
  const occupiedIntervals = new Map<string, TimeInterval[]>();

  developerIds.forEach(devId => {
    occupiedIntervals.set(devId, []);
  });

  positions.forEach((position) => {
    const intervals = occupiedIntervals.get(position.assignee) || [];
    const startCell = position.startDay * PARTS_PER_DAY + position.startPart;
    const endCell = startCell + position.duration;
    intervals.push({ start: startCell, end: endCell });
    occupiedIntervals.set(position.assignee, intervals);
  });

  return occupiedIntervals;
}

/**
 * Находит первую свободную позицию после всех занятых интервалов
 * Минимальная позиция - currentCell (не планируем в прошлое)
 * Возвращает позицию или null, если задача не поместится
 */
export function findNextAvailableCell(
  intervals: TimeInterval[],
  taskDuration: number,
  currentCell: number = 0
): number | null {
  // Начинаем поиск с текущего времени спринта (не планируем в прошлое)
  const minStartCell = Math.max(0, currentCell);
  const maxEndCell = WORKING_DAYS * PARTS_PER_DAY;

  // Проверяем, что задача вообще поместится в спринт
  if (minStartCell + taskDuration > maxEndCell) {
    return null; // Задача не поместится
  }

  if (intervals.length === 0) {
    return minStartCell;
  }

  // Сортируем интервалы по началу
  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  // Фильтруем интервалы, которые заканчиваются до текущего времени (они в прошлом)
  const futureIntervals = sorted.filter(interval => interval.end > minStartCell);

  if (futureIntervals.length === 0) {
    return minStartCell;
  }

  // Находим максимальную конечную позицию среди будущих интервалов
  const maxEnd = Math.max(...futureIntervals.map(i => i.end));

  // Проверяем, есть ли место после последнего интервала
  const nextStart = Math.max(minStartCell, maxEnd);
  if (nextStart + taskDuration <= maxEndCell) {
    // Проверяем, что не пересекается с другими интервалами
    const candidateInterval = { start: nextStart, end: nextStart + taskDuration };
    const hasIntersection = futureIntervals.some(interval => intervalsIntersect(candidateInterval, interval));
    if (!hasIntersection) {
      return nextStart;
    }
  }

  // Если места после последнего интервала нет, пытаемся найти свободное место между интервалами
  // Начинаем с минимальной позиции
  let candidateStart = minStartCell;
  for (let i = 0; i < futureIntervals.length; i++) {
    const interval = futureIntervals[i];

    // Если есть место перед текущим интервалом
    if (candidateStart + taskDuration <= interval.start) {
      // Проверяем, что не пересекается с предыдущими интервалами
      const candidateInterval = { start: candidateStart, end: candidateStart + taskDuration };
      const hasIntersection = futureIntervals.slice(0, i).some(prevInterval => intervalsIntersect(candidateInterval, prevInterval));
      if (!hasIntersection) {
        return candidateStart;
      }
    }

    // Переходим к позиции после текущего интервала
    candidateStart = Math.max(candidateStart, interval.end);
  }

  // Если нет свободного места, возвращаем null (задача не поместится)
  return null;
}

/**
 * Находит свободное место для QA задачи после dev задачи
 */
export function findQATaskPlacement(
  intervals: TimeInterval[],
  taskDuration: number,
  minStartCell: number
): number | null {
  const maxEndCell = WORKING_DAYS * PARTS_PER_DAY;

  // Если минимальная позиция + длительность выходит за границы спринта, задача не поместится
  if (minStartCell + taskDuration > maxEndCell) {
    return null; // QA задача не помещается в спринт после dev задачи
  }

  // Фильтруем интервалы, которые заканчиваются после minStartCell
  const relevantIntervals = intervals.filter(interval => interval.end > minStartCell);

  if (relevantIntervals.length === 0) {
    // Нет занятых интервалов после minStartCell - можем разместить сразу
    return minStartCell;
  }

  // Сортируем интервалы по началу
  const sorted = [...relevantIntervals].sort((a, b) => a.start - b.start);

  // Проверяем, есть ли место сразу после minStartCell (перед первым интервалом)
  if (minStartCell + taskDuration <= sorted[0].start) {
    return minStartCell;
  }

  // Ищем место после последнего интервала
  const maxEnd = Math.max(...sorted.map(i => i.end));
  const candidateStart = Math.max(minStartCell, maxEnd);

  if (candidateStart + taskDuration <= maxEndCell) {
    // Проверяем, что не пересекается с другими интервалами
    const candidateInterval = { start: candidateStart, end: candidateStart + taskDuration };
    const hasIntersection = sorted.some(interval => intervalsIntersect(candidateInterval, interval));
    if (!hasIntersection) {
      return candidateStart;
    }
  }

  // Если не нашли место после последнего, ищем между интервалами
  let targetStartCell = minStartCell;
  for (let i = 0; i < sorted.length; i++) {
    const interval = sorted[i];

    // Проверяем место перед текущим интервалом
    if (targetStartCell + taskDuration <= interval.start) {
      const candidateInterval = { start: targetStartCell, end: targetStartCell + taskDuration };
      const hasIntersection = sorted.slice(0, i).some(prevInterval => intervalsIntersect(candidateInterval, prevInterval));
      if (!hasIntersection) {
        return targetStartCell;
      }
    }

    targetStartCell = Math.max(targetStartCell, interval.end);
  }

  // Если не нашли свободное место, возвращаем null
  return null;
}

