import type { PlannerIntegrationRulesDto } from './toPlannerDto';

export interface OccupancyMinEstimates {
  minStoryPointsForAssignee: number;
  minTestPointsForAssignee: number;
}

const DEFAULTS: OccupancyMinEstimates = {
  minStoryPointsForAssignee: 0,
  minTestPointsForAssignee: 0,
};

/**
 * Читает пороги из validationThresholds.occupancy (задаются админкой JSON).
 */
export function resolveOccupancyMinEstimates(
  rules: PlannerIntegrationRulesDto | null | undefined
): OccupancyMinEstimates {
  if (!rules?.validationThresholds) {
    return DEFAULTS;
  }
  const raw = rules.validationThresholds.occupancy;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULTS;
  }
  const o = raw as Record<string, unknown>;
  const minSp = o.minStoryPointsForAssignee;
  const minTp = o.minTestPointsForAssignee;
  return {
    minStoryPointsForAssignee:
      typeof minSp === 'number' && Number.isFinite(minSp) && minSp >= 0 ? minSp : DEFAULTS.minStoryPointsForAssignee,
    minTestPointsForAssignee:
      typeof minTp === 'number' && Number.isFinite(minTp) && minTp >= 0 ? minTp : DEFAULTS.minTestPointsForAssignee,
  };
}

export function taskHasEstimateForAssignee(
  task: { storyPoints?: number; testPoints?: number; team?: string },
  thresholds: OccupancyMinEstimates
): boolean {
  const isQa = task.team === 'QA';
  if (isQa) {
    const tp = task.testPoints ?? 0;
    return tp > thresholds.minTestPointsForAssignee;
  }
  const sp = task.storyPoints ?? 0;
  return sp > thresholds.minStoryPointsForAssignee;
}
