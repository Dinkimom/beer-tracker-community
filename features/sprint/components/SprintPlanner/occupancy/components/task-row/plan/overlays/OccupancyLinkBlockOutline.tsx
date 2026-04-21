'use client';

import type { Task, TaskPosition } from '@/types';

import { getCombinedPhaseCellRange } from '@/features/sprint/utils/occupancyUtils';

import { getPhaseFocusRingClass } from '../../../shared/phaseFocusRing';
import { PHASE_PLAN_ROW_INSET_PX } from '../occupancyPhaseBarConstants';

interface OccupancyLinkBlockOutlineProps {
  hoveredPhaseTaskId: string | null;
  linkAlreadyExistsFromSource: boolean;
  linkingFromTaskId: string | null;
  phaseBarHeightPx: number;
  phaseBarTopOffsetPx: number;
  position?: TaskPosition;
  qaPosition?: TaskPosition;
  qaTask?: Task;
  task: Task;
  totalParts: number;
  validTargetByTime: boolean;
}

export function OccupancyLinkBlockOutline({
  hoveredPhaseTaskId,
  linkAlreadyExistsFromSource,
  linkingFromTaskId,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  position,
  qaPosition,
  qaTask,
  task,
  totalParts,
  validTargetByTime,
}: OccupancyLinkBlockOutlineProps) {
  if (linkingFromTaskId == null) return null;
  const combinedRange = getCombinedPhaseCellRange(position, qaPosition, qaTask);
  if (!combinedRange || totalParts <= 0) return null;

  const rowIsLinkSource =
    linkingFromTaskId === task.id || (qaTask != null && linkingFromTaskId === qaTask.id);
  const rowIsLinkTarget =
    validTargetByTime &&
    !linkAlreadyExistsFromSource &&
    linkingFromTaskId !== task.id &&
    (qaTask == null || linkingFromTaskId !== qaTask.id);
  const isHoveringThisRowPhase =
    hoveredPhaseTaskId === task.id || (qaTask != null && hoveredPhaseTaskId === qaTask.id);
  if (!rowIsLinkSource && !rowIsLinkTarget) return null;

  const combinedLeftPercent = (combinedRange.startCell / totalParts) * 100;
  const combinedRightPercent = (combinedRange.endCell / totalParts) * 100;
  const phaseInsetPx = PHASE_PLAN_ROW_INSET_PX;
  const ringClass = rowIsLinkSource
    ? getPhaseFocusRingClass(true, 'source')
    : getPhaseFocusRingClass(true, 'target');
  const combinedBlockStyle = {
    left: `calc(${combinedLeftPercent}% + ${phaseInsetPx}px)` as const,
    right: `calc(${100 - combinedRightPercent}% + ${phaseInsetPx}px)` as const,
    top: phaseBarTopOffsetPx,
    height: phaseBarHeightPx,
  };

  return (
    <>
      <div
        className={`absolute rounded-lg pointer-events-none ${ringClass}`}
        style={combinedBlockStyle}
      />
      {rowIsLinkTarget && isHoveringThisRowPhase && (
        <div
          aria-hidden
          className="absolute rounded-lg pointer-events-none bg-blue-400/20 dark:bg-blue-500/25 ring-2 ring-blue-400 dark:ring-blue-400"
          style={combinedBlockStyle}
        />
      )}
    </>
  );
}
