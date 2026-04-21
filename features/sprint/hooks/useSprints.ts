'use client';

import type { SprintListItem } from '@/types/tracker';

import { useQuery } from '@tanstack/react-query';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { fetchSprints } from '@/lib/beerTrackerApi';

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
