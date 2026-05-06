'use client';

import type { OccupancyPhaseBarProps } from './occupancyPhaseBar.types';

import React, { useMemo } from 'react';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { TextTooltip } from '@/components/TextTooltip';
import { PARTS_PER_DAY } from '@/constants';
import { getTaskPoints } from '@/features/task/utils/taskUtils';
import { useDocumentDarkClass } from '@/hooks/useDocumentDarkClass';
import { storyPointsToTimeslots, timeslotsToStoryPoints } from '@/lib/pointsUtils';
import {
  getMonochromeBorderParts,
  getPhaseDividerClasses,
  getQaStripedStyles,
  getResizeHandleColors,
  getStatusColors,
  resolvePaletteStatusKey,
  resolveStatusForPhaseCardColors,
} from '@/utils/statusColors';

import { usePhaseBarDragResize } from '../../../hooks/usePhaseBarDragResize';
import { usePhaseBarOpacity } from '../../../hooks/usePhaseBarOpacity';
import { getPhaseFocusRingClass } from '../../shared/phaseFocusRing';

import { OccupancyPhaseBarBarContents } from './components/OccupancyPhaseBarBarContents';
import { OccupancyPhaseDragSourceGhost } from './components/OccupancyPhaseDragSourceGhost';
import { PlannedInSprintTooltipContent } from './components/PlannedInSprintTooltipContent';
import {
  buildOccupancyPhaseBarSurfaceClass,
  resolvePhaseBarPointerEvents,
  resolvePhaseBarStripeOverlayStyle,
} from './occupancyPhaseBarBarHelpers';
import {
  PHASE_BAR_HEIGHT_COMPACT_PX,
  PHASE_BAR_HEIGHT_PX,
  PHASE_BAR_TOP_OFFSET_PX,
  PHASE_PLAN_ROW_INSET_PX,
  TOTAL_PARTS,
} from './occupancyPhaseBarConstants';
import {
  resolvePhaseBorderOnlyClass,
  resolvePhaseColorClass,
  resolvePhaseFillClass,
} from './occupancyPhaseBarResolveClasses';
import { resolveOccupancyBarZIndex } from './occupancyPhaseBarZIndex';

function OccupancyPhaseBarInner({
  originalStatus,
  assigneeDisplayName,
  avatarUrl,
  initials,
  elevationAbove = false,
  isQa,
  isInError,
  isOverlapping = false,
  hoveredErrorTaskId,
  barHeight,
  barTopOffset,
  externalDragStartCell,
  onContextMenu,
  onPreviewChange,
  onSave,
  phaseDateRangeLabel,
  phaseDurationLabel,
  plannedInSprintVariant = false,
  pointerEventsNone,
  position,
  readonly = false,
  segmentEndAnchorId,
  segmentStartAnchorId,
  showEndAnchor = true,
  showPhaseId = true,
  showStartAnchor = true,
  showToolsEmoji = false,
  task,
  taskId,
  teamBorder,
  teamColor,
  teamPlanVariant = false,
  badgeClass,
  errorTooltip,
  totalParts: totalPartsProp,
  disableDragAndResize = false,
  isDimmedByLinkHover = false,
  isBlurredBySiblingDrag = false,
  isInHoveredConnectionGroup = false,
  hideExtraDuration = false,
  hideLinkRing = false,
  isLinkSource = false,
  isLinkTarget = false,
  onPhaseHoverEnter,
  onPhaseHoverLeave,
  onCompleteLink,
  cellsPerDay = 3,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  forceDevColor = false,
  forceReleaseStyle = false,
}: OccupancyPhaseBarProps) {
  const resolvedTotalParts = totalPartsProp ?? TOTAL_PARTS;
  const isDark = useDocumentDarkClass();
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const paletteStatusKey = resolvePaletteStatusKey(originalStatus, task.statusColorKey);
  const statusForColors = resolveStatusForPhaseCardColors(
    phaseCardColorScheme,
    originalStatus,
    task.statusColorKey
  );

  const isDayMode = cellsPerDay === 1;
  const startCell = isDayMode
    ? position.startDay
    : position.startDay * PARTS_PER_DAY + position.startPart;
  const durationCells = isDayMode
    ? Math.max(1, Math.ceil(position.duration / PARTS_PER_DAY))
    : position.duration;
  const endCell = startCell + durationCells;

  const { style: qaStripedStyle, baseColor: qaBaseColor } =
    !forceDevColor && isQa
      ? getQaStripedStyles(statusForColors, isDark)
      : { style: undefined, baseColor: undefined };

  const devBlueColors = useMemo(() => {
    if (phaseCardColorScheme === 'monochrome') {
      const b = getStatusColors('backlog');
      const { border, borderDark } = getMonochromeBorderParts(originalStatus);
      return { ...b, border, borderDark };
    }
    return getStatusColors('inprogress');
  }, [phaseCardColorScheme, originalStatus]);

  const closedGreenColors = useMemo(() => {
    if (phaseCardColorScheme === 'monochrome') {
      const b = getStatusColors('backlog');
      const { border, borderDark } = getMonochromeBorderParts(originalStatus);
      return { ...b, border, borderDark };
    }
    return getStatusColors('closed');
  }, [phaseCardColorScheme, originalStatus]);

  const plannedInSprintColors = useMemo(() => {
    if (!plannedInSprintVariant) return null;
    if (phaseCardColorScheme === 'monochrome') {
      const b = getStatusColors('backlog');
      const { border, borderDark } = getMonochromeBorderParts(originalStatus);
      return { ...b, border, borderDark };
    }
    if (originalStatus) return getStatusColors(paletteStatusKey ?? originalStatus);
    return devBlueColors;
  }, [plannedInSprintVariant, originalStatus, paletteStatusKey, devBlueColors, phaseCardColorScheme]);
  const barColors = plannedInSprintVariant
    ? (plannedInSprintColors ?? devBlueColors)
    : null;

  const phaseClassCtx = {
    barColors,
    closedGreenColors,
    devBlueColors,
    forceDevColor,
    forceReleaseStyle,
    plannedInSprintVariant,
    qaStripedStyle,
    teamBorder,
    teamColor,
    teamPlanVariant,
  };
  const phaseColorClass = resolvePhaseColorClass(phaseClassCtx);
  const phaseBorderOnlyClass = resolvePhaseBorderOnlyClass(phaseClassCtx);
  const phaseFillClass = resolvePhaseFillClass(phaseClassCtx);

  const dividerBgClass = forceDevColor
    ? `${devBlueColors.border} ${devBlueColors.borderDark ?? ''}`.trim()
    : getPhaseDividerClasses(statusForColors, isQa);

  const handleColors = useMemo(
    () =>
      forceDevColor
        ? {
            bg: devBlueColors.resizeHandle.bg,
            bgDark: devBlueColors.resizeHandleDark?.bg ?? '',
            line: devBlueColors.resizeHandle.line,
            lineDark: devBlueColors.resizeHandleDark?.line ?? '',
          }
        : getResizeHandleColors(paletteStatusKey ?? originalStatus, isQa, phaseCardColorScheme),
    [forceDevColor, originalStatus, paletteStatusKey, isQa, phaseCardColorScheme, devBlueColors]
  );

  const {
    displayDuration,
    handleDragStart,
    handleResizeStart,
    hoverLeft,
    hoverRight,
    isDragging,
    isGrabbedForDrag,
    isResizing,
    leftPercent,
    rightPercent,
    resizeSide,
    setHoverLeft,
    setHoverRight,
  } = usePhaseBarDragResize({
    position,
    task,
    isDayMode,
    durationCells,
    startCell,
    endCell,
    resolvedTotalParts,
    onSave,
    onPreviewChange,
    externalDragStartCell,
  });

  const isNarrow = displayDuration < 2;
  const estimatedSP = getTaskPoints(task);
  const estimatedTimeslots = storyPointsToTimeslots(estimatedSP);
  /** Уже сохранённая длина фазы (без превью ресайза): после переоценки по ресайзу она совпадает с планом, даже если task.* ещё не подтянулся с API */
  const baselineTimeslots = Math.max(estimatedTimeslots, durationCells);
  const baselineSP = Math.max(estimatedSP, timeslotsToStoryPoints(durationCells));
  const extraTimeslots = hideExtraDuration
    ? 0
    : Math.max(0, displayDuration - baselineTimeslots);
  const extraSP = hideExtraDuration
    ? 0
    : Math.max(0, timeslotsToStoryPoints(displayDuration) - baselineSP);
  const estimatedPercent =
    displayDuration > 0 ? (baselineTimeslots / displayDuration) * 100 : 0;
  const extraPercent =
    displayDuration > 0 ? (extraTimeslots / displayDuration) * 100 : 0;

  /** Доп. объём (+N sp/tp и деление полосы) — только во время ресайза; в статике полоса цельная */
  const showExtraPlanDuration =
    !hideExtraDuration && isResizing && extraTimeslots > 0;

  const { opacity, backgroundDimmed } = usePhaseBarOpacity({
    hoveredErrorTaskId,
    isOverlapping,
    isDimmedByLinkHover,
    isGrabbedForDrag,
    isDragging,
    isResizing,
    isBlurredBySiblingDrag,
  });

  const isContextMenuForThisPhase =
    contextMenuBlurOtherCards &&
    contextMenuTaskId != null &&
    contextMenuTaskId === taskId;
  const dimPeersByContextMenu =
    contextMenuBlurOtherCards &&
    contextMenuTaskId != null &&
    contextMenuTaskId !== taskId;
  const opacityWithContextMenu = opacity * (dimPeersByContextMenu ? 0.5 : 1);

  const effectiveBarHeight = barHeight ?? PHASE_BAR_HEIGHT_PX;
  const compactRowMode =
    effectiveBarHeight <= PHASE_BAR_HEIGHT_COMPACT_PX + 2;

  const linkRingClass =
    hideLinkRing || isContextMenuForThisPhase
      ? ''
      : getPhaseFocusRingClass(isLinkSource, 'source') ||
        getPhaseFocusRingClass(isLinkTarget, 'target');

  const contextMenuBorderClass = isContextMenuForThisPhase
    ? '!border-blue-500 dark:!border-blue-400'
    : '';

  const barZIndex = resolveOccupancyBarZIndex(
    isContextMenuForThisPhase,
    elevationAbove,
    isQa
  );

  const barSurfaceClass = buildOccupancyPhaseBarSurfaceClass(
    isInHoveredConnectionGroup,
    backgroundDimmed,
    phaseBorderOnlyClass,
    phaseColorClass,
    linkRingClass,
    contextMenuBorderClass,
    disableDragAndResize,
    isLinkTarget
  );

  const barStripeStyle = resolvePhaseBarStripeOverlayStyle(
    backgroundDimmed,
    isQa,
    showExtraPlanDuration,
    qaStripedStyle
  );

  const showDragSourceGhost = (isGrabbedForDrag || isDragging) && !isResizing;
  const dragSourceGhost = showDragSourceGhost ? (
    <OccupancyPhaseDragSourceGhost
      barHeightPx={barHeight ?? PHASE_BAR_HEIGHT_PX}
      barTopOffsetPx={barTopOffset ?? PHASE_BAR_TOP_OFFSET_PX}
      barZIndex={barZIndex}
      endCell={endCell}
      planRowInsetPx={PHASE_PLAN_ROW_INSET_PX}
      resolvedTotalParts={resolvedTotalParts}
      startCell={startCell}
    />
  ) : null;

  const bar = (
    <div
      className={barSurfaceClass}
      data-context-menu-source={onContextMenu ? 'occupancy-phase' : undefined}
      data-occupancy-bar
      data-task-id={taskId}
      id={showPhaseId ? `occupancy-phase-${taskId}` : undefined}
      style={{
        left: `calc(${leftPercent}% + ${PHASE_PLAN_ROW_INSET_PX}px)`,
        right: `calc(${rightPercent}% + ${PHASE_PLAN_ROW_INSET_PX}px)`,
        height: barHeight ?? PHASE_BAR_HEIGHT_PX,
        opacity: opacityWithContextMenu,
        top: barTopOffset ?? PHASE_BAR_TOP_OFFSET_PX,
        zIndex: barZIndex,
        pointerEvents: resolvePhaseBarPointerEvents(dimPeersByContextMenu, pointerEventsNone ?? false),
        touchAction: 'none',
        ...barStripeStyle,
      }}
      onClick={(e) => {
        if (isLinkTarget && onCompleteLink) {
          e.preventDefault();
          e.stopPropagation();
          onCompleteLink(taskId);
        }
      }}
      onContextMenu={(e) => {
        if (!isDragging && !isResizing && onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, task, false);
        }
      }}
      onMouseDown={(e) => {
        if (isLinkTarget) return;
        if (disableDragAndResize || readonly) return;
        handleDragStart(e);
      }}
      onMouseEnter={onPhaseHoverEnter}
      onMouseLeave={onPhaseHoverLeave}
    >
      <OccupancyPhaseBarBarContents
        assigneeDisplayName={assigneeDisplayName}
        avatarUrl={avatarUrl}
        backgroundDimmed={backgroundDimmed}
        badgeClass={badgeClass}
        compactRowMode={compactRowMode}
        disableDragAndResize={disableDragAndResize}
        dividerBgClass={dividerBgClass}
        errorTooltip={errorTooltip}
        estimatedPercent={estimatedPercent}
        extraPercent={extraPercent}
        extraSP={extraSP}
        forceReleaseStyle={forceReleaseStyle}
        handleColors={handleColors}
        handleResizeStart={handleResizeStart}
        hideResizeHandles={(isGrabbedForDrag || isDragging) && !isResizing}
        hoverLeft={hoverLeft}
        hoverRight={hoverRight}
        initials={initials}
        isInError={isInError}
        isNarrow={isNarrow}
        isQa={isQa}
        phaseDateRangeLabel={phaseDateRangeLabel}
        phaseDurationLabel={phaseDurationLabel}
        phaseFillClass={phaseFillClass}
        plannedInSprintVariant={plannedInSprintVariant}
        pointerEventsNone={pointerEventsNone}
        position={position}
        qaBaseColor={qaBaseColor}
        qaStripedStyle={qaStripedStyle}
        readonly={readonly}
        resizeSide={resizeSide}
        segmentEndAnchorId={segmentEndAnchorId}
        segmentStartAnchorId={segmentStartAnchorId}
        setHoverLeft={setHoverLeft}
        setHoverRight={setHoverRight}
        showEndAnchor={showEndAnchor}
        showExtraPlanDuration={showExtraPlanDuration}
        showStartAnchor={showStartAnchor}
        showToolsEmoji={showToolsEmoji}
        taskId={taskId}
        teamPlanVariant={teamPlanVariant}
      />
    </div>
  );

  if (plannedInSprintVariant && position.sourceTaskId) {
    return (
      <TextTooltip
        content={
          <PlannedInSprintTooltipContent
            taskKey={position.sourceTaskId}
          />
        }
        contentClassName="!p-0 !shadow-none !max-w-none !bg-white dark:!bg-gray-800"
        delayDuration={400}
        interactive
      >
        <>
          {dragSourceGhost}
          {bar}
        </>
      </TextTooltip>
    );
  }
  return (
    <>
      {dragSourceGhost}
      {bar}
    </>
  );
}

OccupancyPhaseBarInner.displayName = 'OccupancyPhaseBar';
export const OccupancyPhaseBar = OccupancyPhaseBarInner;
