'use client';

import type { OccupancyPlanPhaseBarsProps } from './occupancyPlanPhaseBars.types';
import type React from 'react';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { getTaskCardStyles } from '@/features/task/components/TaskCard/components/TaskCardBody';
import { getTeamTagClasses } from '@/utils/teamColors';

import { quarterlyDevPhaseDurationLabel, sortPhaseSegmentsByTimeline } from './occupancyDevPhaseBarsHelpers';
import { OccupancyDevSegmentEditor } from './OccupancyDevSegmentEditor';
import { OccupancyDevSegmentPhaseBarsList } from './OccupancyDevSegmentPhaseBarsList';
import { OccupancyPhaseBar } from './OccupancyPhaseBar';
import { OccupancyPlannedInSprintBars } from './OccupancyPlannedInSprintBars';

export function OccupancyDevPhaseBars(props: OccupancyPlanPhaseBarsProps) {
  const {
    cellsPerDay,
    contextMenuBlurOtherCards = false,
    contextMenuTaskId = null,
    displayAsWeeks,
    effectivelyQa,
    fromWeekPosition,
    getErrorTooltip,
    handleDevPositionSave,
    handleDevPreviewChange,
    hoverConnectedPhaseIds,
    hoveredErrorTaskId,
    initials,
    linkAlreadyExistsFromSource,
    linkingFromTaskId,
    occupancyErrorTaskIds,
    onCompleteLink,
    onContextMenu,
    onSegmentEditCancel,
    onSegmentEditSave,
    overlappingTaskIds,
    phaseBarHeightPx,
    phaseBarTopOffsetPx,
    plannedInSprintPositions = [],
    position,
    positionAssignee,
    positionPreviews,
    qaTask,
    quarterlyPhaseStyle,
    segmentEditTaskId,
    setHoveredPhaseTaskId,
    task,
    timelineSettings,
    toWeekPosition,
    totalParts,
    validTargetByTime,
  } = props;

  const phaseCardColorScheme = usePhaseCardColorScheme();
  if (!position) return null;

  if (segmentEditTaskId === task.id && onSegmentEditSave && onSegmentEditCancel) {
    return (
      <OccupancyDevSegmentEditor
        effectivelyQa={effectivelyQa}
        initials={initials}
        phaseBarHeightPx={phaseBarHeightPx}
        phaseBarTopOffsetPx={phaseBarTopOffsetPx}
        position={position}
        positionAssignee={positionAssignee}
        segmentEditTaskId={segmentEditTaskId}
        task={task}
        totalParts={totalParts}
        onSegmentEditCancel={onSegmentEditCancel}
        onSegmentEditSave={onSegmentEditSave}
      />
    );
  }

  const cardStyles = effectivelyQa
    ? getTaskCardStyles({ ...task, team: 'QA' }, 'swimlane', phaseCardColorScheme)
    : getTaskCardStyles(task, 'swimlane', phaseCardColorScheme);

  const devSegmentsSorted =
    position.segments && position.segments.length > 0
      ? sortPhaseSegmentsByTimeline(position.segments)
      : null;

  if (devSegmentsSorted && devSegmentsSorted.length > 0) {
    return (
      <OccupancyDevSegmentPhaseBarsList
        barsProps={props}
        cardStyles={cardStyles}
        devSegmentsSorted={devSegmentsSorted}
      />
    );
  }

  const plannedInSprintList = plannedInSprintPositions ?? [];
  const hasPlannedInSprint = quarterlyPhaseStyle && plannedInSprintList.length > 0;
  const planBarHeight = phaseBarHeightPx;
  const planBarTop = phaseBarTopOffsetPx;
  const planToSprintBarGapPx = 8;
  const sprintBarTop = planBarTop + planBarHeight + planToSprintBarGapPx;
  const planPhaseDurationLabel = quarterlyDevPhaseDurationLabel(quarterlyPhaseStyle, position.duration);

  return (
    <>
      <OccupancyPhaseBar
        key="dev"
        assigneeDisplayName={positionAssignee?.name}
        avatarUrl={positionAssignee?.avatarUrl}
        badgeClass={effectivelyQa ? getTeamTagClasses('QA') : getTeamTagClasses(task.team)}
        barHeight={planBarHeight}
        barTopOffset={planBarTop}
        cellsPerDay={cellsPerDay}
        contextMenuBlurOtherCards={contextMenuBlurOtherCards}
        contextMenuTaskId={contextMenuTaskId}
        disableDragAndResize={linkingFromTaskId != null}
        elevationAbove={!!quarterlyPhaseStyle}
        errorTooltip={quarterlyPhaseStyle ? undefined : getErrorTooltip(task.id)}
        forceDevColor={quarterlyPhaseStyle}
        hideExtraDuration={quarterlyPhaseStyle || segmentEditTaskId != null}
        hideLinkRing={linkingFromTaskId != null}
        hoveredErrorTaskId={hoveredErrorTaskId}
        initials={initials}
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
        isLinkSource={linkingFromTaskId === task.id}
        isLinkTarget={
          linkingFromTaskId != null &&
          linkingFromTaskId !== task.id &&
          !linkAlreadyExistsFromSource &&
          validTargetByTime
        }
        isOverlapping={overlappingTaskIds?.has(task.id) ?? false}
        isQa={effectivelyQa}
        originalStatus={task.originalStatus}
        phaseDurationLabel={planPhaseDurationLabel}
        position={displayAsWeeks ? toWeekPosition(position) : position}
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
          const normalized = displayAsWeeks ? fromWeekPosition(p) : p;
          handleDevPositionSave({ ...normalized, segments: normalized.segments ?? [] });
        }}
      />
      {hasPlannedInSprint && (
        <OccupancyPlannedInSprintBars
          cellsPerDay={cellsPerDay}
          contextMenuBlurOtherCards={contextMenuBlurOtherCards}
          contextMenuTaskId={contextMenuTaskId}
          displayAsWeeks={displayAsWeeks}
          effectivelyQa={effectivelyQa}
          plannedInSprintList={plannedInSprintList}
          sprintBarTop={sprintBarTop}
          task={task}
          teamBorder={cardStyles.teamBorder}
          teamColor={cardStyles.teamColor}
          toWeekPosition={toWeekPosition}
          totalParts={totalParts}
        />
      )}
    </>
  );
}
