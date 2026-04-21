'use client';

import type { Quarter } from '@/types';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchQuarterlyPlanV2, saveQuarterlyPlanV2 } from '@/lib/api/quarterly';

const QUERY_KEY = ['quarterly-plan-v2'] as const;

/**
 * Загрузка и сохранение плана квартального планирования v2.
 * При смене boardId / year / quarter загружается соответствующий план.
 */
export function useQuarterlyPlanV2(
  boardId: number,
  year: number,
  quarter: Quarter
) {
  const queryClient = useQueryClient();
  const quarterNum = typeof quarter === 'number' ? quarter : parseInt(String(quarter), 10);

  const query = useQuery({
    queryKey: [...QUERY_KEY, boardId, year, quarterNum],
    queryFn: () => fetchQuarterlyPlanV2(boardId, year, quarterNum),
    enabled: !!boardId && !!year && quarterNum >= 1 && quarterNum <= 4,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      epicKeys,
      storyPhases,
    }: {
      epicKeys: string[];
      storyPhases: Record<string, { sprintIndex: number; startDay: number; durationDays: number }>;
    }) => saveQuarterlyPlanV2(boardId, year, quarterNum, epicKeys, storyPhases),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, boardId, year, quarterNum] });
    },
  });

  return {
    planData: query.data,
    isLoadingPlan: query.isLoading,
    refetchPlan: query.refetch,
    savePlan: (epicKeys: string[], storyPhases: Record<string, { sprintIndex: number; startDay: number; durationDays: number }>) =>
      saveMutation.mutateAsync({ epicKeys, storyPhases }),
    isSaving: saveMutation.isPending,
  };
}
