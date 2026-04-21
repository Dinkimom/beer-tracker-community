'use client';

import type { StoryPhasePosition } from '@/features/quarterly-planning-v2/types';
import type { TaskPosition } from '@/types';
import type { Quarter } from '@/types/quarterly';
import type { SprintListItem } from '@/types/tracker';

import { useQuery } from '@tanstack/react-query';

import { PARTS_PER_DAY } from '@/constants';
import {
  filterSprintsByQuarter,
  WORKING_DAYS_PER_SPRINT,
} from '@/features/quarterly-planning-v2/utils/quarterSprints';
import { fetchQuarterlyPlanV2 } from '@/lib/api/quarterly';

function getQuarterFromDate(date: Date): { year: number; quarter: Quarter } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const quarter = (Math.floor(month / 3) + 1) as Quarter;
  return { year, quarter };
}

/** Сегмент фазы, попадающий в запрашиваемый спринт. */
function clipPhaseToSprint(
  phase: StoryPhasePosition,
  sprintIndexInQuarter: number
): StoryPhasePosition | null {
  const phaseStartQ = phase.sprintIndex * WORKING_DAYS_PER_SPRINT + phase.startDay;
  const phaseEndQ = phaseStartQ + phase.durationDays - 1;
  const sprintStartQ = sprintIndexInQuarter * WORKING_DAYS_PER_SPRINT;
  const sprintEndQ = sprintStartQ + WORKING_DAYS_PER_SPRINT - 1;
  const segStart = Math.max(phaseStartQ, sprintStartQ);
  const segEnd = Math.min(phaseEndQ, sprintEndQ);
  if (segStart > segEnd) return null;
  return {
    sprintIndex: sprintIndexInQuarter,
    startDay: segStart - sprintStartQ,
    durationDays: segEnd - segStart + 1,
  };
}

export interface SprintPagePlanPhasesResult {
  parentKeyToPlanPhase: Map<string, TaskPosition>;
  /** Ключи, у которых по плану фаза заканчивается в текущем спринте (показывать сегмент «релиз»). */
  releaseInSprintKeys: Set<string>;
}

/**
 * Для страницы спринта: запрос к таблице квартального планирования по всем родительским тикетам
 * (стори/эпики из группировки). Возвращает плановые фазы только для них в текущем спринте.
 */
export function useSprintPagePlanPhases(
  boardId: number | null,
  sprintId: number | null,
  sprintStartDate: Date | null,
  sprints: SprintListItem[],
  parentKeys: string[]
): SprintPagePlanPhasesResult {
  const emptyResult: SprintPagePlanPhasesResult = {
    parentKeyToPlanPhase: new Map(),
    releaseInSprintKeys: new Set(),
  };

  const { data } = useQuery({
    queryKey: [
      'sprint-page-plan-phases',
      boardId,
      sprintId,
      sprintStartDate?.getTime(),
      sprints.map((s) => s.id).join(','),
      parentKeys.slice().sort().join(','),
    ],
    queryFn: async (): Promise<SprintPagePlanPhasesResult> => {
      if (!boardId || sprintId == null || !sprintStartDate || sprints.length === 0) {
        return emptyResult;
      }
      const { year, quarter } = getQuarterFromDate(sprintStartDate);

      const sprintOptions =
        parentKeys.length > 0 ? { parentKeys, sprintId } : undefined;
      const plan = await fetchQuarterlyPlanV2(boardId, year, quarter, sprintOptions);
      const storyPhases = plan?.storyPhases ?? {};
      if (Object.keys(storyPhases).length === 0) return emptyResult;

      const quarterSprints = filterSprintsByQuarter(sprints, year, quarter);
      const sprintIndexInQuarter = quarterSprints.findIndex((s) => s.id === sprintId);
      if (sprintIndexInQuarter === -1) return emptyResult;

      const sprintEndQ = sprintIndexInQuarter * WORKING_DAYS_PER_SPRINT + WORKING_DAYS_PER_SPRINT - 1;
      const parentKeyToPlanPhase = new Map<string, TaskPosition>();
      const releaseInSprintKeys = plan?.releaseInSprintKeys
        ? new Set(plan.releaseInSprintKeys)
        : new Set<string>();

      for (const [key, phase] of Object.entries(storyPhases)) {
        const segment = clipPhaseToSprint(phase, sprintIndexInQuarter);
        if (segment) {
          parentKeyToPlanPhase.set(key, {
            taskId: key,
            startDay: segment.startDay,
            startPart: 0,
            duration: segment.durationDays * PARTS_PER_DAY,
            assignee: '',
          });
          if (!plan?.releaseInSprintKeys) {
            const phaseEndQ = phase.sprintIndex * WORKING_DAYS_PER_SPRINT + phase.startDay + phase.durationDays - 1;
            if (phaseEndQ <= sprintEndQ) releaseInSprintKeys.add(key);
          }
        }
      }

      return { parentKeyToPlanPhase, releaseInSprintKeys };
    },
    enabled: !!boardId && sprintId != null && !!sprintStartDate && sprints.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  return data ?? emptyResult;
}
