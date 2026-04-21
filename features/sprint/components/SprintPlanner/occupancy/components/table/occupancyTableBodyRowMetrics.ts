import type { SidebarTasksTab, Task, TaskPosition } from '@/types';

import { mapStatus } from '@/utils/statusMapper';

import {
  PHASE_BAR_HEIGHT_COMPACT_PX,
  PHASE_BAR_HEIGHT_PX,
} from '../task-row/plan/occupancyPhaseBarConstants';

const OCCUPANCY_TASK_ROW_MIN_HEIGHT = 56;
const OCCUPANCY_TASK_ROW_LEGACY_TM_MIN_HEIGHT = 40;
const OCCUPANCY_FACT_ROW_HEIGHT = 28;
const OCCUPANCY_TASK_ROW_LEGACY_TM_WITH_FACT_MIN_HEIGHT =
  OCCUPANCY_TASK_ROW_LEGACY_TM_MIN_HEIGHT + OCCUPANCY_FACT_ROW_HEIGHT + 12;
const ROW_BORDER_PX = 1;
const UNPLANNED_WARNING_ROW_EXTRA_PX = 28;

export function computeUnplannedWarning(params: {
  hasQa: boolean;
  hasStoryPoints: boolean;
  hasTestPoints: boolean;
  position: TaskPosition | undefined;
  qaPosition: TaskPosition | undefined;
  task: Pick<Task, 'originalStatus' | 'originalTaskId' | 'status'>;
}): SidebarTasksTab | null {
  const { task, position, qaPosition, hasQa, hasStoryPoints, hasTestPoints } = params;

  const noDev = !task.originalTaskId && !position;
  const qaPhasePlanned = hasQa
    ? !!qaPosition
    : !hasStoryPoints && hasTestPoints && !!position;
  const noQa = hasTestPoints && !qaPhasePlanned;

  let unplannedWarning: SidebarTasksTab | null = null;
  if (noDev && noQa) unplannedWarning = 'all';
  else if (noDev) unplannedWarning = 'dev';
  else if (noQa) unplannedWarning = 'qa';

  const rowTaskDone =
    task.status === 'done' || mapStatus(task.originalStatus ?? '') === 'done';
  if (rowTaskDone) {
    return null;
  }
  return unplannedWarning;
}

export function computeRowMinHeight(
  legacyCompactLayout: boolean,
  factVisible: boolean
): number {
  if (legacyCompactLayout) {
    return factVisible
      ? OCCUPANCY_TASK_ROW_LEGACY_TM_WITH_FACT_MIN_HEIGHT
      : OCCUPANCY_TASK_ROW_LEGACY_TM_MIN_HEIGHT;
  }
  return factVisible
    ? OCCUPANCY_TASK_ROW_MIN_HEIGHT + OCCUPANCY_FACT_ROW_HEIGHT + 12
    : OCCUPANCY_TASK_ROW_MIN_HEIGHT;
}

export function computePlanRowHeightPx(params: {
  factVisible: boolean;
  legacyCompactLayout: boolean;
  plannedInSprintMaxStack: Map<string, number> | undefined;
  plannedInSprintPositionsForTask: TaskPosition[] | undefined;
  position: TaskPosition | undefined;
  quarterlyPhaseStyle: boolean;
  rowMinHeight: number;
  taskId: string;
  taskRowHeights: Map<string, number>;
  unplannedWarning: SidebarTasksTab | null;
}): number {
  const {
    taskRowHeights,
    taskId,
    rowMinHeight,
    unplannedWarning,
    legacyCompactLayout,
    quarterlyPhaseStyle,
    plannedInSprintPositionsForTask,
    position,
    plannedInSprintMaxStack,
  } = params;

  let planRowHeight = Math.max(
    rowMinHeight - ROW_BORDER_PX,
    (taskRowHeights.get(taskId) ?? rowMinHeight) - ROW_BORDER_PX
  );
  if (unplannedWarning != null && !legacyCompactLayout) {
    planRowHeight = Math.max(
      planRowHeight,
      rowMinHeight - ROW_BORDER_PX + UNPLANNED_WARNING_ROW_EXTRA_PX
    );
  }
  if (quarterlyPhaseStyle && plannedInSprintPositionsForTask?.length && position) {
    const phaseBarHeightPx = legacyCompactLayout ? PHASE_BAR_HEIGHT_COMPACT_PX : PHASE_BAR_HEIGHT_PX;
    const planToSprintBarGapPx = 8;
    const sprintBarHeightPx = 18;
    const sprintBarGapPx = 2;
    const sprintBarsBottomPaddingPx = 18;
    const stackCount = plannedInSprintMaxStack?.get(taskId) ?? 1;
    const minHeightForSprintBars =
      2 +
      phaseBarHeightPx +
      planToSprintBarGapPx +
      stackCount * sprintBarHeightPx +
      (stackCount - 1) * sprintBarGapPx +
      sprintBarsBottomPaddingPx;
    planRowHeight = Math.max(planRowHeight, minHeightForSprintBars);
  }
  return planRowHeight;
}
