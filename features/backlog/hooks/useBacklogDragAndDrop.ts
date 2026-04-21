/**
 * Хук для управления drag-and-drop операциями в бэклоге
 */

import type { Developer, Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { QueryClient } from '@tanstack/react-query';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { useI18n } from '@/contexts/LanguageContext';
import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { sprintTasksQueryKey } from '@/features/task/hooks/useTasks';
import { addIssueToSprint, removeIssueFromSprint } from '@/lib/beerTrackerApi';

import { findTaskInSprints, getSprintTasksData, type SprintTasksBundle } from './backlogDragAndDropHelpers';

interface UseBacklogDragAndDropProps {
  activeSprints: SprintListItem[];
  backlogDevelopers: Developer[];
  backlogTasks: Task[];
  boardId: number | null;
  addTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
}

interface UseBacklogDragAndDropResult {
  activeTaskId: string | null;
  isMovingTask: boolean;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleDragStart: (event: DragStartEvent) => void;
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

async function moveTaskToBacklog(opts: {
  addTask: (task: Task) => void;
  boardId: number | null;
  forDemoPlanner: boolean;
  queryClient: QueryClient;
  removeTask: (taskId: string) => void;
  sourceSprintId: number;
  t: TranslateFn;
  taskId: string;
  taskToMove: Task;
}): Promise<void> {
  const { queryClient, boardId, taskId, sourceSprintId, taskToMove, addTask, removeTask, forDemoPlanner, t } =
    opts;

  const oldSourceSprintData = getSprintTasksData(queryClient, sourceSprintId, boardId, forDemoPlanner);

  addTask(taskToMove);
  queryClient.setQueryData<SprintTasksBundle>(sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner), (old) => {
    if (!old) return old;
    return {
      ...old,
      tasks: old.tasks.filter((t) => t.id !== taskId),
    };
  });

  try {
    await removeIssueFromSprint(taskId, sourceSprintId);
    // Аналогично moveTaskToSprint: не refetch бэклога сразу — optimistic addTask уже обновил кэш.
    toast.success(t('backlog.dnd.movedToBacklog'));
  } catch (error) {
    removeTask(taskId);
    if (oldSourceSprintData) {
      queryClient.setQueryData(sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner), oldSourceSprintData);
    } else {
      queryClient.invalidateQueries({ queryKey: sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner) });
    }
    const errorMessage = error instanceof Error ? error.message : t('common.unknownError');
    toast.error(t('backlog.dnd.moveError', { message: errorMessage }));
    throw error;
  }
}

async function moveTaskToSprint(opts: {
  addTask: (task: Task) => void;
  backlogDevelopers: Developer[];
  boardId: number | null;
  forDemoPlanner: boolean;
  queryClient: QueryClient;
  removeTask: (taskId: string) => void;
  sourceSprintId: number | null;
  t: TranslateFn;
  targetSprintId: number;
  taskId: string;
  taskToMove: Task;
  wasInBacklog: boolean;
}): Promise<void> {
  const {
    queryClient,
    boardId,
    taskId,
    sourceSprintId,
    targetSprintId,
    taskToMove,
    wasInBacklog,
    backlogDevelopers,
    addTask,
    removeTask,
    forDemoPlanner,
    t,
  } = opts;

  let oldSourceSprintData: SprintTasksBundle | undefined;
  if (sourceSprintId !== null) {
    oldSourceSprintData = getSprintTasksData(queryClient, sourceSprintId, boardId, forDemoPlanner);
  }
  const oldTargetSprintData = getSprintTasksData(queryClient, targetSprintId, boardId, forDemoPlanner);

  if (wasInBacklog) {
    removeTask(taskId);
  }

  if (sourceSprintId !== null && sourceSprintId !== targetSprintId) {
    queryClient.setQueryData<SprintTasksBundle>(sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner), (old) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter((t) => t.id !== taskId),
      };
    });
  }

  queryClient.setQueryData<SprintTasksBundle>(sprintTasksQueryKey(targetSprintId, boardId, forDemoPlanner), (old) => {
    if (!old) {
      return {
        developers: backlogDevelopers,
        sprintInfo: null,
        tasks: [taskToMove],
      };
    }
    if (old.tasks.some((t) => t.id === taskId)) {
      return old;
    }
    return {
      ...old,
      tasks: [...old.tasks, taskToMove],
    };
  });

  try {
    if (sourceSprintId !== null && sourceSprintId !== targetSprintId) {
      await removeIssueFromSprint(taskId, sourceSprintId);
    }
    await addIssueToSprint(taskId, targetSprintId);
    // Не инвалидируем бэклог здесь: refetch даёт устаревший список (кэш BFF до 30 с / индекс Трекера),
    // из‑за чего задача снова появляется в колонке бэклога рядом со спринтом. Достаточно optimistic removeTask.
    toast.success(t('backlog.dnd.movedToSprint'));
  } catch (error) {
    if (wasInBacklog) {
      addTask(taskToMove);
    }
    if (oldSourceSprintData && sourceSprintId !== null) {
      queryClient.setQueryData(sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner), oldSourceSprintData);
    } else if (sourceSprintId !== null) {
      queryClient.invalidateQueries({ queryKey: sprintTasksQueryKey(sourceSprintId, boardId, forDemoPlanner) });
    }
    if (oldTargetSprintData) {
      queryClient.setQueryData(sprintTasksQueryKey(targetSprintId, boardId, forDemoPlanner), oldTargetSprintData);
    } else {
      queryClient.invalidateQueries({ queryKey: sprintTasksQueryKey(targetSprintId, boardId, forDemoPlanner) });
    }
    const errorMessage = error instanceof Error ? error.message : t('common.unknownError');
    toast.error(t('backlog.dnd.moveError', { message: errorMessage }));
    throw error;
  }
}

/**
 * Управляет логикой drag-and-drop для перемещения задач между бэклогом и спринтами
 */
export function useBacklogDragAndDrop({
  activeSprints,
  boardId,
  backlogTasks,
  backlogDevelopers,
  addTask,
  removeTask,
}: UseBacklogDragAndDropProps): UseBacklogDragAndDropResult {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isMovingTask, setIsMovingTask] = useState(false);
  const isMovingRef = useRef(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTaskId(null);
      const { active, over } = event;

      if (!over || isMovingRef.current) return;

      const taskId = active.id as string;
      const targetId = over.id as string;

      const fromSprint = findTaskInSprints(queryClient, taskId, activeSprints, boardId, forDemoPlanner);
      let taskToMove: Task | undefined = fromSprint?.task;
      const sourceSprintId: number | null = fromSprint ? fromSprint.sourceSprintId : null;

      if (!taskToMove) {
        taskToMove = backlogTasks.find((t) => t.id === taskId);
      }

      if (!taskToMove) {
        toast.error(t('backlog.dnd.taskNotFound'));
        return;
      }

      const wasInBacklog = !sourceSprintId && backlogTasks.some((t) => t.id === taskId);

      setIsMovingTask(true);
      isMovingRef.current = true;
      try {
        if (targetId === 'backlog-column') {
          if (!sourceSprintId) {
            return;
          }
          await moveTaskToBacklog({
            addTask,
            boardId,
            forDemoPlanner,
            queryClient,
            removeTask,
            sourceSprintId,
            t,
            taskId,
            taskToMove,
          });
        } else if (targetId.startsWith('sprint-column-')) {
          const targetSprintId = parseInt(targetId.replace('sprint-column-', ''), 10);
          if (Number.isNaN(targetSprintId)) {
            toast.error(t('backlog.dnd.invalidSprintId'));
            return;
          }
          if (sourceSprintId === targetSprintId) {
            return;
          }
          await moveTaskToSprint({
            addTask,
            backlogDevelopers,
            boardId,
            forDemoPlanner,
            queryClient,
            removeTask,
            sourceSprintId,
            t,
            targetSprintId,
            taskId,
            taskToMove,
            wasInBacklog,
          });
        }
      } catch (error) {
        console.error('Error moving task:', error);
      } finally {
        setIsMovingTask(false);
        isMovingRef.current = false;
      }
    },
    [activeSprints, addTask, boardId, backlogDevelopers, backlogTasks, forDemoPlanner, queryClient, removeTask, t]
  );

  return {
    activeTaskId,
    isMovingTask,
    handleDragStart,
    handleDragEnd,
  };
}
