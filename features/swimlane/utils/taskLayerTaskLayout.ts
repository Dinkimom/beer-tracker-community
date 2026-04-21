import type { PhaseSegment, Task, TaskPosition } from '@/types';
import type { CSSProperties } from 'react';

import { PARTS_PER_DAY } from '@/constants';
import { getLeftPercent, getWidthPercent } from '@/features/swimlane/utils/positionUtils';

export interface PlannedLayoutSnapshot {
  plannedDuration: number;
  plannedPosition: {
    endCell: number;
    leftPercent: number;
    startCell: number;
    widthPercent: number;
  };
  plannedStartDay: number;
  plannedStartPart: number;
}

export function buildPlannedLayoutSnapshot(position: TaskPosition): PlannedLayoutSnapshot {
  const plannedStartDay = position.plannedStartDay ?? position.startDay;
  const plannedStartPart = position.plannedStartPart ?? position.startPart;
  const plannedDuration = position.plannedDuration ?? position.duration;

  const plannedPosition = {
    leftPercent: getLeftPercent({
      assignee: position.assignee,
      duration: plannedDuration,
      startDay: plannedStartDay,
      startPart: plannedStartPart,
      taskId: position.taskId,
    }),
    widthPercent: getWidthPercent(plannedDuration),
    startCell: plannedStartDay * PARTS_PER_DAY + plannedStartPart,
    endCell: plannedStartDay * PARTS_PER_DAY + plannedStartPart + plannedDuration,
  };

  return { plannedDuration, plannedPosition, plannedStartDay, plannedStartPart };
}

export function computeBaselineStretch(
  task: Task,
  plannedEndCell: number,
  currentCell: number
): { baselineStart: number; baselineWidth: number } | null {
  if (task.status !== 'in-progress' && task.status !== 'todo') return null;
  if (plannedEndCell >= currentCell) return null;
  return {
    baselineStart: plannedEndCell,
    baselineWidth: currentCell - plannedEndCell,
  };
}

/**
 * Полосы просрочки в свимлейне: для каждого отрезка плана — от конца этого отрезка до currentCell (если просрочен).
 * Не использовать один plannedStart + plannedDuration на всю задачу при нескольких сегментах.
 */
export function computeSwimlaneOverdueBaselineStrips(
  task: Task,
  planSegments: PhaseSegment[],
  currentCell: number
): Array<{ baselineStart: number; baselineWidth: number }> {
  const strips: Array<{ baselineStart: number; baselineWidth: number }> = [];
  for (const seg of planSegments) {
    const endCell = seg.startDay * PARTS_PER_DAY + seg.startPart + seg.duration;
    const stretch = computeBaselineStretch(task, endCell, currentCell);
    if (stretch) strips.push(stretch);
  }
  return strips;
}

export function computeBaselineStripOpacity(params: {
  activeTaskDuration: number | null;
  assigneeId: string;
  baselineStart: number;
  baselineWidth: number;
  hoveredCell: { assigneeId: string; day: number; part: number } | null;
  hoveredTaskId: string | null;
  /** Превью по hoveredCell только во время drag (иначе возможны «залипшие» поля) */
  isDraggingTask: boolean;
  taskId: string;
}): number {
  const {
    activeTaskDuration,
    assigneeId,
    baselineStart,
    baselineWidth,
    hoveredCell,
    hoveredTaskId,
    isDraggingTask,
    taskId,
  } = params;

  let baselineOpacity = hoveredTaskId === taskId ? 1 : 0.7;
  if (
    isDraggingTask &&
    hoveredCell &&
    activeTaskDuration &&
    hoveredCell.assigneeId === assigneeId
  ) {
    const targetStartCell = hoveredCell.day * PARTS_PER_DAY + hoveredCell.part;
    const targetEndCell = targetStartCell + activeTaskDuration;
    const baselineEndCell = baselineStart + baselineWidth;

    if (baselineStart < targetEndCell && baselineEndCell > targetStartCell) {
      baselineOpacity = 0.3;
    }
  }
  return baselineOpacity;
}

export function computeSwimlaneRowBandStyle(
  hasTaskOverlaps: boolean,
  taskLayer: number,
  totalHeight: number,
  layerHeight: number
): Pick<CSSProperties, 'bottom' | 'top'> {
  if (!hasTaskOverlaps) {
    return { bottom: '0.375rem', top: '0.375rem' };
  }
  const taskTop = taskLayer * layerHeight;
  const taskBottom = totalHeight - (taskLayer + 1) * layerHeight;
  return { bottom: `${taskBottom + 4}px`, top: `${taskTop + 4}px` };
}

export function computeTaskLayerCardOpacity(params: {
  activeTask: Task | null;
  factHoveredTaskId: string | null;
  hoverConnectedTaskIds: Set<string> | null;
  onSegmentEditCancel?: () => void;
  onSegmentEditSave?: unknown;
  segmentEditTaskId: string | null;
  taskId: string;
}): number {
  const {
    activeTask,
    factHoveredTaskId,
    hoverConnectedTaskIds,
    onSegmentEditCancel,
    onSegmentEditSave,
    segmentEditTaskId,
    taskId,
  } = params;

  const hasHoverConnections = hoverConnectedTaskIds != null && hoverConnectedTaskIds.size > 1;
  const linkDimOpacity =
    hasHoverConnections && !hoverConnectedTaskIds!.has(taskId) ? 0.5 : 1;
  const factDimOpacity =
    factHoveredTaskId != null && taskId !== factHoveredTaskId ? 0.5 : 1;
  const segmentEditMode =
    segmentEditTaskId != null && onSegmentEditSave != null && onSegmentEditCancel != null;
  const segmentEditDimOpacity =
    segmentEditMode && taskId !== segmentEditTaskId ? 0.5 : 1;
  return (
    (activeTask != null ? 1 : Math.min(linkDimOpacity, factDimOpacity)) * segmentEditDimOpacity
  );
}
