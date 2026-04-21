'use client';

import type { VacationEntry } from '@/types/quarterly';

import { useQuery } from '@tanstack/react-query';

import { fetchVacationEntriesForBoard } from '@/lib/beerTrackerApi';

export function useBoardVacations(boardId: number | null) {
  return useQuery({
    queryKey: ['boardVacations', boardId],
    queryFn: async (): Promise<VacationEntry[]> => {
      if (!boardId) return [];
      return await fetchVacationEntriesForBoard(boardId);
    },
    enabled: boardId != null,
    staleTime: 1000 * 60 * 2,
  });
}

