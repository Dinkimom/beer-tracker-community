/**
 * Хук для управления состоянием SprintPlanner
 * Выносит всю логику управления состоянием из основного компонента.
 *
 * **Задачи и разработчики:** из ответа `useTasks` (тот же кэш, что на странице). Оптимистичные правки списка задач — `setTasks` → `patchSprintTasksQuery` (поле `tasks` в `TasksResponse`).
 * Подробнее: `ARCHITECTURE.md` в корне репозитория.
 */

import type { GetTaskInfoFn } from '@/hooks/useApiStorage';
import type { Task, TaskPosition } from '@/types';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { patchSprintTasksQuery, useTasks } from '@/features/task/hooks/useTasks';
import { useTaskPositionsApi, useTaskLinksApi, useCommentsApi } from '@/hooks/useApiStorage';
import { useBoardViewModeStorage, useSidebarWidthStorage } from '@/hooks/useLocalStorage';

import { useTaskState } from '../../../hooks/useTaskState';

interface UseSprintPlannerStateProps {
  selectedBoardId: number | null;
  selectedSprintId: number | null;
}

export function useSprintPlannerState({ selectedBoardId, selectedSprintId }: UseSprintPlannerStateProps) {
  const queryClient = useQueryClient();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();
  const tasksQuery = useTasks(selectedSprintId, selectedBoardId);

  const tasks = tasksQuery.data?.tasks ?? [];
  const developers = tasksQuery.data?.developers ?? [];

  const setTasks = useCallback(
    (patch: Task[] | ((prev: Task[]) => Task[])) => {
      patchSprintTasksQuery(queryClient, selectedSprintId, selectedBoardId, patch, forDemoPlanner);
    },
    [queryClient, selectedSprintId, selectedBoardId, forDemoPlanner]
  );

  const [sidebarWidth, setSidebarWidth] = useSidebarWidthStorage(320);
  const [viewMode, setViewMode] = useBoardViewModeStorage();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
    });
  }, []);

  const getTaskInfoRef = useRef<GetTaskInfoFn | undefined>(undefined);

  const [taskPositions, setTaskPositions, savePosition, deletePosition, positionHistory] = useTaskPositionsApi(
    selectedSprintId,
    getTaskInfoRef
  );
  const [taskLinks, setTaskLinks, saveLink, deleteLink] = useTaskLinksApi(selectedSprintId);
  const [comments, setComments, , deleteComment] = useCommentsApi(selectedSprintId);

  const taskState = useTaskState({ tasks, taskPositions, developers });
  const { qaTasksMap, allTasksForDrag, tasksMap, qaTasksByOriginalId, unassignedTasks, tasksByAssignee } = taskState;

  useEffect(() => {
    getTaskInfoRef.current = (taskId: string) => {
      const task = tasksMap.get(taskId) || qaTasksByOriginalId.get(taskId);
      return task
        ? { isQa: task.team === 'QA', devTaskKey: task.team === 'QA' ? task.originalTaskId : undefined }
        : { isQa: false };
    };
  }, [tasksMap, qaTasksByOriginalId]);

  // taskPositions — тот же observable.map (стабильная ссылка); при DnD/сохранении/удалении мутирует на месте.
  // useMemo([taskPositions, …]) не пересчитывается — см. useTaskState.ts; занятость получала «замороженные» фазы.
  const filteredTaskPositions = new Map<string, TaskPosition>();
  taskPositions.forEach((pos, taskId) => {
    if (tasksMap.has(taskId) || qaTasksByOriginalId.has(taskId)) {
      filteredTaskPositions.set(taskId, pos);
    }
  });

  const filteredTaskLinks = useMemo(() => {
    return taskLinks.filter(
      (link) => tasksMap.has(link.fromTaskId) && tasksMap.has(link.toTaskId)
    );
  }, [taskLinks, tasksMap]);

  return {
    developers,
    tasks,
    setTasks,
    sidebarWidth,
    setSidebarWidth,
    viewMode,
    setViewMode,
    isMounted,

    taskPositions,
    setTaskPositions,
    savePosition,
    deletePosition,
    positionHistory,
    taskLinks,
    setTaskLinks,
    saveLink,
    deleteLink,
    comments,
    setComments,
    deleteComment,

    qaTasksMap,
    allTasksForDrag,
    tasksMap,
    qaTasksByOriginalId,
    unassignedTasks,
    tasksByAssignee,
    filteredTaskPositions,
    filteredTaskLinks,
  };
}
