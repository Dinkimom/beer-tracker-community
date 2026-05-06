'use client';

import type { SprintInfo, SprintListItem } from '@/types/tracker';
import type { QueryClient } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { fetchSprints } from '@/lib/beerTrackerApi';

export function patchSprintInSprintsQueries(
  queryClient: QueryClient,
  sprintInfo: SprintInfo
): void {
  queryClient.setQueriesData<SprintListItem[]>(
    {
      predicate: (query) => {
        const key = query.queryKey;
        return (
          (key[0] === 'sprints' && typeof key[1] === 'number') ||
          (key[0] === 'sprints' && key[1] === 'demo' && typeof key[2] === 'number')
        );
      },
    },
    (old) => {
      if (!old) return old;
      let changed = false;
      const next = old.map((sprint) => {
        if (sprint.id !== sprintInfo.id) {
          return sprint;
        }
        changed = true;
        return {
          ...sprint,
          endDate: sprintInfo.endDate,
          endDateTime: sprintInfo.endDateTime,
          archived: sprintInfo.status === 'archived' ? true : sprint.archived,
          name: sprintInfo.name,
          startDate: sprintInfo.startDate,
          startDateTime: sprintInfo.startDateTime,
          status: sprintInfo.status,
          version: sprintInfo.version ?? sprint.version,
        };
      });
      return changed ? next : old;
    }
  );
}

/**
 * Хук для загрузки списка спринтов доски
 */
export function useSprints(boardId: number | null) {
  const isDemoPlannerBoards = useDemoPlannerBoardsQueryScope();
  const sprintsListQueryKey = isDemoPlannerBoards
    ? (['sprints', 'demo', boardId] as const)
    : (['sprints', boardId] as const);

  return useQuery({
    queryKey: sprintsListQueryKey,
    queryFn: (): Promise<SprintListItem[]> => {
      if (!boardId) {
        return Promise.resolve([]);
      }

      return fetchSprints(boardId);
    },
    enabled: !!boardId,
    staleTime: 1000 * 60 * 5, // 5 минут
    retry: isDemoPlannerBoards ? false : undefined,
  });
}
