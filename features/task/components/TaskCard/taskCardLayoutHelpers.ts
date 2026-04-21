import type { Task, TaskPosition } from '@/types';
import type { StatusColorGroup } from '@/utils/statusColors';

import { getTaskPoints } from '@/features/task/utils/taskUtils';
import { storyPointsToTimeslots, timeslotsToStoryPoints } from '@/lib/pointsUtils';

export function getTaskCardPaddingClasses(
  isVeryNarrow: boolean,
  isNarrow: boolean,
  isSwimlane: boolean
): string {
  if (isVeryNarrow) return 'px-1.5 pb-1 pt-1';
  if (isNarrow) return 'px-2 pb-1.5 pt-1.5';
  if (isSwimlane) return 'px-2.5 pb-1.5 pt-1.5';
  return 'px-2.5 pb-2.5 pt-2.5';
}

export function getTaskCardCursorClass(isDragging: boolean, isResizing: boolean): string {
  if (isDragging) return 'cursor-grabbing';
  if (isResizing) return 'cursor-ew-resize';
  return 'cursor-grab';
}

export function getTaskCardBorderClasses(
  previewBorder: string | undefined,
  isResizing: boolean,
  isLocalTask: boolean
): string {
  if (previewBorder && isResizing) return `border-2 border-dashed ${previewBorder}`;
  if (isLocalTask) return 'border-2 border-dashed border-orange-400 dark:border-orange-500';
  return 'border-2';
}

export function getQaRightBgColor(
  statusColorsForQa: StatusColorGroup | null,
  isDark: boolean
): string | undefined {
  if (!statusColorsForQa) return undefined;
  if (isDark && statusColorsForQa.qaStripedDark) {
    return statusColorsForQa.qaStripedDark.base;
  }
  return statusColorsForQa.qaStriped?.base;
}

export function getDimmedByContextMenuClasses(isSwimlane: boolean): string {
  if (isSwimlane) return 'pointer-events-none';
  return 'opacity-50 pointer-events-none transition-opacity duration-200';
}

export function getSidebarOpacityGroupClasses(
  variant: 'sidebar' | 'swimlane',
  dimmedByContextMenu: boolean
): string {
  if (variant !== 'sidebar') return '';
  const opacityPart = !dimmedByContextMenu ? 'opacity-80 ' : '';
  return `${opacityPart}group`;
}

export interface TaskCardBarMetrics {
  actualDuration: number;
  baselineSP: number;
  baselineTimeslots: number;
  estimatedSP: number;
  estimatedTimeslots: number;
  extraSP: number;
  extraTimeslots: number;
  hasExtraDuration: boolean;
  leftPercent: number;
  rightPercent: number;
  showExtraSplit: boolean;
}

export function computeTaskCardBarMetrics(
  task: Task,
  taskPosition: TaskPosition | undefined,
  swimlaneBarDurationParts: number | undefined,
  resizePreviewDuration: number | null | undefined,
  isResizing: boolean
): TaskCardBarMetrics {
  const estimatedSP = getTaskPoints(task);
  const estimatedTimeslots = storyPointsToTimeslots(estimatedSP);
  const planSlotsOnBar =
    swimlaneBarDurationParts ?? taskPosition?.duration ?? estimatedTimeslots;
  const actualDuration = resizePreviewDuration ?? planSlotsOnBar;
  const committedSlots = planSlotsOnBar;
  const baselineTimeslots = Math.max(estimatedTimeslots, committedSlots);
  const baselineSP = Math.max(estimatedSP, timeslotsToStoryPoints(committedSlots));
  const extraTimeslots = Math.max(0, actualDuration - baselineTimeslots);
  const extraSP = Math.max(0, timeslotsToStoryPoints(actualDuration) - baselineSP);
  const hasExtraDuration = extraSP > 0;
  const showExtraSplit = hasExtraDuration && isResizing;
  const leftPercent =
    hasExtraDuration && actualDuration > 0 ? (baselineTimeslots / actualDuration) * 100 : 100;
  const rightPercent =
    hasExtraDuration && actualDuration > 0 ? (extraTimeslots / actualDuration) * 100 : 0;

  return {
    actualDuration,
    baselineSP,
    baselineTimeslots,
    estimatedSP,
    estimatedTimeslots,
    extraSP,
    extraTimeslots,
    hasExtraDuration,
    leftPercent,
    rightPercent,
    showExtraSplit,
  };
}

export function getSwimlaneWidthModes(
  isSwimlane: boolean,
  widthPercent: number | undefined
): { isNarrow: boolean; isVeryNarrow: boolean } {
  const isVeryNarrow = isSwimlane && widthPercent !== undefined && widthPercent < 10;
  const isNarrow = isSwimlane && widthPercent !== undefined && widthPercent < 15;
  return { isNarrow, isVeryNarrow };
}
