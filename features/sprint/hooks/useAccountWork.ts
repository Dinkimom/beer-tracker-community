/**
 * Хук для учета работы по задаче (account work)
 */

import type { Task } from '@/types';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

import {
  updateIssueWork,
  getIssueTransitions,
  changeIssueStatus,
  getIssue,
  createRelatedIssue,
} from '@/lib/beerTrackerApi';
import { mapStatus } from '@/utils/statusMapper';

interface AccountWorkData {
  burnedStoryPoints: number;
  burnedTestPoints: number;
  newTaskTitle: string;
  remainingStoryPoints: number;
  remainingTestPoints: number;
  targetSprintId: number | null;
}

interface UseAccountWorkProps {
  selectedSprintId: number | null;
  tasks: Task[];
  onTasksReload?: () => Promise<void> | void;
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
}

/**
 * Обновляет задачу в массиве задач
 */
function updateTaskInArray(tasks: Task[], taskId: string, updater: (task: Task) => Task): Task[] {
  return tasks.map((task) => {
    if (task.id === taskId || task.originalTaskId === taskId) {
      return updater(task);
    }
    // Если это QA задача, которая ссылается на обновляемую задачу
    if (task.originalTaskId === taskId) {
      return updater(task);
    }
    return task;
  });
}

/**
 * Находит задачу по ID (включая поиск по originalTaskId для QA задач)
 */
function findTaskById(tasks: Task[], taskId: string): Task | undefined {
  return tasks.find((t) => t.id === taskId || t.originalTaskId === taskId);
}

/**
 * Хук для учета работы
 */
export function useAccountWork({ tasks, selectedSprintId, setTasks, onTasksReload }: UseAccountWorkProps) {
  const handleAccountWork = useCallback(
    async (accountWorkModal: Task, data: AccountWorkData) => {
      if (!selectedSprintId) return;

      const taskId =
        accountWorkModal.team === 'QA' && accountWorkModal.originalTaskId
          ? accountWorkModal.originalTaskId
          : accountWorkModal.id;

      // Находим задачу в локальном состоянии для возможного отката
      const currentTask =
        accountWorkModal.team === 'QA' && accountWorkModal.originalTaskId
          ? findTaskById(tasks, accountWorkModal.originalTaskId)
          : findTaskById(tasks, accountWorkModal.id);
      const actualTaskId = currentTask?.id || accountWorkModal.id;

      try {
        // 1. Обновляем текущую задачу: проставляем сожженные story points и test points
        const updateSuccess = await updateIssueWork(taskId, data.burnedStoryPoints, data.burnedTestPoints);

        if (!updateSuccess) {
          throw new Error('Failed to update work');
        }

        // Обновляем локально story points и test points
        setTasks((prev) =>
          updateTaskInArray(prev, actualTaskId, (task) => {
            if (task.id === actualTaskId) {
              return {
                ...task,
                storyPoints: data.burnedStoryPoints,
                testPoints: data.burnedTestPoints,
              };
            }
            // Если это QA задача, которая ссылается на обновляемую задачу
            if (accountWorkModal.team !== 'QA' && task.originalTaskId === taskId) {
              return {
                ...task,
                testPoints: data.burnedTestPoints,
              };
            }
            return task;
          })
        );

        // 2. Находим переход для закрытия задачи со статусом "closed" и резолюцией "fixed"
        const transitions = await getIssueTransitions(taskId);
        if (transitions.length === 0) {
          throw new Error('Failed to fetch transitions');
        }
        const closeTransition = transitions.find(
          (t: { display?: string; to?: { key?: string } }) =>
            t.to?.key?.toLowerCase() === 'closed' || t.display?.toLowerCase().includes('закрыт')
        );

        if (!closeTransition) {
          throw new Error('Close transition not found');
        }

        // Закрываем задачу с резолюцией "fixed"
        const statusSuccess = await changeIssueStatus(taskId, closeTransition.id, 'fixed');

        if (!statusSuccess) {
          throw new Error('Failed to close task');
        }

        // Синхронизируем статус с API и обновляем локальное состояние
        const issueData = await getIssue(taskId);
        if (issueData) {
          const statusKey = issueData.statusKey || issueData.originalStatus;
          if (statusKey) {
            setTasks((prev) =>
              updateTaskInArray(prev, actualTaskId, (task) => {
                if (task.id === actualTaskId) {
                  return {
                    ...task,
                    originalStatus: statusKey,
                    status: mapStatus(statusKey),
                    storyPoints: data.burnedStoryPoints,
                    testPoints: data.burnedTestPoints,
                  };
                }
                return task;
              })
            );
          }
        } else {
          // Если не удалось получить данные из API, все равно обновляем статус оптимистично
          const targetStatusKey = closeTransition.to?.key || 'closed';
          setTasks((prev) =>
            updateTaskInArray(prev, actualTaskId, (task) => {
              if (task.id === actualTaskId) {
                return {
                  ...task,
                  originalStatus: targetStatusKey,
                  status: mapStatus(targetStatusKey),
                  storyPoints: data.burnedStoryPoints,
                  testPoints: data.burnedTestPoints,
                };
              }
              return task;
            })
          );
        }

        // 3. Создаем новую задачу
        const createResult = await createRelatedIssue(taskId, {
          title: data.newTaskTitle,
          storyPoints: data.remainingStoryPoints ?? undefined,
          testPoints: data.remainingTestPoints ?? undefined,
          sprintId: data.targetSprintId ?? undefined,
          assignee: accountWorkModal.assignee,
          team: accountWorkModal.team,
          priority: accountWorkModal.priority,
          functionalTeam: accountWorkModal.functionalTeam,
          productTeam: accountWorkModal.productTeam,
          stage: accountWorkModal.stage,
          parent:
            typeof accountWorkModal.parent === 'object' && accountWorkModal.parent
              ? accountWorkModal.parent.key
              : accountWorkModal.parent,
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create related task');
        }

        toast.success('Работа учтена');

        // 4. Перезагружаем задачи для обновления списка
        if (onTasksReload) {
          await onTasksReload();
        }
      } catch (error) {
        console.error('Error accounting work:', error);

        // Откатываем изменения статуса в случае ошибки
        if (currentTask) {
          setTasks((prev) =>
            updateTaskInArray(prev, actualTaskId, (task) => {
              if (task.id === actualTaskId) {
                return {
                  ...task,
                  originalStatus: currentTask.originalStatus,
                  status: currentTask.status,
                  storyPoints: currentTask.storyPoints,
                  testPoints: currentTask.testPoints,
                };
              }
              return task;
            })
          );
        }

        throw error;
      }
    },
    [tasks, selectedSprintId, setTasks, onTasksReload]
  );

  return { handleAccountWork };
}

