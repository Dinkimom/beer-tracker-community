'use client';

import type { StatusFilter } from '@/types';
import type { Task, Developer } from '@/types';
import type { SprintInfo } from '@/types/tracker';
import type { QueryClient } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { fetchSprintTasks } from '@/lib/beerTrackerApi';

export interface TasksResponse {
  developers: Developer[];
  sprintInfo: SprintInfo;
  tasks: Task[];
}

export function patchSprintInfoInTasksQueries(
  queryClient: QueryClient,
  sprintInfo: SprintInfo
): void {
  queryClient.setQueriesData<TasksResponse>(
    {
      predicate: (query) => {
        const key = query.queryKey;
        return (
          (key[0] === 'tasks' && key[1] === sprintInfo.id) ||
          (key[0] === 'tasks' && key[1] === 'demo' && key[2] === sprintInfo.id)
        );
      },
    },
    (old) => {
      if (!old?.sprintInfo) return old;
      return {
        ...old,
        sprintInfo: {
          ...old.sprintInfo,
          ...sprintInfo,
        },
      };
    }
  );
}

/**
 * Оптимистично обновляет только массив `tasks` в кэше `useTasks` / `useReloadTasks`.
 * Если записи в кэше ещё нет — ничего не делает.
 */
export function patchSprintTasksQuery(
  queryClient: QueryClient,
  sprintId: number | null,
  boardId: number | null | undefined,
  patch: Task[] | ((prev: Task[]) => Task[]),
  forDemoPlanner = false
): void {
  if (!sprintId) return;
  const key = sprintTasksQueryKey(sprintId, boardId, forDemoPlanner);
  queryClient.setQueryData<TasksResponse>(key, (old) => {
    if (!old) return old;
    const prevTasks = old.tasks;
    const nextTasks = typeof patch === 'function' ? (patch as (p: Task[]) => Task[])(prevTasks) : patch;
    return { ...old, tasks: nextTasks };
  });
}

/**
 * Ключ React Query для списка задач спринта (`fetchSprintTasks`).
 * `boardId` нормализуется (`null` вместо `undefined`), чтобы совпадать с `useReloadTasks` и `setQueryData`.
 * `forDemoPlanner` — отдельный ключ кэша на `/demo/planner`, чтобы не смешивать с продуктом при совпадении id.
 */
export function sprintTasksQueryKey(
  sprintId: number | null,
  boardId?: number | null,
  forDemoPlanner = false
) {
  if (forDemoPlanner) {
    return ['tasks', 'demo', sprintId, boardId ?? null] as const;
  }
  return ['tasks', sprintId, boardId ?? null] as const;
}

/**
 * Хук для загрузки задач спринта
 */
export function useTasks(sprintId: number | null, boardId?: number | null) {
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();
  return useQuery({
    queryKey: sprintTasksQueryKey(sprintId, boardId, forDemoPlanner),
    queryFn: (): Promise<TasksResponse> => {
      if (!sprintId) {
        throw new Error('Sprint ID is required');
      }

      return fetchSprintTasks(sprintId, boardId || undefined);
    },
    enabled: !!sprintId,
    staleTime: 1000 * 60 * 2, // 2 минуты (задачи меняются чаще)
  });
}

/**
 * Загрузка задач спринта с фильтром по статусу для вкладки «Занятость».
 * При смене фильтра уходит запрос на бэкенд, пока данные грузятся — показывается лоадер.
 * Запрос выполняется только когда enabled === true (например, только в режиме «По задачам»).
 */
export function useOccupancyTasks(
  sprintId: number | null,
  boardId: number | null | undefined,
  statusFilter: StatusFilter,
  options?: { enabled?: boolean }
) {
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();
  const enabled = options?.enabled !== false;
  return useQuery({
    queryKey: forDemoPlanner
      ? (['tasks', 'demo', 'occupancy', sprintId, boardId ?? null, statusFilter] as const)
      : (['tasks', 'occupancy', sprintId, boardId ?? null, statusFilter] as const),
    queryFn: (): Promise<TasksResponse> => {
      if (!sprintId) {
        throw new Error('Sprint ID is required');
      }
      return fetchSprintTasks(sprintId, boardId ?? undefined, statusFilter);
    },
    enabled: !!sprintId && enabled,
    staleTime: 1000 * 60 * 2,
  });
}
