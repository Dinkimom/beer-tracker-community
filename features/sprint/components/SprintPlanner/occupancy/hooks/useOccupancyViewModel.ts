'use client';

import type { OccupancyScrollCtxValue } from '../OccupancyScrollCtx';
import type { OccupancyViewProps } from '../OccupancyView.types';
import type { OccupancyViewTableSectionProps } from '../OccupancyViewTableSection';
import type { Comment } from '@/types';
import type { DragEndEvent } from '@dnd-kit/core';

import { useCallback, useMemo, useState } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { useHolidayDays } from '@/features/sprint/hooks/useHolidayDays';
import { getGoalStoryEpicNames } from '@/features/sprint/utils/goalNamesFromChecklist';
import { getOverlappingTaskIds } from '@/features/sprint/utils/occupancyValidation';
import { useRootStore } from '@/lib/layers';
import { countWorkingDaysInclusiveCalendarRange } from '@/utils/dateUtils';

import { resolveOccupancyPlannerUiState } from '../occupancyPlannerUiResolve';
import { buildOccupancyTableSectionProps } from '../occupancyTableSectionPropsBuilders';
import {
  buildAssigneeIdToTaskPositions,
  buildTaskPlanHeightSignaturesMap,
  computeHoverConnectedPhaseIds,
  computeOccupancyTaskTotals,
  computeSourceRowEndCellIndex,
  computeSourceRowPhaseIds,
} from '../occupancyViewHelpers';

import { useOccupancyData } from './useOccupancyData';
import { useOccupancyDragAndDrop } from './useOccupancyDragAndDrop';
import { useOccupancyEmptyCellClick } from './useOccupancyEmptyCellClick';
import { useOccupancyLinkingState } from './useOccupancyLinkingState';
import { useOccupancyPositionPreview } from './useOccupancyPositionPreview';
import { useOccupancyScrollBridge } from './useOccupancyScrollBridge';
import { useOccupancyTimelineDimensions } from './useOccupancyTimelineDimensions';
import { useParentStatuses } from './useParentStatuses';
import { useParentTypes } from './useParentTypes';
import { useTaskChangelogs } from './useTaskChangelogs';
import { useTaskRowHeights } from './useTaskRowHeights';

export interface UseOccupancyViewModelResult {
  occupancyScrollCtxValue: OccupancyScrollCtxValue;
  tableSectionProps: OccupancyViewTableSectionProps;
}

export function useOccupancyViewModel({
  occupancyCallbacks = {},
  occupancyComments = {},
  occupancyLayout = {},
  availability,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId: contextMenuTaskIdProp = null,
  deliveryChecklistItems = [],
  discoveryChecklistItems = [],
  tasks,
  taskPositions,
  taskOrder,
  taskLinks,
  developers,
  globalNameFilter: globalNameFilterProp = '',
  linksDimOnHover = true,
  selectedAssigneeIds,
  sprintStartDate,
  factVisible,
  swimlaneLinksVisible = true,
  sprintInfos,
  timelineSettings,
  parentKeyToPlanPhase,
  releaseInSprintKeys,
  plannedInSprintMaxStack,
  plannedInSprintPositions,
  segmentEditTaskId: segmentEditTaskIdProp = null,
  sprintWorkingDaysCount: sprintWorkingDaysCountProp,
  usePlannerUiStore = false,
}: OccupancyViewProps): UseOccupancyViewModelResult {
  const { sprintPlannerUi } = useRootStore();

  const { contextMenuTaskId, globalNameFilter, openCommentEditId, segmentEditTaskId } =
    resolveOccupancyPlannerUiState(usePlannerUiStore, sprintPlannerUi, {
      contextMenuTaskId: contextMenuTaskIdProp,
      globalNameFilter: globalNameFilterProp,
      openCommentEditId: occupancyComments.openCommentEditId ?? null,
      segmentEditTaskId: segmentEditTaskIdProp,
    });
  const comments = occupancyComments.comments ?? [];
  const commentsVisible = occupancyComments.commentsVisible ?? true;

  const cellsPerDayCount = occupancyLayout.cellsPerDay ?? 3;
  const legacyCompactLayout = occupancyLayout.legacyCompactLayout ?? false;
  const plannerSidebarOpen = occupancyLayout.plannerSidebarOpen ?? false;
  const plannerSidebarWidth = occupancyLayout.plannerSidebarWidth ?? 0;
  const quarterlyPhaseStyle = occupancyLayout.quarterlyPhaseStyle ?? false;
  const rowFieldsVisibility = occupancyLayout.rowFieldsVisibility;
  const timelineScale = occupancyLayout.timelineScale ?? 'compact';
  const twoLineDayHeader = occupancyLayout.twoLineDayHeader ?? false;

  const {
    onAddLink,
    onCommentCreate,
    onCommentDelete,
    onCommentMove,
    onCommentPositionUpdate,
    onCommentUpdate,
    onContextMenu,
    onCreateTaskForParent,
    onDeleteLink,
    onOpenAssigneePicker,
    onPositionSave,
    onSegmentEditCancel: onSegmentEditCancelProp,
    onSegmentEditSave,
    onTaskClick,
    onTaskOrderChange,
  } = occupancyCallbacks;
  const onSegmentEditCancel = usePlannerUiStore
    ? () => sprintPlannerUi.setSegmentEditTaskId(null)
    : onSegmentEditCancelProp;
  const showLinks = Boolean(timelineSettings.showLinks && swimlaneLinksVisible);
  const effectiveFactVisible = factVisible;

  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [hoveredErrorTaskId, setHoveredErrorTaskId] = useState<string | null>(null);
  const [hoveredPhaseTaskId, setHoveredPhaseTaskId] = useState<string | null>(null);

  const {
    handleCancelLinking,
    handleCompleteLink,
    handleStartLinking,
    handleTableClickCapture,
    linkingFromTaskId,
  } = useOccupancyLinkingState({ onAddLink });

  const { occupancyScrollCtxValue, isResizing, setIsResizing, tableScrollRef, taskColumnWidth } =
    useOccupancyScrollBridge();

  const sprintCount = sprintInfos && sprintInfos.length > 0 ? sprintInfos.length : 1;
  const perSprintWorkingDays =
    sprintInfos && sprintInfos.length > 0
      ? sprintInfos.map((s) => {
          const start = new Date(s.startDate);
          const end = s.endDate != null ? new Date(s.endDate) : start;
          const n = countWorkingDaysInclusiveCalendarRange(start, end);
          return n > 0 ? n : WORKING_DAYS;
        })
      : null;
  const workingDays =
    perSprintWorkingDays && perSprintWorkingDays.length > 0
      ? perSprintWorkingDays.reduce((a, b) => a + b, 0)
      : (sprintWorkingDaysCountProp ?? WORKING_DAYS);
  const partsPerDay = cellsPerDayCount === 1 ? 1 : PARTS_PER_DAY;
  const totalParts = workingDays * partsPerDay;
  const displayAsWeeks = false;
  const displayColumnCount = workingDays;
  const effectiveTotalParts = totalParts;
  const effectiveSprintStartDate = sprintInfos?.[0]?.startDate ?? sprintStartDate;

  const holidayDayIndices = useHolidayDays(
    sprintCount === 1 ? sprintStartDate : effectiveSprintStartDate,
    workingDays
  );

  const {
    visibleRows,
    visibleTaskIds,
    taskIdsOrder,
    devToQaTaskId,
    tasksMap,
    occupancyErrorTaskIds,
    occupancyErrorDays,
    occupancyErrorReasons,
    occupancyErrorDetailsByDay,
    developerMap,
    availabilityDevelopersWithSegments,
  } = useOccupancyData({
    tasks,
    taskPositions,
    globalNameFilter,
    selectedAssigneeIds,
    taskOrder,
    availability,
    sprintStartDate: effectiveSprintStartDate,
    sprintWorkingDaysCount: workingDays,
    developers,
    collapsedParents,
  });

  const { totalStoryPoints, totalTestPoints } = useMemo(
    () => computeOccupancyTaskTotals(visibleRows, taskPositions),
    [visibleRows, taskPositions]
  );

  const taskPlanHeightSignatures = useMemo(
    () => buildTaskPlanHeightSignaturesMap(visibleRows, taskPositions),
    [visibleRows, taskPositions]
  );

  const occupancyLayoutKey = `${legacyCompactLayout}-${effectiveFactVisible}`;
  const { taskRowHeights, setTaskRowRef } = useTaskRowHeights(
    visibleTaskIds,
    visibleRows.length,
    occupancyLayoutKey,
    taskPlanHeightSignatures
  );

  const allTaskIdsForChangelog = useMemo(
    () => tasks.map((t) => t.id),
    [tasks]
  );
  const { data: taskChangelogsData } = useTaskChangelogs(
    effectiveFactVisible ? allTaskIdsForChangelog : []
  );
  const taskChangelogs = taskChangelogsData?.durations ?? new Map();
  const taskChangelogsRaw = taskChangelogsData?.changelogs ?? new Map();
  const taskComments = taskChangelogsData?.comments ?? new Map();

  const { positionPreviews, handlePositionPreview } = useOccupancyPositionPreview(taskPositions);

  const assigneeIdToTaskPositions = useMemo(
    () => buildAssigneeIdToTaskPositions(tasks, taskPositions),
    [tasks, taskPositions]
  );

  const { getRowId, sortableRowIds, handleOccupancyDragEnd } = useOccupancyDragAndDrop({
    visibleRows,
    onTaskOrderChange,
  });

  /* eslint-disable react-hooks/preserve-manual-memoization -- колбэки из occupancyCallbacks; Map в зависимостях */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.data.current?.type === 'comment' && over?.id) {
        const overStr = String(over.id);
        if (overStr.startsWith('comment-cell|') && onCommentMove) {
          const parts = overStr.split('|');
          if (parts.length >= 5) {
            const [, taskId, dayStr, partStr] = parts;
            const commentId = (active.data.current.comment as Comment).id;
            onCommentMove(commentId, {
              taskId,
              day: parseInt(dayStr, 10),
              part: parseInt(partStr, 10),
              x: 0,
              y: 0,
            });
            return;
          }
        }
      }
      handleOccupancyDragEnd(event);
    },
    [handleOccupancyDragEnd, onCommentMove]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const overlappingTaskIds = useMemo(() => {
    if (!hoveredErrorTaskId) return new Set<string>();
    return getOverlappingTaskIds(hoveredErrorTaskId, tasks, taskPositions);
  }, [hoveredErrorTaskId, tasks, taskPositions]);

  const hoverConnectedPhaseIds = useMemo(
    () =>
      computeHoverConnectedPhaseIds({
        devToQaTaskId,
        hoveredPhaseTaskId,
        taskLinks,
        tasks,
      }),
    [hoveredPhaseTaskId, taskLinks, devToQaTaskId, tasks]
  );

  const sourceRowPhaseIds = useMemo(
    () =>
      computeSourceRowPhaseIds({
        devToQaTaskId,
        linkingFromTaskId,
        tasks,
      }),
    [linkingFromTaskId, tasks, devToQaTaskId]
  );

  /* eslint-disable react-hooks/preserve-manual-memoization -- taskPositions — Map */
  const sourceRowEndCell = useMemo(
    () =>
      computeSourceRowEndCellIndex({
        cellsPerDay: cellsPerDayCount,
        sourceRowPhaseIds,
        taskPositions,
      }),
    [sourceRowPhaseIds, taskPositions, cellsPerDayCount]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const { handleEmptyCellClick } = useOccupancyEmptyCellClick({
    developers,
    onOpenAssigneePicker,
    onPositionSave,
  });

  const { dayColumnWidth, headerHeight, tableWidth } = useOccupancyTimelineDimensions({
    displayAsWeeks,
    displayColumnCount,
    plannerSidebarOpen,
    plannerSidebarWidth,
    quarterlyPhaseStyle,
    sprintCount,
    tableScrollRef,
    taskColumnWidth,
    timelineScale,
    workingDays,
  });

  const toggleParent = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const goalStoryEpicNames = useMemo(
    () =>
      getGoalStoryEpicNames([...deliveryChecklistItems, ...discoveryChecklistItems]),
    [deliveryChecklistItems, discoveryChecklistItems]
  );

  const parentRows = useMemo(
    () => visibleRows.filter((r): r is Extract<typeof r, { type: 'parent' }> => r.type === 'parent'),
    [visibleRows]
  );
  const parentIds = useMemo(() => parentRows.map((r) => r.id), [parentRows]);

  const parentKeys = useMemo(
    () => parentRows.map((r) => r.key).filter((k): k is string => !!k),
    [parentRows]
  );
  const { data: parentStatuses } = useParentStatuses(parentKeys);
  const { data: parentTypes } = useParentTypes(parentKeys);

  const allExpanded = parentIds.length === 0 || parentIds.every((id) => !collapsedParents.has(id));
  const expandAll = useCallback(() => setCollapsedParents(new Set()), []);
  const collapseAll = useCallback(() => setCollapsedParents(new Set(parentIds)), [parentIds]);

  const tableSectionProps = buildOccupancyTableSectionProps({
        bodyCore: {
          assigneeIdToTaskPositions,
          availabilityDevelopersWithSegments,
          cellsPerDay: cellsPerDayCount,
          collapsedParents,
          comments,
          commentsVisible,
          contextMenuBlurOtherCards,
          contextMenuTaskId,
          dayColumnWidth,
          developerMap,
          displayAsWeeks,
          displayColumnCount,
          factChangelogs: taskChangelogsRaw ?? new Map(),
          factComments: taskComments ?? new Map(),
          factDurations: taskChangelogs ?? new Map(),
          factVisible: effectiveFactVisible,
          getRowId,
          globalNameFilter,
          goalStoryEpicNames,
          handleEmptyCellClick,
          handlePositionPreview,
          headerHeight,
          holidayDayIndices,
          hoverConnectedPhaseIds: showLinks && linksDimOnHover ? hoverConnectedPhaseIds : null,
          hoveredPhaseTaskId,
          isReorderMode,
          legacyCompactLayout,
          linkingFromTaskId,
          occupancyErrorReasons,
          occupancyErrorTaskIds,
          openCommentEditId,
          overlappingTaskIds,
          parentKeyToPlanPhase,
          parentStatuses,
          parentTypes,
          plannedInSprintMaxStack,
          plannedInSprintPositions,
          positionPreviews,
          quarterlyPhaseStyle,
          releaseInSprintKeys,
          rowFieldsVisibility,
          segmentEditTaskId,
          setHoveredPhaseTaskId,
          setTaskRowRef,
          sortableRowIds,
          sourceRowEndCell,
          sourceRowPhaseIds,
          sprintStartDate: effectiveSprintStartDate,
          taskColumnWidth,
          taskLinks,
          taskPositions,
          taskRowHeights,
          timelineSettings,
          toggleParent,
          totalParts: effectiveTotalParts,
          visibleRows,
          workingDays,
          onCancelLinking: showLinks ? handleCancelLinking : undefined,
          onCommentCreate,
          onCommentDelete,
          onCommentPositionUpdate,
          onCommentUpdate,
          onCompleteLink: showLinks ? handleCompleteLink : undefined,
          onContextMenu,
          onCreateTaskForParent,
          onPositionSave,
          onSegmentEditCancel,
          onSegmentEditSave,
          onStartLinking: showLinks && !segmentEditTaskId ? handleStartLinking : undefined,
          onTaskClick,
          onTaskOrderChange,
        },
        dayColumnWidth,
        displayColumnCount,
        handleTableClickCapture,
        headerCore: {
          allExpanded,
          dayColumnWidth,
          displayAsWeeks,
          displayColumnCount,
          errorDayDetails: occupancyErrorDetailsByDay,
          errorDayIndices: occupancyErrorDays,
          holidayDayIndices,
          isReorderMode,
          isResizing,
          parentIds,
          setIsReorderMode,
          setIsResizing,
          sprintInfos,
          sprintStartDate: effectiveSprintStartDate,
          sprintWorkingDaysCount: workingDays,
          taskColumnWidth,
          tasks,
          totalStoryPoints,
          totalTestPoints,
          twoLineDayHeader,
          onCollapseAll: collapseAll,
          onExpandAll: expandAll,
          onHoveredErrorTaskIdChange: setHoveredErrorTaskId,
          onTaskOrderChange,
        },
        quarterlyPhaseStyle,
        showLinks,
        tableScrollRef,
        tableWidth,
        taskArrows: {
          devToQaTaskId,
          hoveredPhaseTaskId,
          linkingFromTaskId,
          segmentEditTaskId,
          taskIdsOrder,
          taskLinks,
          taskPositions,
          tasksMap,
          onDeleteLink,
        },
        taskColumnWidth,
        onDragEnd: handleDragEnd,
      });

  return {
    occupancyScrollCtxValue,
    tableSectionProps,
  };
}
