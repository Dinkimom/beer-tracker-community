'use client';

import type { TimelineSettings } from '../../../table/OccupancyTableHeader';
import type { PositionPreview } from '../OccupancyPhaseBar';
import type { Task, TaskPosition } from '@/types';

import { PARTS_PER_DAY } from '@/constants';

import { PHASE_PLAN_ROW_INSET_PX } from '../occupancyPhaseBarConstants';

import { resolveOccupancyAddPhaseHoverSlotKind } from './OccupancyAddPhaseGhost';

interface OccupancyRedGhostsProps {
  assigneeOtherPositions: TaskPosition[];
  holidayDayIndices?: Set<number>;
  /** Hover по ячейке для добавления фазы — тогда тоже показываем занятые слоты исполнителя */
  hoveredCell: { dayIndex: number; partIndex: number; taskId: string } | null;
  phaseBarHeightPx: number;
  phaseBarTopOffsetPx: number;
  position?: TaskPosition;
  positionPreviews: Map<string, PositionPreview>;
  qaAssigneeOtherPositions: TaskPosition[];
  qaPosition?: TaskPosition;
  qaTask?: Task;
  task: Task;
  timelineSettings: TimelineSettings;
  totalParts: number;
}

export function OccupancyRedGhosts({
  assigneeOtherPositions,
  holidayDayIndices,
  hoveredCell,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  position,
  positionPreviews,
  qaAssigneeOtherPositions,
  qaPosition,
  qaTask,
  task,
  timelineSettings,
  totalParts,
}: OccupancyRedGhostsProps) {
  const showFreeSlotPreview = timelineSettings.showFreeSlotPreview ?? true;
  const isDraggingDev = positionPreviews.has(task.id);
  const isDraggingQa = qaTask != null && positionPreviews.has(qaTask.id);
  const addPhaseHoverSlotKind = resolveOccupancyAddPhaseHoverSlotKind(
    hoveredCell,
    task,
    totalParts,
    position,
    qaTask,
    qaPosition,
    isDraggingDev
  );
  const showDevRed = isDraggingDev || addPhaseHoverSlotKind === 'dev';
  const showQaRed = isDraggingQa || addPhaseHoverSlotKind === 'qa';
  if (!showFreeSlotPreview || (!showDevRed && !showQaRed) || totalParts <= 0) return null;

  let positionsToShowAsRed: TaskPosition[];
  if (isDraggingDev) {
    positionsToShowAsRed = [...assigneeOtherPositions];
  } else if (isDraggingQa) {
    positionsToShowAsRed = [...qaAssigneeOtherPositions];
  } else if (addPhaseHoverSlotKind === 'dev') {
    positionsToShowAsRed = [...assigneeOtherPositions];
  } else if (addPhaseHoverSlotKind === 'qa') {
    positionsToShowAsRed = [...qaAssigneeOtherPositions];
  } else {
    return null;
  }
  const holidayPositions: Array<Pick<TaskPosition, 'duration' | 'startDay' | 'startPart'>> = holidayDayIndices
    ? Array.from(holidayDayIndices).map((dayIndex) => ({
        startDay: dayIndex,
        startPart: 0,
        duration: PARTS_PER_DAY,
      }))
    : [];
  const allRedPositions: Array<Pick<TaskPosition, 'duration' | 'startDay' | 'startPart'>> = [
    ...positionsToShowAsRed,
    ...holidayPositions,
  ];
  const phaseInsetPx = PHASE_PLAN_ROW_INSET_PX;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {allRedPositions.map((pos, idx) => {
        const startCell = pos.startDay * PARTS_PER_DAY + pos.startPart;
        const endCell = startCell + pos.duration;
        const leftPercent = (startCell / totalParts) * 100;
        const rightPercent = (endCell / totalParts) * 100;
        const key =
          idx < positionsToShowAsRed.length
            ? `red-${idx}-${pos.startDay}-${pos.startPart}-${pos.duration}`
            : `ghost-day-${pos.startDay}`;
        return (
          <div
            key={key}
            aria-hidden
            className="absolute rounded-lg bg-red-200 dark:bg-red-900/50 transition-[left,right] duration-200 ease-out"
            style={{
              left: `calc(${leftPercent}% + ${phaseInsetPx}px)`,
              right: `calc(${100 - rightPercent}% + ${phaseInsetPx}px)`,
              top: phaseBarTopOffsetPx,
              height: phaseBarHeightPx,
            }}
          />
        );
      })}
    </div>
  );
}
