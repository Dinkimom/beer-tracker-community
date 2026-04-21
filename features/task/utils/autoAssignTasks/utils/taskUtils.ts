/**
 * Вспомогательные функции для работы с задачами
 */

import type { Task } from '@/types';

import { getTaskPoints, isTaskCompleted } from '../../taskUtils';

/**
 * Получает численное значение приоритета задачи для сортировки
 * Большее значение = более высокий приоритет
 */
export function getPriorityValue(priority?: string): number {
  if (!priority) {
    return 0; // Задачи без приоритета имеют самый низкий приоритет
  }

  const normalizedPriority = priority.toLowerCase();

  // Blocker / P1 - самый высокий приоритет
  if (normalizedPriority === 'blocker' || normalizedPriority === 'p1') {
    return 10;
  }

  // Critical / Urgent / High / Major / P2 - высокий приоритет
  if (
    normalizedPriority === 'critical' ||
    normalizedPriority === 'urgent' ||
    normalizedPriority === 'high' ||
    normalizedPriority === 'major' ||
    normalizedPriority === 'p2'
  ) {
    return 8;
  }

  // Medium / Normal / P3 - средний приоритет
  if (
    normalizedPriority === 'medium' ||
    normalizedPriority === 'normal' ||
    normalizedPriority === 'p3' ||
    normalizedPriority === 'не указан'
  ) {
    return 5;
  }

  // Low / Minor / P4 - низкий приоритет
  if (
    normalizedPriority === 'low' ||
    normalizedPriority === 'minor' ||
    normalizedPriority === 'p4'
  ) {
    return 2;
  }

  // Trivial / P5 - самый низкий приоритет
  if (normalizedPriority === 'trivial' || normalizedPriority === 'p5') {
    return 1;
  }

  // Если приоритет не распознан, возвращаем 0
  return 0;
}

/**
 * Сортирует задачи: сначала по приоритету (высший приоритет первым), затем по размеру (большие первыми)
 */
export function sortTasksByPriorityAndSize(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Сначала сортируем по приоритету (более высокий приоритет = большее значение)
    const priorityA = getPriorityValue(a.priority);
    const priorityB = getPriorityValue(b.priority);

    if (priorityB !== priorityA) {
      return priorityB - priorityA; // Сначала задачи с более высоким приоритетом
    }

    // Если приоритеты равны, сортируем по размеру (большие задачи первыми)
    const pointsA = getTaskPoints(a);
    const pointsB = getTaskPoints(b);
    return pointsB - pointsA;
  });
}

/**
 * Фильтрует неназначенные задачи для автоматической расстановки
 */
export function filterUnassignedTasks(
  tasks: Task[],
  existingPositions: Map<string, unknown>
): Task[] {
  return tasks.filter(task => {
    // Исключаем QA задачи из основной расстановки (они размещаются позже автоматически)
    if (task.team === 'QA') {
      return false;
    }

    if (existingPositions.has(task.id)) return false;
    if (!task.assignee) return false;
    if (isTaskCompleted(task)) return false;

    // Для dev задач (Back, Web, DevOps) нужен storyPoints > 0
    // Проверяем, что storyPoints определен и больше 0
    const hasStoryPoints = task.storyPoints !== undefined &&
                          task.storyPoints !== null &&
                          typeof task.storyPoints === 'number' &&
                          task.storyPoints > 0;

    if (!hasStoryPoints) {
      return false;
    }

    return true;
  });
}

