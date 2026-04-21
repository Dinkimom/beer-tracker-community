'use client';

import type { PlanningPhaseCardColorScheme } from '@/hooks/useLocalStorage';
import type { Developer, Task, TaskLink, TaskPosition } from '@/types';

import Xarrow from 'react-xarrows';

import { hexToRgbaArrow } from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';
import { TASK_ARROWS_DEV_QA_LINK_PREFIX } from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';
import { resolveSwimlaneLinkAnchors } from '@/utils/linkAnchors';
import { getPhaseLinkArrowDefaultHex } from '@/utils/statusColors';

export interface TaskArrowLinkProps {
  arrowPointerEventsEnabled: boolean;
  developers?: Developer[];
  hoveredLinkId: string | null;
  hoveredTaskIdForArrows: string | null;
  link: TaskLink;
  phaseCardColorScheme: PlanningPhaseCardColorScheme;
  taskPositions?: Map<string, TaskPosition>;
  tasksMap: Map<string, Task>;
  onDeleteLink?: (linkId: string) => void;
  onHoveredLinkIdChange: (id: string | null) => void;
}

export function TaskArrowLink({
  arrowPointerEventsEnabled,
  developers,
  hoveredLinkId,
  hoveredTaskIdForArrows,
  link,
  onDeleteLink,
  onHoveredLinkIdChange,
  phaseCardColorScheme,
  taskPositions,
  tasksMap,
}: TaskArrowLinkProps) {
  const isHovered = hoveredLinkId === link.id;
  const isRelatedToHoveredTask =
    hoveredTaskIdForArrows !== null &&
    (link.fromTaskId === hoveredTaskIdForArrows || link.toTaskId === hoveredTaskIdForArrows);
  const fromTask = tasksMap.get(link.fromTaskId);
  const isDevQaLink = link.id.startsWith(TASK_ARROWS_DEV_QA_LINK_PREFIX);
  const canDelete = Boolean(onDeleteLink) && !isDevQaLink;

  const baseColor =
    isHovered && canDelete
      ? '#ef4444'
      : getPhaseLinkArrowDefaultHex(
          phaseCardColorScheme,
          fromTask?.originalStatus,
          fromTask?.statusColorKey
        );
  const opacity = isHovered || isRelatedToHoveredTask ? 1 : 0.2;
  const arrowColor = hexToRgbaArrow(baseColor, opacity);

  const fromPos = taskPositions?.get(link.fromTaskId);
  const toPos = taskPositions?.get(link.toTaskId);
  let startAnchor = link.fromAnchor || 'right';
  let endAnchor = link.toAnchor || 'left';
  if (fromPos && toPos && developers && developers.length > 0) {
    const a = resolveSwimlaneLinkAnchors(fromPos, toPos, developers);
    startAnchor = a.fromAnchor;
    endAnchor = a.toAnchor;
  }

  return (
    <div
      className={arrowPointerEventsEnabled ? 'pointer-events-auto' : 'pointer-events-none'}
      style={{
        cursor:
          arrowPointerEventsEnabled && canDelete && isHovered ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (arrowPointerEventsEnabled && canDelete && isHovered && onDeleteLink) {
          onDeleteLink(link.id);
        }
      }}
      onMouseEnter={() =>
        arrowPointerEventsEnabled && canDelete && onHoveredLinkIdChange(link.id)
      }
      onMouseLeave={() => arrowPointerEventsEnabled && onHoveredLinkIdChange(null)}
    >
      <Xarrow
        animateDrawing={false}
        color={arrowColor}
        curveness={0.5}
        dashness={false}
        end={`task-${link.toTaskId}`}
        endAnchor={endAnchor}
        headSize={4}
        path="smooth"
        start={`task-${link.fromTaskId}`}
        startAnchor={startAnchor}
        strokeWidth={2.5}
      />
    </div>
  );
}
