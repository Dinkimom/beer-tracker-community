'use client';

import type { Task } from '@/types';

import { useCallback, useState } from 'react';

import { findTaskById } from '@/features/sprint/hooks/useTaskOperations/utils/taskUtils';
import { getTaskTrackerDisplayKey } from '@/features/task/utils/taskUtils';
import { fetchScreenFields, getTransitionFields, type TransitionField } from '@/lib/beerTrackerApi';

interface TransitionModalState {
  fields: TransitionField[];
  targetStatusDisplay?: string;
  targetStatusKey: string;
  task?: Task;
  taskId: string;
  transitionId: string;
}

/** typeKey -> transitionId -> fields (данные, полученные при монтировании) */
type WorkflowScreens = Record<string, Record<string, TransitionField[]>>;

interface UseTransitionModalProps {
  tasks: Task[];
  /** Экранные поля переходов для очереди (если есть — показываем модалку локально) */
  workflowScreens?: WorkflowScreens;
  changeStatus: (taskId: string, transitionId: string, targetStatusKey?: string, extraFields?: Record<string, unknown>) => Promise<void>;
}

export function useTransitionModal({
  tasks,
  changeStatus,
  workflowScreens = {},
}: UseTransitionModalProps) {
  const [transitionModal, setTransitionModal] = useState<TransitionModalState | null>(null);

  const closeTransitionModal = useCallback(() => {
    setTransitionModal(null);
  }, []);

  const handleStatusChangeWithModal = useCallback(
    async (
      taskId: string,
      transitionId: string,
      targetStatusKey?: string,
      targetStatusDisplay?: string,
      screenId?: string
    ) => {
      const task = findTaskById(tasks, taskId);
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }
      const finalTargetStatusKey = targetStatusKey || '';

      const typeKey = task.type ?? 'task';
      const byType = workflowScreens[typeKey] ?? workflowScreens['task'];
      const cached = byType?.[transitionId] ?? [];
      const skipFetch = cached.length > 0 && !cached.some((f) => f.required);

      const trackerIssueKey = getTaskTrackerDisplayKey(task);

      // Enriched-поля (schemaType, options для select) — когда нужна модалка или нет кэша
      const fields: TransitionField[] = skipFetch
        ? cached
        : screenId
          ? await fetchScreenFields(screenId)
          : await getTransitionFields(trackerIssueKey, transitionId);

      if (fields.some((f) => f.required)) {
        setTransitionModal({
          taskId,
          transitionId,
          targetStatusKey: finalTargetStatusKey,
          targetStatusDisplay,
          fields,
          task,
        });
        return;
      }

      await changeStatus(taskId, transitionId, finalTargetStatusKey);
    },
    [tasks, changeStatus, workflowScreens]
  );

  const handleTransitionSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      if (!transitionModal) return;

      const { taskId, transitionId, targetStatusKey } = transitionModal;
      await changeStatus(taskId, transitionId, targetStatusKey, values);
      closeTransitionModal();
    },
    [transitionModal, changeStatus, closeTransitionModal]
  );

  return {
    transitionModal,
    handleStatusChangeWithModal,
    closeTransitionModal,
    handleTransitionSubmit,
  };
}
