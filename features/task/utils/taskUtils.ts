/**
 * Утилиты для работы с задачами
 */

import type { Task } from '@/types';
import type { TaskStatus } from '@/utils/statusMapper';

import { mapStatus } from '@/utils/statusMapper';

/**
 * Задача в состоянии «готово» — та же логика, что в метриках спринта / раскраске статусов (см. isTaskDone).
 */
export function isTaskCompleted(task: Task): boolean {
  const effective: TaskStatus =
    task.status ?? mapStatus(task.originalStatus || '') ?? 'todo';
  return effective === 'done';
}

/**
 * Получает ссылку на родительскую задачу
 */
/** Ключ задачи в Трекере для отображения и ссылок (учитывает синтетическую QA-строку). */
export function getTaskTrackerDisplayKey(task: Task): string {
  return String(task.originalTaskId ?? task.id);
}

/** URL задачи в Яндекс Трекере. */
export function getTaskTrackerIssueUrl(task: Task): string {
  const trimmed = task.link?.trim() ?? '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://tracker.yandex.ru/${getTaskTrackerDisplayKey(task)}`;
}

/**
 * Задача фактически является КУА-задачей: 0 СП и > 0 ТП.
 * Нет объёма разработки — только тестирование.
 * Такую задачу не нужно дублировать синтетической QA-задачей,
 * а фаза считается по ТП.
 */
export function isQaOnlyTask(task: Task): boolean {
  return (
    (!task.storyPoints || task.storyPoints === 0) &&
    task.testPoints != null &&
    task.testPoints > 0 &&
    task.team !== 'QA'
  );
}

/**
 * Задача "эффективно" является QA-задачей:
 * - либо команда явно QA,
 * - либо это чистая QA-задача по критерию 0 SP и > 0 TP.
 * Используем везде, где нужна логика "задача куа".
 */
export function isEffectivelyQaTask(task: Task): boolean {
  return task.team === 'QA' || task.testingOnlyByIntegrationRules === true || isQaOnlyTask(task);
}

/**
 * Получает длительность задачи в частях дня на основе storyPoints или testPoints
 * Для QA задач использует testPoints, для остальных - storyPoints
 */
export function getTaskPoints(task: Task): number {
  if (task.team === 'QA') {
    return task.testPoints || 1;
  }
  if (task.testingOnlyByIntegrationRules === true) {
    if (task.testPoints != null && task.testPoints > 0) {
      return task.testPoints;
    }
    return task.storyPoints || 1;
  }
  if (isQaOnlyTask(task)) {
    return task.testPoints || 1;
  }
  return task.storyPoints || 1;
}
