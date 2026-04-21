'use client';

import { useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { useI18n } from '@/contexts/LanguageContext';
import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { sprintTasksQueryKey } from '@/features/task/hooks/useTasks';
import { fetchSprintTasks, fetchSprints } from '@/lib/beerTrackerApi';

export interface ReloadTasksOptions {
  /** Показать тост «Задачи обновлены». По умолчанию false (тихий reload при обновлении оценки и т.п.) */
  showToast?: boolean;
}

/**
 * Хук для перезагрузки задач спринта (мутация)
 */
export function useReloadTasks(sprintId: number | null, boardId: number | null) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();

  return useMutation({
    mutationFn: async (options?: ReloadTasksOptions) => {
      if (!sprintId) {
        throw new Error('Sprint ID is required');
      }

      const tasksPromise = fetchSprintTasks(sprintId, boardId || undefined);
      const sprintsPromise = boardId ? fetchSprints(boardId) : null;

      const [tasksData, sprintsData] = await Promise.all([
        tasksPromise,
        sprintsPromise,
      ]);

      return { tasksData, sprintsData, showToast: options?.showToast };
    },
    onSuccess: ({ tasksData, sprintsData, showToast }, _variables, _context) => {
      // Обновляем кеш задач (ключ должен совпадать с useTasks: sprintId + boardId)
      queryClient.setQueryData(sprintTasksQueryKey(sprintId, boardId, forDemoPlanner), tasksData);

      // Инвалидируем кеш занятости (фильтр по статусу), чтобы при «Незавершённые»/«Завершённые» отображались свежие данные
      queryClient.invalidateQueries({
        queryKey: forDemoPlanner
          ? (['tasks', 'demo', 'occupancy', sprintId, boardId ?? null] as const)
          : (['tasks', 'occupancy', sprintId, boardId ?? null] as const),
      });

      // Обновляем кеш спринтов, если они были загружены
      if (sprintsData && boardId) {
        queryClient.setQueryData(
          forDemoPlanner ? (['sprints', 'demo', boardId] as const) : (['sprints', boardId] as const),
          sprintsData
        );
      }
      if (showToast) {
        toast.success(t('task.mutations.tasksUpdated'));
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('task.mutations.tasksReloadFailed'));
    },
  });
}
