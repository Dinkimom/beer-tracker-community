'use client';

import type { Developer, Task, TaskPosition } from '@/types';

import { Avatar } from '@/components/Avatar';
import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { PARTS_PER_DAY, ZIndex } from '@/constants';
import { positionToEndCell } from '@/features/sprint/utils/occupancyUtils';
import { getTaskCardStyles } from '@/features/task/components/TaskCard/components/TaskCardBody';
import { getTaskPoints, isQaOnlyTask } from '@/features/task/utils/taskUtils';
import { storyPointsToTimeslots } from '@/lib/pointsUtils';
import { getTeamTagClasses } from '@/utils/teamColors';

import { PHASE_PLAN_ROW_INSET_PX } from '../occupancyPhaseBarConstants';

export interface OccupancyHoveredTimelineCell {
  dayIndex: number;
  partIndex: number;
  taskId: string;
}

/**
 * Какой «ряд» занятости (dev / qa) соответствует превью добавления фазы при hover по пустой ячейке.
 * Должен совпадать с условиями рендера OccupancyAddPhaseGhost — используется для красных превью занятых слотов.
 */
export function resolveOccupancyAddPhaseHoverSlotKind(
  hoveredCell: OccupancyHoveredTimelineCell | null,
  task: Task,
  totalParts: number,
  position: TaskPosition | undefined,
  qaTask: Task | undefined,
  qaPosition: TaskPosition | undefined,
  isDraggingDev: boolean
): 'dev' | 'qa' | null {
  if (!hoveredCell || hoveredCell.taskId !== task.id || totalParts <= 0) return null;
  const startCell = hoveredCell.dayIndex * PARTS_PER_DAY + hoveredCell.partIndex;
  const devPhaseEndCell = position ? positionToEndCell(position) : 0;
  const targetTask = !position
    ? task
    : qaTask && !qaPosition && startCell >= devPhaseEndCell
      ? qaTask
      : null;
  if (!targetTask) return null;
  const isTargetQa = targetTask.team === 'QA' || isQaOnlyTask(targetTask);
  if (isDraggingDev && isTargetQa) return null;
  return isTargetQa ? 'qa' : 'dev';
}

interface OccupancyAddPhaseGhostProps {
  assignee?: Developer;
  hoveredCell: { taskId: string; dayIndex: number; partIndex: number } | null;
  isDraggingDev?: boolean;
  phaseBarHeightPx: number;
  phaseBarTopOffsetPx: number;
  position?: TaskPosition;
  qaAssignee?: Developer;
  qaPosition?: TaskPosition;
  qaTask?: Task;
  task: Task;
  totalParts: number;
}

export function OccupancyAddPhaseGhost({
  assignee,
  hoveredCell,
  isDraggingDev = false,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  position,
  qaAssignee,
  qaPosition,
  qaTask,
  task,
  totalParts,
}: OccupancyAddPhaseGhostProps) {
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const slotKind = resolveOccupancyAddPhaseHoverSlotKind(
    hoveredCell,
    task,
    totalParts,
    position,
    qaTask,
    qaPosition,
    isDraggingDev
  );
  if (!slotKind || !hoveredCell) return null;
  const targetTask = slotKind === 'qa' && qaTask ? qaTask : task;
  const isTargetQa = slotKind === 'qa';
  const startCell = hoveredCell.dayIndex * PARTS_PER_DAY + hoveredCell.partIndex;
  const duration = Math.max(1, Math.min(storyPointsToTimeslots(getTaskPoints(targetTask)), totalParts - startCell));
  const endCell = startCell + duration;
  const leftPercent = (startCell / totalParts) * 100;
  const rightPercent = ((totalParts - endCell) / totalParts) * 100;
  const cardStyles = getTaskCardStyles(
    isTargetQa ? { ...targetTask, team: 'QA' } : targetTask,
    'swimlane',
    phaseCardColorScheme
  );
  const targetAvatarUrl =
    targetTask === task ? assignee?.avatarUrl ?? null : qaAssignee?.avatarUrl ?? null;
  const nameForInitials =
    targetTask === task
      ? (assignee?.name ?? targetTask.assigneeName)
      : (qaAssignee?.name ?? targetTask.assigneeName);
  const initials =
    nameForInitials
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '—';
  const badgeClass = getTeamTagClasses(isTargetQa ? 'QA' : targetTask.team);

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none opacity-50"
      style={{ zIndex: ZIndex.contentInteractive }}
    >
      <div
        className={`absolute flex items-center justify-center rounded-lg border-2 ${cardStyles.teamColor} ${cardStyles.teamBorder}`}
        style={{
          left: `calc(${leftPercent}% + ${PHASE_PLAN_ROW_INSET_PX}px)`,
          right: `calc(${rightPercent}% + ${PHASE_PLAN_ROW_INSET_PX}px)`,
          height: phaseBarHeightPx,
          top: phaseBarTopOffsetPx,
        }}
      >
        <Avatar
          avatarUrl={targetAvatarUrl}
          initials={initials}
          initialsClassName={badgeClass ?? 'bg-gray-500 dark:bg-gray-600 text-white border-gray-600 dark:border-gray-700'}
          size="xs"
        />
      </div>
    </div>
  );
}
