import type { Task } from '@/types';

import { v5 as uuidv5 } from 'uuid';

import { isQaOnlyTask } from '@/features/task/utils/taskUtils';

import { mapDevStatusToQAStatus } from './qaStatusMapper';

const QA_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Стандартный namespace для UUID v5

export function buildSyntheticQaTaskId(devTaskId: string): string {
  return uuidv5(`qa-${devTaskId}`, QA_NAMESPACE);
}

/**
 * Создает словарь QA задач из обычных задач
 * QA задачи создаются для задач с testPoints > 0 (независимо от storyPoints)
 */
export function createQATasksMap(tasks: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();

  tasks
    .filter(
      (task) =>
        task.hideTestPointsByIntegration !== true &&
        task.testPoints !== undefined &&
        task.testPoints > 0 &&
        task.team !== 'QA' &&
        !isQaOnlyTask(task)
    )
    .forEach((task) => {
      // Генерируем детерминированный UUID v5 на основе оригинального ID задачи
      const qaTaskId = buildSyntheticQaTaskId(task.id);

      // Маппим статус дев задачи в статус для QA задачи
      const mappedStatus = mapDevStatusToQAStatus(task.originalStatus);

      map.set(task.id, {
        ...task,
        id: qaTaskId, // Уникальный стабильный ID для QA задачи
        name: `[QA] ${task.name}`, // Добавляем префикс [QA] к названию
        storyPoints: 0, // Убираем SP
        team: 'QA' as const, // Помечаем как QA команду
        assignee: task.qaEngineer, // Используем qaEngineer вместо assignee
        assigneeName: task.qaEngineerName, // Используем qaEngineerName
        originalStatus: mappedStatus, // Используем маппированный статус для QA задач
        originalTaskId: task.id, // Сохраняем оригинальный ID дев задачи
        type: task.type, // Сохраняем тип задачи
      });
    });

  return map;
}

