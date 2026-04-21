'use client';

import type { PositionPreview } from '../OccupancyPhaseBar';
import type { Task, TaskPosition } from '@/types';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { positionToEndCell } from '@/features/sprint/utils/occupancyUtils';

interface OccupancyLinkButtonProps {
  linkingFromTaskId: string | null;
  phaseBarHeightPx: number;
  phaseBarTopOffsetPx: number;
  position?: TaskPosition;
  positionPreviews: Map<string, PositionPreview>;
  qaPosition?: TaskPosition;
  qaTask?: Task;
  task: Task;
  totalParts: number;
  onCancelLinking?: () => void;
  onStartLinking?: (taskId: string) => void;
}

export function OccupancyLinkButton({
  linkingFromTaskId,
  onCancelLinking,
  onStartLinking,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  position,
  positionPreviews,
  qaPosition,
  qaTask,
  task,
  totalParts,
}: OccupancyLinkButtonProps) {
  const devEndCell = position ? positionToEndCell(position) : 0;
  const qaEndCell = qaPosition && qaTask ? positionToEndCell(qaPosition) : 0;
  const rightEdgePercent =
    totalParts > 0 ? (Math.max(devEndCell, qaEndCell) / totalParts) * 100 : 0;
  const startPhaseId = position ? task.id : qaPosition && qaTask ? qaTask.id : null;
  const isPhaseBeingDraggedOrResized =
    positionPreviews.has(task.id) || (qaTask != null && positionPreviews.has(qaTask.id));

  if (!onStartLinking || !startPhaseId) return null;
  if (linkingFromTaskId != null && linkingFromTaskId !== startPhaseId) return null;
  if (isPhaseBeingDraggedOrResized) return null;

  const phaseBarCenterTop = phaseBarTopOffsetPx + phaseBarHeightPx / 2;
  const buttonHeightPx = 24;
  const isLinkModeActive = linkingFromTaskId === startPhaseId;

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLinkModeActive && onCancelLinking) {
      onCancelLinking();
      (e.currentTarget as HTMLButtonElement)?.blur();
    } else {
      onStartLinking?.(startPhaseId);
    }
  };

  return (
    <div
      className="absolute w-8 flex items-center justify-end pointer-events-auto z-[100]"
      data-occupancy-link-cancel
      style={{
        left: `calc(${rightEdgePercent}% + 0px)`,
        top: phaseBarCenterTop - buttonHeightPx / 2,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Button
        className={`!h-6 !w-6 !min-h-0 !min-w-0 !justify-center !p-0 text-blue-600 shadow-sm transition-opacity duration-300 ease-out transition-shadow duration-200 hover:!shadow-lg focus-visible:outline-none dark:text-blue-400 !bg-white !border-gray-200 hover:!bg-blue-50 dark:!bg-gray-800 dark:!border-gray-600 dark:hover:!bg-blue-900/30 ${
          isLinkModeActive
            ? 'opacity-100'
            : 'opacity-0 group-hover/phase-row:opacity-100 hover:!opacity-100 focus-visible:!opacity-100'
        }`}
        title={isLinkModeActive ? 'Закрыть режим связей' : 'Связать с другой фазой'}
        type="button"
        variant="outline"
        onClick={handleButtonClick}
      >
        <Icon className="h-3.5 w-3.5" name={isLinkModeActive ? 'x' : 'link'} />
      </Button>
    </div>
  );
}
