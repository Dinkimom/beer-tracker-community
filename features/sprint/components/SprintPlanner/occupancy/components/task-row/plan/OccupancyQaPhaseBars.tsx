'use client';

import type { OccupancyPlanPhaseBarsProps } from './occupancyPlanPhaseBars.types';
import type React from 'react';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { PARTS_PER_DAY } from '@/constants';
import {
  getOccupancySegmentEndAnchorId,
  getOccupancySegmentStartAnchorId,
} from '@/features/sprint/components/SprintPlanner/occupancy/utils/task-arrows/occupancyTaskArrowsHelpers';
import { getSegmentEditorRangeAndCells, mergeAdjacentSegments } from '@/features/sprint/utils/occupancyUtils';
import { getTaskCardStyles } from '@/features/task/components/TaskCard/components/TaskCardBody';
import { getTeamTagClasses } from '@/utils/teamColors';

import { OccupancyPhaseBar } from './OccupancyPhaseBar';
import { PhaseSegmentInlineEditor } from './PhaseSegmentInlineEditor';

export function OccupancyQaPhaseBars({
  cellsPerDay,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  displayAsWeeks,
  fromWeekPosition,
  getErrorTooltip,
  handlePositionPreview,
  hoverConnectedPhaseIds,
  hoveredErrorTaskId,
  linkAlreadyExistsFromSource,
  linkedQaPreviewStart,
  linkingFromTaskId,
  occupancyErrorTaskIds,
  onCompleteLink,
  onContextMenu,
  onPositionSave,
  onSegmentEditCancel,
  onSegmentEditSave,
  overlappingTaskIds,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  positionPreviews,
  qaAssignee,
  qaInitials,
  qaPosition,
  qaPositionAssignee,
  qaTask,
  quarterlyPhaseStyle,
  segmentEditTaskId,
  setHoveredPhaseTaskId,
  task,
  timelineSettings,
  toWeekPosition,
  totalParts,
  validTargetByTime,
}: OccupancyPlanPhaseBarsProps) {
  const phaseCardColorScheme = usePhaseCardColorScheme();
  if (!qaTask || !qaPosition) return null;

  const qaAvatarUrl = qaPositionAssignee?.avatarUrl ?? qaAssignee?.avatarUrl;
  const qaAssigneeDisplayName = qaPositionAssignee?.name ?? qaAssignee?.name;

  if (segmentEditTaskId === qaTask.id && onSegmentEditSave && onSegmentEditCancel) {
    const { rangeStartCell, totalCells, initialCells } = getSegmentEditorRangeAndCells(qaPosition);
    const cardStyles = getTaskCardStyles(qaTask, 'swimlane', phaseCardColorScheme);
    return (
      <PhaseSegmentInlineEditor
        avatarUrl={qaAvatarUrl}
        badgeClass={getTeamTagClasses('QA')}
        barHeight={phaseBarHeightPx}
        barTopOffset={phaseBarTopOffsetPx}
        initialCells={initialCells}
        initials={qaInitials}
        isQa
        originalStatus={qaTask.originalStatus}
        rangeStartCell={rangeStartCell}
        statusColorKey={qaTask.statusColorKey}
        teamBorder={cardStyles.teamBorder}
        teamColor={cardStyles.teamColor}
        totalCells={totalCells}
        totalParts={totalParts}
        onCancel={onSegmentEditCancel}
        onSave={(segments) => {
          onSegmentEditSave!(qaPosition, segments, true);
        }}
      />
    );
  }

  const cardStyles = getTaskCardStyles(qaTask, 'swimlane', phaseCardColorScheme);
  const qaSegmentsSorted =
    qaPosition.segments && qaPosition.segments.length > 0
      ? [...qaPosition.segments].sort(
          (a, b) =>
            a.startDay * PARTS_PER_DAY + a.startPart - (b.startDay * PARTS_PER_DAY + b.startPart)
        )
      : null;

  if (qaSegmentsSorted && qaSegmentsSorted.length > 0) {
    const qaBars = qaSegmentsSorted.map((seg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === qaSegmentsSorted!.length - 1;
      return (
        <OccupancyPhaseBar
          key={`qa-seg-${idx}`}
          assigneeDisplayName={qaAssigneeDisplayName}
          avatarUrl={qaAvatarUrl}
          badgeClass={getTeamTagClasses('QA')}
          barHeight={phaseBarHeightPx}
          barTopOffset={phaseBarTopOffsetPx}
          cellsPerDay={cellsPerDay}
          contextMenuBlurOtherCards={contextMenuBlurOtherCards}
          contextMenuTaskId={contextMenuTaskId}
          disableDragAndResize={linkingFromTaskId != null}
          errorTooltip={quarterlyPhaseStyle ? undefined : getErrorTooltip(qaTask.id)}
          externalDragStartCell={isFirst ? linkedQaPreviewStart : undefined}
          forceDevColor={quarterlyPhaseStyle}
          hideExtraDuration
          hideLinkRing={linkingFromTaskId != null || idx > 0}
          hoveredErrorTaskId={hoveredErrorTaskId}
          initials={idx === 0 ? qaInitials : ''}
          isBlurredBySiblingDrag={(timelineSettings.showFreeSlotPreview ?? true) && positionPreviews.has(task.id)}
          isDimmedByLinkHover={
            linkingFromTaskId == null &&
            hoverConnectedPhaseIds != null &&
            hoverConnectedPhaseIds.size > 1 &&
            !hoverConnectedPhaseIds.has(qaTask.id)
          }
          isInError={quarterlyPhaseStyle ? false : occupancyErrorTaskIds.has(qaTask.id)}
          isInHoveredConnectionGroup={hoverConnectedPhaseIds != null && hoverConnectedPhaseIds.has(qaTask.id)}
          isLinkSource={idx === 0 && linkingFromTaskId === qaTask.id}
          isLinkTarget={idx === 0 && linkingFromTaskId != null && linkingFromTaskId !== qaTask.id && !linkAlreadyExistsFromSource && validTargetByTime}
          isOverlapping={overlappingTaskIds?.has(qaTask.id) ?? false}
          isQa
          originalStatus={qaTask.originalStatus}
          position={
            displayAsWeeks
              ? toWeekPosition({ ...qaPosition, startDay: seg.startDay, startPart: seg.startPart, duration: seg.duration })
              : { ...qaPosition, startDay: seg.startDay, startPart: seg.startPart, duration: seg.duration }
          }
          segmentBadge={
            qaSegmentsSorted.length > 1
              ? { index: idx + 1, total: qaSegmentsSorted.length }
              : null
          }
          segmentEndAnchorId={getOccupancySegmentEndAnchorId(qaTask.id, idx)}
          segmentStartAnchorId={getOccupancySegmentStartAnchorId(qaTask.id, idx)}
          showEndAnchor={isLast}
          showPhaseId={isFirst}
          showStartAnchor={isFirst}
          showToolsEmoji={quarterlyPhaseStyle}
          task={qaTask}
          taskId={qaTask.id}
          teamBorder={cardStyles.teamBorder}
          teamColor={cardStyles.teamColor}
          totalParts={totalParts}
          onCompleteLink={onCompleteLink}
          onContextMenu={onContextMenu}
          onPhaseHoverEnter={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(qaTask.id) : undefined}
          onPhaseHoverLeave={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(null) : undefined}
          onPreviewChange={(preview) => handlePositionPreview(qaTask.id, preview)}
          onSave={(p) => {
            const dayP = displayAsWeeks ? fromWeekPosition(p) : p;
            const newSegments = [...qaPosition.segments!];
            const origIdx = qaPosition.segments!.findIndex(
              (s) => s.startDay === seg.startDay && s.startPart === seg.startPart && s.duration === seg.duration
            );
            if (origIdx !== -1) newSegments[origIdx] = { startDay: dayP.startDay, startPart: dayP.startPart, duration: dayP.duration };
            const merged = mergeAdjacentSegments(newSegments);
            const effectiveDuration = merged.reduce((sum, s) => sum + s.duration, 0);
            onPositionSave?.(
              { ...qaPosition, segments: merged, duration: effectiveDuration, plannedDuration: effectiveDuration },
              true,
              qaTask.originalTaskId
            );
          }}
        />
      );
    });
    return qaBars as React.ReactNode;
  }

  return (
    <OccupancyPhaseBar
      key="qa"
      assigneeDisplayName={qaAssigneeDisplayName}
      avatarUrl={qaAvatarUrl}
      badgeClass={getTeamTagClasses('QA')}
      barHeight={phaseBarHeightPx}
      barTopOffset={phaseBarTopOffsetPx}
      cellsPerDay={cellsPerDay}
      contextMenuBlurOtherCards={contextMenuBlurOtherCards}
      contextMenuTaskId={contextMenuTaskId}
      disableDragAndResize={linkingFromTaskId != null}
      errorTooltip={quarterlyPhaseStyle ? undefined : getErrorTooltip(qaTask.id)}
      externalDragStartCell={linkedQaPreviewStart}
      forceDevColor={quarterlyPhaseStyle}
      hideExtraDuration={quarterlyPhaseStyle}
      hideLinkRing={linkingFromTaskId != null}
      hoveredErrorTaskId={hoveredErrorTaskId}
      initials={qaInitials}
      isBlurredBySiblingDrag={(timelineSettings.showFreeSlotPreview ?? true) && positionPreviews.has(task.id)}
      isDimmedByLinkHover={
        linkingFromTaskId == null &&
        hoverConnectedPhaseIds != null &&
        hoverConnectedPhaseIds.size > 1 &&
        !hoverConnectedPhaseIds.has(qaTask.id)
      }
      isInError={quarterlyPhaseStyle ? false : occupancyErrorTaskIds.has(qaTask.id)}
      isInHoveredConnectionGroup={hoverConnectedPhaseIds != null && hoverConnectedPhaseIds.has(qaTask.id)}
      isLinkSource={linkingFromTaskId === qaTask.id}
      isLinkTarget={linkingFromTaskId != null && linkingFromTaskId !== qaTask.id && !linkAlreadyExistsFromSource && validTargetByTime}
      isOverlapping={overlappingTaskIds?.has(qaTask.id) ?? false}
      isQa
      originalStatus={qaTask.originalStatus}
      position={displayAsWeeks ? toWeekPosition(qaPosition) : qaPosition}
      showToolsEmoji={quarterlyPhaseStyle}
      task={qaTask}
      taskId={qaTask.id}
      teamBorder={cardStyles.teamBorder}
      teamColor={cardStyles.teamColor}
      totalParts={totalParts}
      onCompleteLink={onCompleteLink}
      onContextMenu={onContextMenu}
      onPhaseHoverEnter={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(qaTask.id) : undefined}
      onPhaseHoverLeave={setHoveredPhaseTaskId ? () => setHoveredPhaseTaskId(null) : undefined}
      onPreviewChange={(preview) => handlePositionPreview(qaTask.id, preview)}
      onSave={(p) => {
        const normalized = displayAsWeeks ? fromWeekPosition(p) : p;
        onPositionSave?.({ ...normalized, segments: normalized.segments ?? [] }, true, qaTask.originalTaskId);
      }}
    />
  );
}
