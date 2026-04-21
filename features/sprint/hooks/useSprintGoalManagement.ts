'use client';

import type { QueryClient } from '@tanstack/react-query';

import { useState } from 'react';
import toast from 'react-hot-toast';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { useBoards } from '@/features/board/hooks/useBoards';
import {
  createSprintGoal,
  updateSprintGoal,
  deleteSprintGoal,
} from '@/lib/api/sprintGoals';

interface UseSprintGoalManagementProps {
  /** ID доски — используется для подстановки команды (team) при создании цели */
  boardId?: number | null;
  goalType: 'delivery' | 'discovery';
  queryClient?: QueryClient | null;
  sprintId: number | null;
  onGoalsUpdate?: () => void;
}

interface GoalsData {
  checklistDone: number;
  checklistItems: Array<{ id: string; text: string; checked: boolean; checklistItemType: string }>;
  checklistTotal: number;
}

export function useSprintGoalManagement({
  goalType,
  sprintId,
  boardId = null,
  queryClient = null,
  onGoalsUpdate,
}: UseSprintGoalManagementProps) {
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const { getTeamByBoardId } = useBoards();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();

  const queryKey = forDemoPlanner
    ? (['sprintGoals', 'demo', sprintId, goalType] as const)
    : (['sprintGoals', sprintId, goalType] as const);

  const invalidateSprintScore = () => {
    if (queryClient && sprintId != null && sprintId > 0) {
      const scoreKey = forDemoPlanner
        ? (['sprintScore', 'demo', sprintId] as const)
        : (['sprintScore', sprintId] as const);
      queryClient.invalidateQueries({ queryKey: scoreKey }).catch(() => {
        /* invalidate не критичен для UX целей */
      });
    }
  };

  const handleCheckboxChange = async (itemId: string, checked: boolean): Promise<void> => {
    if (updatingItems.has(itemId)) return;

    setUpdatingItems(prev => new Set(prev).add(itemId));

    let prevGoalsData: GoalsData | undefined;
    if (queryClient) {
      prevGoalsData = queryClient.getQueryData<GoalsData>(queryKey);
      queryClient.setQueryData<GoalsData>(queryKey, (old) => {
        if (!old?.checklistItems) return old;
        const nextItems = old.checklistItems.map((it) =>
          it.id === itemId ? { ...it, checked } : it
        );
        const checklistDone = nextItems.filter((it) => it.checked).length;
        return { ...old, checklistItems: nextItems, checklistDone };
      });
    }

    try {
      const success = await updateSprintGoal(itemId, { checked });
      if (success) {
        invalidateSprintScore();
        if (!queryClient) onGoalsUpdate?.();
      }
      if (!success && queryClient && prevGoalsData !== undefined) {
        queryClient.setQueryData(queryKey, prevGoalsData);
      } else if (!success && queryClient) {
        queryClient.removeQueries({ queryKey });
      }
    } catch (err) {
      if (queryClient && prevGoalsData !== undefined) {
        queryClient.setQueryData(queryKey, prevGoalsData);
      } else if (queryClient) {
        queryClient.removeQueries({ queryKey });
      }
      console.error('Failed to update checkbox:', err);
      throw err;
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleAddGoal = async (text: string): Promise<void> => {
    if (sprintId == null) {
      throw new Error('Sprint must be selected');
    }

    setUpdatingItems(prev => new Set(prev).add('new'));

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimisticItem = {
      id: tempId,
      text,
      checked: false,
      checklistItemType: 'standard',
    };
    let prevGoalsData: GoalsData | undefined;

    if (queryClient) {
      prevGoalsData = queryClient.getQueryData<GoalsData>(queryKey);
      queryClient.setQueryData<GoalsData>(queryKey, (old) => {
        const items = old?.checklistItems ?? [];
        const total = old?.checklistTotal ?? items.length;
        return {
          ...old,
          checklistItems: [...items, optimisticItem],
          checklistTotal: total + 1,
          checklistDone: old?.checklistDone ?? 0,
        } as GoalsData;
      });
    }

    try {
      const team = boardId != null ? getTeamByBoardId(boardId) ?? undefined : undefined;
      const result = await createSprintGoal({
        sprintId,
        goalType,
        text,
        team,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add goal');
      }

      if (queryClient && result.item) {
        const current = queryClient.getQueryData<GoalsData>(queryKey);
        const tempStillInList = current?.checklistItems?.some((it) => it.id === tempId);
        if (tempStillInList) {
          queryClient.setQueryData<GoalsData>(queryKey, (old) => {
            if (!old) return old;
            const itemWithText = result.item!.text?.trim()
              ? result.item!
              : { ...result.item!, text };
            return {
              ...old,
              checklistItems: old.checklistItems.map((it) =>
                it.id === tempId ? itemWithText : it
              ),
            };
          });
        } else {
          if (result.item?.id) void deleteSprintGoal(result.item.id);
        }
        invalidateSprintScore();
      } else {
        onGoalsUpdate?.();
      }
    } catch (err) {
      if (queryClient && prevGoalsData !== undefined) {
        queryClient.setQueryData(queryKey, prevGoalsData);
      } else if (queryClient) {
        queryClient.removeQueries({ queryKey });
      }
      console.error('Failed to add goal:', err);
      throw err;
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete('new');
        return next;
      });
    }
  };

  const handleEditGoal = async (itemId: string, text: string): Promise<void> => {
    setUpdatingItems(prev => new Set(prev).add(itemId));

    let prevGoalsData: GoalsData | undefined;
    if (queryClient) {
      prevGoalsData = queryClient.getQueryData<GoalsData>(queryKey);
      queryClient.setQueryData<GoalsData>(queryKey, (old) => {
        if (!old?.checklistItems) return old;
        return {
          ...old,
          checklistItems: old.checklistItems.map((it) =>
            it.id === itemId ? { ...it, text } : it
          ),
        };
      });
    }

    try {
      const success = await updateSprintGoal(itemId, { text });
      if (!success) throw new Error('Failed to edit goal');
      if (!queryClient) onGoalsUpdate?.();
    } catch (err) {
      if (queryClient && prevGoalsData !== undefined) {
        queryClient.setQueryData(queryKey, prevGoalsData);
      } else if (queryClient) {
        queryClient.removeQueries({ queryKey });
      }
      console.error('Failed to edit goal:', err);
      throw err;
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDeleteGoal = async (itemId: string): Promise<void> => {
    if (updatingItems.has(itemId)) return;

    const isTempId = itemId.startsWith('temp-');
    setUpdatingItems(prev => new Set(prev).add(itemId));

    let prevGoalsData: GoalsData | undefined;
    if (queryClient) {
      prevGoalsData = queryClient.getQueryData<GoalsData>(queryKey);
      queryClient.setQueryData<GoalsData>(queryKey, (old) => {
        if (!old?.checklistItems) return old;
        const nextItems = old.checklistItems.filter((it) => it.id !== itemId);
        const checklistDone = nextItems.filter((it) => it.checked).length;
        return {
          ...old,
          checklistItems: nextItems,
          checklistTotal: nextItems.length,
          checklistDone,
        };
      });
    }

    if (isTempId) {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      return;
    }

    try {
      const result = await deleteSprintGoal(itemId);
      if (result.success || result.notFound) {
        invalidateSprintScore();
        if (!queryClient) onGoalsUpdate?.();
      } else {
        toast.error('Не удалось удалить цель на сервере, она убрана только локально');
      }
    } catch (err) {
      if (queryClient && prevGoalsData !== undefined) {
        queryClient.setQueryData(queryKey, prevGoalsData);
      } else if (queryClient) {
        queryClient.removeQueries({ queryKey });
      }
      console.error('Failed to delete goal:', err);
      throw err;
    } finally {
      setUpdatingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  return {
    updatingItems,
    handleCheckboxChange,
    handleAddGoal,
    handleEditGoal,
    handleDeleteGoal,
  };
}
