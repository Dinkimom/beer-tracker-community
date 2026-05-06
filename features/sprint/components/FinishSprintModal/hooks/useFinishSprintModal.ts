/**
 * Хук для управления логикой завершения спринта
 */

import type { MoveTasksTo, Task } from '@/types';
import type { ChecklistItem, SprintInfo } from '@/types/tracker';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { updateSprintGoal } from '@/lib/api/sprintGoals';
import {
  updateChecklistItem,
  updateSprintStatus,
  removeIssueFromAllSprints,
  addIssueToSprint,
  getIssueTransitions,
  changeIssueStatus,
} from '@/lib/beerTrackerApi';

const STORAGE_KEY = 'finish-sprint-selected-chat';

type ChecklistItemWithGoalId = ChecklistItem & { goalTaskId?: string; goalSource?: 'sprint_goals' | 'tracker' };

export function isTaskClosedForSprintFinish(task: Task): boolean {
  return (task.originalStatus ?? '').trim().toLowerCase() === 'closed';
}

export function getTasksToMoveOnSprintFinish(tasks: Task[], goalTaskIds: Set<string>): Task[] {
  return tasks.filter(task => {
    if (goalTaskIds.has(task.id)) return false;
    return !isTaskClosedForSprintFinish(task);
  });
}

interface UseFinishSprintModalProps {
  /** id — ключ задачи в Tracker; для целей из sprint_goals id синтетический (delivery/discovery) — закрытие задачи в Tracker не вызываем */
  goalTasks: Array<{ id: string; source?: 'sprint_goals' | 'tracker' }>;
  initialChecklistItems: ChecklistItemWithGoalId[];
  isOpen: boolean;
  sprintInfo: {
    id: number;
    status: string;
    version?: number;
  } | null;
  tasks: Task[];
  onSprintStatusChange?: (updatedSprint: SprintInfo) => void;
  onTasksReload?: () => void;
}

export function useFinishSprintModal({
  goalTasks,
  initialChecklistItems,
  sprintInfo,
  tasks,
  isOpen,
  onSprintStatusChange,
  onTasksReload,
}: UseFinishSprintModalProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItemWithGoalId[]>(initialChecklistItems);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [moveTasksTo, setMoveTasksTo] = useState<MoveTasksTo>('backlog');
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [sendToChat, setSendToChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Обновляем список целей при открытии модалки
  useEffect(() => {
    if (isOpen) {
      setChecklistItems(initialChecklistItems);
    }
  }, [isOpen, initialChecklistItems]);

  // Загружаем сохраненный чат из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedChat(saved);
      }
    }
  }, []);

  // Сохраняем выбранный чат в localStorage
  useEffect(() => {
    if (selectedChat && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, selectedChat);
    }
  }, [selectedChat]);

  const handleCheckboxChange = useCallback(async (itemId: string, checked: boolean) => {
    if (updatingItems.has(itemId)) return;
    const item = checklistItems.find((i) => i.id === itemId);
    const goalTaskId = item?.goalTaskId;
    const goalSource = item?.goalSource ?? 'tracker';
    if (!goalTaskId && goalSource !== 'sprint_goals') return;

    setUpdatingItems(prev => new Set(prev).add(itemId));
    setChecklistItems(prev =>
      prev.map(it =>
        it.id === itemId ? { ...it, checked } : it
      )
    );

    try {
      const success =
        goalSource === 'sprint_goals'
          ? await updateSprintGoal(itemId, { checked })
          : await updateChecklistItem(goalTaskId!, itemId, checked);
      if (!success) {
        setChecklistItems(prev =>
          prev.map(it =>
            it.id === itemId ? { ...it, checked: !checked } : it
          )
        );
        toast.error('Не удалось обновить цель');
      }
    } catch (err) {
      console.error('Failed to update checkbox:', err);
      setChecklistItems(prev =>
        prev.map(it =>
          it.id === itemId ? { ...it, checked: !checked } : it
        )
      );
      toast.error('Не удалось обновить цель');
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [checklistItems, updatingItems]);

  const handleSubmit = useCallback(async () => {
    if (!sprintInfo) return;

    if (moveTasksTo === 'sprint' && !selectedSprintId) {
      toast.error('Необходимо выбрать спринт для переноса задач');
      return;
    }

    if (sendToChat && !selectedChat.trim()) {
      toast.error('Необходимо указать чат для отправки');
      return;
    }

    setIsLoading(true);
    try {
      const goalIdSet = new Set(goalTasks.map(g => g.id));
      const unfinishedTasks = getTasksToMoveOnSprintFinish(tasks, goalIdSet);

      // Переносим задачи
      if (unfinishedTasks.length > 0) {
        if (moveTasksTo === 'backlog') {
          const moveResults = await Promise.allSettled(
            unfinishedTasks.map(task => removeIssueFromAllSprints(task.id))
          );

          const failedMoves = moveResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
          if (failedMoves.length > 0) {
            console.error('Failed to move some tasks to backlog:', failedMoves);
          }
        } else if (moveTasksTo === 'sprint' && selectedSprintId) {
          const moveResults = await Promise.allSettled(
            unfinishedTasks.map(task => addIssueToSprint(task.id, selectedSprintId))
          );

          const failedMoves = moveResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
          if (failedMoves.length > 0) {
            console.error('Failed to move some tasks to sprint:', failedMoves);
          }
        }
      }

      for (const goalTask of goalTasks) {
        if (goalTask.source === 'sprint_goals') continue;

        try {
          const transitions = await getIssueTransitions(goalTask.id);
          if (transitions.length > 0) {
            const closeTransition = transitions.find((t: { display?: string, to?: { key?: string }; }) =>
              t.to?.key?.toLowerCase() === 'closed' ||
              t.display?.toLowerCase().includes('закрыт')
            );

            if (closeTransition) {
              const closeSuccess = await changeIssueStatus(goalTask.id, closeTransition.id, 'fixed');
              if (!closeSuccess) {
                console.error('Failed to close goal task:', goalTask.id);
              }
            } else {
              console.warn('Close transition not found for goal task:', goalTask.id);
            }
          }
        } catch (error) {
          console.error('Failed to close goal task:', error);
        }
      }

      // Завершаем спринт
      const result = await updateSprintStatus(
        sprintInfo.id,
        'archived',
        sprintInfo.version
      );

      if (!result.success) {
        toast.error(result.error || 'Не удалось завершить спринт');
        return;
      }

      toast.success('Спринт закрыт');

      if (result.sprint && onSprintStatusChange) {
        onSprintStatusChange(result.sprint);
      }
      if (onTasksReload) {
        onTasksReload();
      }
    } catch (error) {
      console.error('Failed to finish sprint:', error);
      toast.error('Не удалось завершить спринт');
    } finally {
      setIsLoading(false);
    }
  }, [
    sprintInfo,
    moveTasksTo,
    selectedSprintId,
    sendToChat,
    selectedChat,
    tasks,
    goalTasks,
    onSprintStatusChange,
    onTasksReload,
  ]);

  return {
    checklistItems,
    updatingItems,
    moveTasksTo,
    setMoveTasksTo,
    selectedSprintId,
    setSelectedSprintId,
    sendToChat,
    setSendToChat,
    selectedChat,
    setSelectedChat,
    isLoading,
    handleCheckboxChange,
    handleSubmit,
  };
}

