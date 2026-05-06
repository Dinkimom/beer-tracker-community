'use client';

import type { OccupancyPlanPhaseBarsProps } from './occupancyPlanPhaseBars.types';
import type { TaskPosition } from '@/types';
import type React from 'react';

import {
  getOccupancySegmentEndAnchorId,
  getOccupancySegmentStartAnchorId,
} from '@/features/sprint/components/SprintPlanner/occupancy/utils/task-arrows/occupancyTaskArrowsHelpers';
import { mergeAdjacentSegments } from '@/features/sprint/utils/occupancyUtils';
import { getTeamTagClasses } from '@/utils/teamColors';

import { OccupancyPhaseBar } from './OccupancyPhaseBar';

interface OccupancyDevSegmentPhaseBarsListProps {
  barsProps: OccupancyPlanPhaseBarsProps;
  cardStyles: { teamBorder: string; teamColor: string };
  devSegmentsSorted: NonNullable<TaskPosition['segments']>;
}

export function OccupancyDevSegmentPhaseBarsList({
  barsProps,
  cardStyles,
  devSegmentsSorted,
}: OccupancyDevSegmentPhaseBarsListProps): React.ReactNode {
  const {
    cellsPerDay,
    contextMenuBlurOtherCards = false,
    contextMenuTaskId = null,
    displayAsWeeks,
    effectivelyQa,
    fromWeekPosition,
    getErrorTooltip,
    handleDevPreviewChange,
    hoverConnectedPhaseIds,
    hoveredErrorTaskId,
    initials,
    linkAlreadyExistsFromSource,
    linkingFromTaskId,
    occupancyErrorTaskIds,
    onCompleteLink,
    onContextMenu,
    onPositionSave,
    overlappingTaskIds,
    phaseBarHeightPx,
    phaseBarTopOffsetPx,
    position,
    positionAssignee,
    positionPreviews,
    qaTask,
    quarterlyPhaseStyle,
    setHoveredPhaseTaskId,
    task,
    timelineSettings,
    toWeekPosition,
    totalParts,
    validTargetByTime,
  } = barsProps;

  if (!position?.segments) return null;

  return devSegmentsSorted.map((seg, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === devSegmentsSorted.length - 1;
    return (
      <OccupancyPhaseBar
        key={`dev-seg-${idx}`}
        assigneeDisplayName={positionAssignee?.name}
        avatarUrl={positionAssignee?.avatarUrl}
        badgeClass={effectivelyQa ? getTeamTagClasses('QA') : getTeamTagClasses(task.team)}
        barHeight={phaseBarHeightPx}
        barTopOffset={phaseBarTopOffsetPx}
        cellsPerDay={cellsPerDay}
        contextMenuBlurOtherCards={contextMenuBlurOtherCards}
        contextMenuTaskId={contextMenuTaskId}
        disableDragAndResize={linkingFromTaskId != null}
        errorTooltip={quarterlyPhaseStyle ? undefined : getErrorTooltip(task.id)}
        forceDevColor={quarterlyPhaseStyle}
        hideExtraDuration
        hideLinkRing={linkingFromTaskId != null || idx > 0}
        hoveredErrorTaskId={hoveredErrorTaskId}
        initials={idx === 0 ? initials : ''}
        isBlurredBySiblingDrag={
          (timelineSettings.showFreeSlotPreview ?? true) &&
          qaTask != null &&
          positionPreviews.has(qaTask.id)
        }
        isDimmedByLinkHover={
          linkingFromTaskId == null &&
          hoverConnectedPhaseIds != null &&
          hoverConnectedPhaseIds.size > 1 &&
          !hoverConnectedPhaseIds.has(task.id)
        }
        isInError={quarterlyPhaseStyle ? false : occupancyErrorTaskIds.has(task.id)}
        isInHoveredConnectionGroup={
          hoverConnectedPhaseIds != null && hoverConnectedPhaseIds.has(task.id)
        }
        isLinkSource={idx === 0 && linkingFromTaskId === task.id}
        isLinkTarget={
          idx === 0 &&
          linkingFromTaskId != null &&
          linkingFromTaskId !== task.id &&
          !linkAlreadyExistsFromSource &&
          validTargetByTime
        }
        isOverlapping={overlappingTaskIds?.has(task.id) ?? false}
        isQa={effectivelyQa}
        originalStatus={task.originalStatus}
        position={
          displayAsWeeks
            ? toWeekPosition({
                ...position,
                duration: seg.duration,
                startDay: seg.startDay,
                startPart: seg.startPart,
              })
            : { ...position, duration: seg.duration, startDay: seg.startDay, startPart: seg.startPart }
        }
        segmentBadge={
          devSegmentsSorted.length > 1 ? { index: idx + 1, total: devSegmentsSorted.length } : null
        }
        segmentEndAnchorId={getOccupancySegmentEndAnchorId(task.id, idx)}
        segmentStartAnchorId={getOccupancySegmentStartAnchorId(task.id, idx)}
        showEndAnchor={isLast}
        showPhaseId={isFirst}
        showStartAnchor={isFirst}
        showToolsEmoji={quarterlyPhaseStyle}
        task={task}
        taskId={task.id}
        teamBorder={cardStyles.teamBorder}
        teamColor={cardStyles.teamColor}
        totalParts={totalParts}
        onCompleteLink={onCompleteLink}
        onContextMenu={onContextMenu}
        onPhaseHoverEnter={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(task.id) : undefined}
        onPhaseHoverLeave={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(null) : undefined}
        onPreviewChange={handleDevPreviewChange}
        onSave={(p) => {
          const dayP = displayAsWeeks ? fromWeekPosition(p) : p;
          const newSegments = [...position.segments!];
          const origIdx = position.segments!.findIndex(
            (s) =>
              s.startDay === seg.startDay && s.startPart === seg.startPart && s.duration === seg.duration
          );
          if (origIdx !== -1) {
            newSegments[origIdx] = {
              duration: dayP.duration,
              startDay: dayP.startDay,
              startPart: dayP.startPart,
            };
          }
          const merged = mergeAdjacentSegments(newSegments);
          const effectiveDuration = merged.reduce((sum, s) => sum + s.duration, 0);
          onPositionSave?.(
            {
              ...position,
              duration: effectiveDuration,
              plannedDuration: effectiveDuration,
              segments: merged,
            },
            false
          );
        }}
      />
    );
  });
}
