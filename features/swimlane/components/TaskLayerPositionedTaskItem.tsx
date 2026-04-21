/**
 * Одна позиционированная задача в слое свимлейна (бар + baseline + редактор сегментов).
 */

'use client';

import type { TaskLayerPositionedTaskItemProps } from './TaskLayer.types';

import React from 'react';

import { CARD_MARGIN, PARTS_PER_DAY, ZIndex } from '@/constants';
import { SwimlaneSegmentEditFrame } from '@/features/swimlane/components/SwimlaneSegmentEditFrame';
import {
  getLeftPercentForSegmentStartCell,
  getOrderedPlanSegments,
  getWidthPercent,
} from '@/features/swimlane/utils/positionUtils';
import { swimlaneTaskDraggableId } from '@/features/swimlane/utils/swimlaneDragIds';
import {
  computeBaselineStripOpacity,
  computeSwimlaneOverdueBaselineStrips,
  computeSwimlaneRowBandStyle,
  computeTaskLayerCardOpacity,
} from '@/features/swimlane/utils/taskLayerTaskLayout';
import { TaskBar } from '@/features/task/components/TaskBar/TaskBar';
import { isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import {
  cellsToSegments,
  formatOccupancyErrorTooltip,
  getSegmentEditorRangeAndCells,
} from '@/lib/planner-timeline';

export function TaskLayerPositionedTaskItem(props: TaskLayerPositionedTaskItemProps) {
  const {
    activeDraggableId = null,
    activeTask,
    activeTaskDuration,
    contextMenuBlurOtherCards = false,
    contextMenuTaskId,
    currentCell,
    developers,
    errorReasons,
    errorTaskIds,
    factHoveredTaskId = null,
    globalNameFilter,
    hasTaskOverlaps,
    hoveredCell,
    hoverConnectedTaskIds = null,
    isDraggingTask = false,
    hoveredTaskId = null,
    isDark,
    layerHeight,
    onContextMenu,
    onCreateQATask,
    onSegmentEditCancel,
    onSegmentEditSave,
    onTaskClick,
    onTaskHover,
    onTaskResize,
    position,
    qaTasksMap,
    requestArrowRedraw,
    segmentEditDraftCells,
    segmentEditTaskId = null,
    selectedSprintId,
    selectedTaskId,
    setSegmentEditDraftCells,
    task,
    taskLayerMap,
    taskPositions,
    timelineTotalParts,
    totalHeight,
  } = props;

  const segmentEditorActive =
    segmentEditTaskId === task.id && onSegmentEditSave && onSegmentEditCancel;
  const segmentEditRange = segmentEditorActive ? getSegmentEditorRangeAndCells(position) : null;
  const previewCellsForEdit =
    segmentEditorActive && segmentEditRange
      ? (segmentEditDraftCells ?? segmentEditRange.initialCells)
      : null;
  const planSegments =
    previewCellsForEdit !== null && segmentEditRange
      ? cellsToSegments(segmentEditRange.rangeStartCell, previewCellsForEdit)
      : getOrderedPlanSegments(position);
  const hasMultiplePlanSegments = planSegments.length > 1;

  const overdueBaselineStrips = computeSwimlaneOverdueBaselineStrips(
    task,
    planSegments,
    currentCell
  );

  const taskLayer = taskLayerMap.get(task.id) ?? 0;
  const baselineTop = hasTaskOverlaps ? taskLayer * layerHeight : 0;
  const baselineBottom = hasTaskOverlaps ? totalHeight - (taskLayer + 1) * layerHeight : 0;

  const swimlaneRowBandStyle = computeSwimlaneRowBandStyle(
    hasTaskOverlaps,
    taskLayer,
    totalHeight,
    layerHeight
  );

  const isDraggingThisTask = activeTask?.id === task.id;
  const hideOtherSegmentsWhileDragging =
    isDraggingThisTask &&
    activeDraggableId != null &&
    hasMultiplePlanSegments;

  const cardOpacity = computeTaskLayerCardOpacity({
    activeTask,
    factHoveredTaskId,
    hoverConnectedTaskIds,
    onSegmentEditCancel,
    onSegmentEditSave,
    segmentEditTaskId,
    taskId: task.id,
  });

  const effectivelyQa = isEffectivelyQaTask(task);

  return (
    <React.Fragment>
      {!isDraggingThisTask &&
        overdueBaselineStrips.map(({ baselineStart, baselineWidth }, stripIdx) => {
          const baselineOpacity = computeBaselineStripOpacity({
            activeTaskDuration,
            assigneeId: position.assignee,
            baselineStart,
            baselineWidth,
            hoveredCell,
            hoveredTaskId,
            isDraggingTask,
            taskId: task.id,
          });
          return (
            <div
              key={`baseline-${task.id}-${stripIdx}-${baselineStart}-${currentCell}`}
              className={`absolute pointer-events-none ${ZIndex.class('base')} rounded-r-md transition-opacity duration-200`}
              style={{
                background: isDark
                  ? 'repeating-linear-gradient(45deg, rgb(127 29 29), rgb(127 29 29) 8px, rgb(153 27 27) 8px, rgb(153 27 27) 16px)'
                  : 'repeating-linear-gradient(45deg, rgb(254 226 226), rgb(254 226 226) 8px, rgb(252 165 165) 8px, rgb(252 165 165) 16px)',
                bottom: hasTaskOverlaps ? `${baselineBottom + 6}px` : '6px',
                left: `calc(${(baselineStart / timelineTotalParts) * 100}% - ${CARD_MARGIN + 6}px)`,
                opacity: baselineOpacity,
                top: hasTaskOverlaps ? `${baselineTop + 6}px` : '6px',
                width: `calc(${(baselineWidth / timelineTotalParts) * 100}% - ${CARD_MARGIN - 16}px)`,
              }}
            />
          );
        })}
      {planSegments.map((seg, segIdx) => {
        const startCell = seg.startDay * PARTS_PER_DAY + seg.startPart;
        const draggableId = hasMultiplePlanSegments
          ? swimlaneTaskDraggableId(task.id, segIdx)
          : task.id;
        const htmlAnchorId =
          hasMultiplePlanSegments && segIdx > 0 ? `task-${task.id}-seg-${segIdx}` : `task-${task.id}`;
        const hideSegWhileDragging =
          hideOtherSegmentsWhileDragging && draggableId !== activeDraggableId;
        const segmentOpacity = hideSegWhileDragging ? cardOpacity * 0.45 : cardOpacity;

        return (
          <TaskBar
            key={hasMultiplePlanSegments ? `${task.id}-seg-${segIdx}` : task.id}
            assigneeName={position.assignee}
            contextMenuBlurOtherCards={contextMenuBlurOtherCards}
            contextMenuTaskId={contextMenuTaskId}
            developers={developers}
            disableResize={Boolean(segmentEditorActive)}
            draggableId={draggableId}
            duration={seg.duration}
            errorTooltip={formatOccupancyErrorTooltip(errorReasons?.get(task.id))}
            globalNameFilter={globalNameFilter}
            htmlAnchorId={htmlAnchorId}
            interactionDisabled={Boolean(segmentEditorActive)}
            isInError={segmentEditorActive ? false : (errorTaskIds?.has(task.id) ?? false)}
            isSelected={selectedTaskId === task.id}
            leftPercent={getLeftPercentForSegmentStartCell(startCell, timelineTotalParts)}
            qaTasksMap={qaTasksMap}
            requestArrowRedraw={requestArrowRedraw}
            selectedSprintId={selectedSprintId}
            selectedTaskId={selectedTaskId}
            style={{
              ...swimlaneRowBandStyle,
              opacity: segmentOpacity,
              pointerEvents: hideSegWhileDragging ? 'none' : undefined,
              transition: 'opacity 0.2s ease',
            }}
            swimlaneBarDurationParts={seg.duration}
            swimlaneDragActive={isDraggingTask}
            swimlaneSegmentSecondary={hasMultiplePlanSegments && segIdx > 0}
            swimlaneTimelineTotalParts={timelineTotalParts}
            task={task}
            taskPositions={taskPositions}
            widthPercent={getWidthPercent(seg.duration, timelineTotalParts)}
            onClick={onTaskClick}
            onContextMenu={onContextMenu}
            onCreateQATask={onCreateQATask}
            onResize={(params) =>
              onTaskResize(task.id, {
                ...params,
                planSegmentIndex: hasMultiplePlanSegments ? segIdx : undefined,
              })
            }
            onTaskHover={onTaskHover}
          />
        );
      })}
      {segmentEditorActive && segmentEditRange && onSegmentEditSave && onSegmentEditCancel && (
        <SwimlaneSegmentEditFrame
          cells={segmentEditDraftCells ?? segmentEditRange.initialCells}
          containerStyle={{
            ...swimlaneRowBandStyle,
            zIndex: ZIndex.arrowsHovered,
          }}
          rangeStartCell={segmentEditRange.rangeStartCell}
          timelineTotalParts={timelineTotalParts}
          totalCells={segmentEditRange.totalCells}
          onCancel={onSegmentEditCancel}
          onCellsChange={setSegmentEditDraftCells}
          onSave={(segments) => {
            onSegmentEditSave(position, segments, effectivelyQa);
          }}
        />
      )}
    </React.Fragment>
  );
}
