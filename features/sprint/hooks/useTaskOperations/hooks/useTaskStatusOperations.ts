/**
 * Хук для операций изменения статуса задачи
 */

import type { Task } from '@/types';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

import { mergeTransitionExtraFieldsIntoTask } from '@/features/sprint/utils/mergeTransitionFieldsIntoTask';
import { getIssueTransitions, changeIssueStatus } from '@/lib/beerTrackerApi';
import { mapStatus } from '@/utils/statusMapper';

import { findTaskById, updateTaskInArray } from '../utils/taskUtils';
import { getTaskTrackerDisplayKey } from '@/features/task/utils/taskUtils';

interface UseTaskStatusOperationsProps {
  tasks: Task[];
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
}

export function useTaskStatusOperations({
  tasks,
  setTasks,
}: UseTaskStatusOperationsProps) {
  const changeStatus = useCallback(
    async (
      taskId: string,
      transitionId: string,
      targetStatusKey?: string,
      extraFields?: Record<string, unknown>
    ) => {
      const currentTask = findTaskById(tasks, taskId);
      if (!currentTask) {
        console.error('Task not found:', taskId);
        return;
      }

      // В Tracker для запросов переходов/статуса нужен issue key.
      // Для QA-псевдо/синтетических задач в UI может прилетать "внутренний" id,
      // поэтому берём tracker key из originalTaskId.
      const trackerIssueKey = getTaskTrackerDisplayKey(currentTask);

      // Определяем целевой статус
      let finalTargetStatusKey: string | null = targetStatusKey || null;
      let transitionData: { to?: { key?: string } } | null = null;

      if (!finalTargetStatusKey) {
        try {
          const transitions = await getIssueTransitions(trackerIssueKey);
          transitionData = Array.isArray(transitions)
            ? transitions.find(
                (t: { id?: string; key?: string; to?: { key?: string } }) =>
                  t.id === transitionId || t.key === transitionId
              ) || null
            : null;
          if (transitionData?.to?.key) {
            finalTargetStatusKey = transitionData.to.key;
          }
        } catch (error) {
          console.error('Failed to fetch transitions:', error);
        }
      }

      if (!finalTargetStatusKey) {
        console.error('Cannot determine target status for transition:', transitionId);
        return;
      }

      // Определяем, является ли переход закрытием задачи
      const isClosing =
        finalTargetStatusKey.toLowerCase() === 'closed' ||
        transitionId.toLowerCase().includes('closed') ||
        transitionData?.to?.key?.toLowerCase() === 'closed';

      const fromTransition = mergeTransitionExtraFieldsIntoTask(extraFields);

      // Оптимистично обновляем статус и поля экрана перехода (SP/TP, спринт и т.д.)
      setTasks((prev) =>
        updateTaskInArray(prev, taskId, (task) => ({
          ...task,
          originalStatus: finalTargetStatusKey!,
          status: mapStatus(finalTargetStatusKey!),
          ...fromTransition,
        }))
      );

      // Асинхронно отправляем запрос на изменение статуса
      try {
        const resolution = isClosing ? 'fixed' : undefined;
        const success = await changeIssueStatus(trackerIssueKey, transitionId, resolution, extraFields);

        if (!success) {
          throw new Error(`Failed to change status for task ${taskId}`);
        }

        toast.success('Статус изменен');

        // Целиком задачу с сервера не подменяем: getIssue может отставать от Tracker.
        // Поля из модалки уже смержены оптимистично из extraFields (то же тело, что ушло в Tracker).
      } catch (error) {
        console.error('Error changing status:', error);
        // Полный откат: статус и поля из модалки (SP/TP и т.д.)
        setTasks((prev) =>
          updateTaskInArray(prev, taskId, () => ({ ...currentTask }))
        );
      }
    },
    [tasks, setTasks]
  );

  return {
    changeStatus,
  };
}

