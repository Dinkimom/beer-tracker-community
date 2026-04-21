/**
 * Хук для обработчиков автоматической расстановки задач в SprintPlanner
 */

import type { Developer, Task, TaskPosition } from '@/types';

import { useCallback, type MutableRefObject } from 'react';

import { PARTS_PER_DAY } from '@/constants';
import { autoAssignTasks } from '@/features/task/utils/autoAssignTasks';
import {
  clearSprintPositions,
  clearSprintLinks,
  saveTaskPositionsBatch,
  saveTaskLinksBatch,
} from '@/lib/beerTrackerApi';
import { DELAYS } from '@/utils/constants';
import { getCurrentSprintCell } from '@/utils/dateUtils';

interface UseSprintPlannerAutoAssignHandlersProps {
  allTasksForDrag: Task[];
  developersManagement: {
    sortedDevelopers: Developer[];
  };
  qaTasksByOriginalId: Map<string, Task>;
  qaTasksMap: Map<string, Task>;
  resetDragStateRef: MutableRefObject<(() => void) | null>;
  selectedSprintId: number | null;
  sprintStartDate: Date;
  taskPositions: Map<string, TaskPosition>;
  tasksMap: Map<string, Task>;
  confirm: (message: string, options?: {
    title?: string;
    variant?: 'default' | 'destructive';
  }) => Promise<boolean>;
  debouncedUpdateXarrow: () => void;
  saveLink: (link: { fromTaskId: string; toTaskId: string; id: string }) => Promise<void>;
  savePosition: (position: TaskPosition, isQa: boolean) => Promise<void>;
  setTaskLinks: (updater: (prev: Array<{
    fromTaskId: string;
    toTaskId: string;
    id: string;
  }>) => Array<{
    fromTaskId: string;
    toTaskId: string;
    id: string;
  }>) => void;
  setTaskPositions: (updater: (prev: Map<string, TaskPosition>) => Map<string, TaskPosition>) => void;
}

export function useSprintPlannerAutoAssignHandlers({
  allTasksForDrag,
  developersManagement,
  resetDragStateRef,
  qaTasksByOriginalId,
  qaTasksMap,
  selectedSprintId,
  setTaskLinks,
  setTaskPositions,
  sprintStartDate,
  taskPositions,
  tasksMap,
  confirm,
  debouncedUpdateXarrow,
}: UseSprintPlannerAutoAssignHandlersProps) {
  const handleAutoAssignTasks = useCallback(async () => {
    if (taskPositions.size > 0) {
      const confirmed = await confirm(
        'Автоматическая расстановка приведет к удалению всех текущих задач на swimlane и их повторной расстановке. Продолжить?',
        {
          title: 'Подтверждение автоматической расстановки',
          variant: 'default',
        }
      );
      if (!confirmed) {
        return;
      }
    }

    if (!selectedSprintId) {
      return;
    }

    setTaskPositions(() => new Map());
    setTaskLinks(() => []);

    const currentCell = getCurrentSprintCell(sprintStartDate, PARTS_PER_DAY);
    const result = autoAssignTasks(
      allTasksForDrag,
      developersManagement.sortedDevelopers,
      new Map(),
      qaTasksMap,
      [],
      currentCell
    );

    // Устанавливаем позиции и связи в состояние
    setTaskPositions(() => result.positions);
    setTaskLinks(() => result.links as Array<{
      fromTaskId: string;
      toTaskId: string;
      id: string;
    }>);

    // Сохраняем все позиции и связи через батч endpoints
    try {
      // Подготавливаем данные для батч сохранения позиций
      const positionsArray = Array.from(result.positions.entries()).map(([taskId, position]) => {
        const task = tasksMap.get(taskId) || qaTasksByOriginalId.get(taskId);
        const isQa = task?.team === 'QA' || false;
        return {
          taskId: position.taskId,
          assigneeId: position.assignee,
          startDay: position.startDay,
          startPart: position.startPart,
          duration: position.duration,
          plannedStartDay: position.plannedStartDay ?? null,
          plannedStartPart: position.plannedStartPart ?? null,
          plannedDuration: position.plannedDuration ?? null,
          isQa,
          ...(isQa && task?.originalTaskId && { devTaskKey: task.originalTaskId }),
          debugSource: 'useSprintPlannerAutoAssignHandlers.handleAutoAssignTasks',
        };
      });

      // Подготавливаем данные для батч сохранения связей
      const linksArray = result.links.map((link) => ({
        id: link.id,
        fromTaskId: link.fromTaskId,
        toTaskId: link.toTaskId,
        fromAnchor: link.fromAnchor || null,
        toAnchor: link.toAnchor || null,
      }));

      // Сохраняем позиции и связи параллельно через батч endpoints
      await Promise.all([
        positionsArray.length > 0
          ? saveTaskPositionsBatch(selectedSprintId, positionsArray)
          : Promise.resolve({ success: true, count: 0 }),
        linksArray.length > 0
          ? saveTaskLinksBatch(selectedSprintId, linksArray)
          : Promise.resolve({ success: true, count: 0 }),
      ]);
    } catch (error) {
      console.error('Error saving auto-assigned positions and links:', error);
    }

    setTimeout(() => debouncedUpdateXarrow(), DELAYS.ARROW_UPDATE);
  }, [
    confirm,
    taskPositions.size,
    selectedSprintId,
    setTaskPositions,
    setTaskLinks,
    sprintStartDate,
    allTasksForDrag,
    developersManagement.sortedDevelopers,
    qaTasksMap,
    tasksMap,
    qaTasksByOriginalId,
    debouncedUpdateXarrow,
  ]);

  const handleReturnAllTasks = useCallback(
    async () => {
      if (!selectedSprintId) return;

      resetDragStateRef.current?.();

      setTaskPositions(() => new Map());
      setTaskLinks(() => []);

      try {
        await Promise.all([
          clearSprintPositions(selectedSprintId),
          clearSprintLinks(selectedSprintId),
        ]);
      } catch (error) {
        console.error('Error clearing positions and links:', error);
      }

      setTimeout(() => debouncedUpdateXarrow(), DELAYS.ARROW_UPDATE);
    },
    [selectedSprintId, resetDragStateRef, setTaskPositions, setTaskLinks, debouncedUpdateXarrow]
  );

  return {
    handleAutoAssignTasks,
    handleReturnAllTasks,
  };
}

