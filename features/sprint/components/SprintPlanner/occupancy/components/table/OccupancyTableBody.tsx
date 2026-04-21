'use client';

import type { FlattenedRow } from '../../utils/buildFlattenedRows';
import type { PositionPreview } from '../task-row/plan/OccupancyPhaseBar';
import type { TimelineSettings } from './OccupancyTableHeader';
import type { AvailabilitySegment } from '@/features/swimlane/utils/availabilitySegments';
import type { StatusDuration } from '@/features/task/components/TaskTimeline/types';
import type { OccupancyRowFieldsVisibility } from '@/hooks/useLocalStorage';
import type { OccupancyTaskOrder } from '@/lib/api/types';
import type { Comment, Developer, Task, TaskPosition } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import React from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SingleTooltipGroupProvider } from '@/components/SingleTooltipGroupContext';
import { useI18n } from '@/contexts/LanguageContext';
import { PARTS_PER_DAY } from '@/constants';
import { getPartStatus } from '@/utils/dateUtils';

import { OccupancyAvailabilitySection } from '../availability/OccupancyAvailabilitySection';
import { OccupancyParentRow } from '../other/OccupancyParentRow';
import { OccupancySortableRow } from '../other/OccupancySortableRow';
import { OccupancyEmptyState } from '../shared/OccupancyEmptyState';
import { OccupancyTaskRow } from '../task-row/OccupancyTaskRow';

import {
  computePlanRowHeightPx,
  computeRowMinHeight,
  computeUnplannedWarning,
} from './occupancyTableBodyRowMetrics';

const OCCUPANCY_DAY_ROW_HEIGHT = 40;
const OCCUPANCY_TASK_ROW_MIN_HEIGHT = 56;
/** Минимальная высота строки в компактном режиме (ниже, чем полный) */
const OCCUPANCY_TASK_ROW_LEGACY_TM_MIN_HEIGHT = 40;
const ROW_BORDER_PX = 1;
/** Сетка дней/частей без интерактива — для строки «Добавить задачу»; подсвечиваем текущий таймслот. */
function AddTaskRowDayCells({
  dayColumnWidth,
  holidayDayIndices,
  rowHeight,
  sprintStartDate,
  workingDays,
  cellsPerDay = 3,
}: {
  dayColumnWidth: number | undefined;
  holidayDayIndices?: Set<number>;
  rowHeight: number;
  sprintStartDate: Date;
  workingDays: number;
  cellsPerDay?: 1 | 3;
}) {
  const partsPerDay = cellsPerDay === 1 ? 1 : PARTS_PER_DAY;
  return (
    <div
      className="relative flex w-full items-stretch"
      style={{
        height: rowHeight,
        minHeight: rowHeight,
        boxSizing: 'border-box',
      }}
    >
      {Array.from({ length: workingDays }, (_, dayIndex) => (
        <div
          key={dayIndex}
          className={`flex flex-1 min-w-0 items-stretch border-r border-gray-200 dark:border-gray-600 last:border-r-0 box-border ${
            holidayDayIndices?.has(dayIndex)
              ? 'bg-gray-50 dark:bg-gray-900/40'
              : ''
          }`}
          style={{ width: dayColumnWidth ?? '10%', minWidth: 0 }}
        >
          {Array.from({ length: partsPerDay }, (_, partIndex) => {
            const partStatus = getPartStatus(dayIndex, partIndex, sprintStartDate, workingDays);
            const isCurrent = partStatus === 'current';
            return (
              <div
                key={partIndex}
                className={`flex-1 min-w-0 border-r border-gray-200/50 dark:border-gray-700/50 last:border-r-0 box-border ${
                  isCurrent ? 'bg-blue-100/70 dark:bg-blue-900/30' : ''
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AddTaskRow({
  dayColumnWidth,
  displayAsWeeks = false,
  effectiveColumns,
  holidayDayIndices,
  legacyCompactLayout = false,
  parent,
  sprintStartDate,
  taskColumnWidth,
  workingDays: _workingDays,
  cellsPerDay = 3,
  onCreateTaskForParent,
}: {
  parent: { id: string; display: string; key?: string };
  sprintStartDate: Date;
  taskColumnWidth: number;
  workingDays: number;
  effectiveColumns: number;
  displayAsWeeks?: boolean;
  dayColumnWidth: number | undefined;
  holidayDayIndices?: Set<number>;
  legacyCompactLayout?: boolean;
  cellsPerDay?: 1 | 3;
  onCreateTaskForParent: (row: { id: string; display: string; key?: string }) => void;
}) {
  const { t } = useI18n();
  const baseMin = legacyCompactLayout ? OCCUPANCY_TASK_ROW_LEGACY_TM_MIN_HEIGHT : OCCUPANCY_TASK_ROW_MIN_HEIGHT;
  const rowHeight = baseMin - ROW_BORDER_PX;
  return (
    <tr className="border-t border-b border-gray-100 dark:border-gray-700">
      <td
        className="sticky left-0 z-[6] p-0 align-top relative bg-gray-50 dark:bg-gray-900"
        style={{
          width: taskColumnWidth,
          minWidth: taskColumnWidth,
          height: rowHeight,
          verticalAlign: 'top',
        }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 pointer-events-none" style={{ zIndex: 10 }} />
        <Button
          className="h-full w-full !min-h-0 items-center gap-2 !rounded-none !border border-dashed border-gray-300 !bg-transparent !px-3 text-sm text-gray-600 shadow-none hover:!border-gray-400 hover:!bg-gray-100 hover:!text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:!border-gray-500 dark:hover:!bg-gray-800 dark:hover:!text-gray-200"
          style={{ minHeight: rowHeight, boxSizing: 'border-box' }}
          type="button"
          variant="ghost"
          onClick={() => onCreateTaskForParent(parent)}
        >
          <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" name="plus" />
          <span className="truncate">{t('sprintPlanner.occupancy.addTaskButton')}</span>
        </Button>
      </td>
      <td
        className="relative border-r border-gray-200 dark:border-gray-600 p-0 align-top bg-gray-50/50 dark:bg-gray-800/50"
        colSpan={effectiveColumns}
        style={{
          height: rowHeight,
          minHeight: rowHeight,
          verticalAlign: 'top',
          boxSizing: 'border-box',
        }}
      >
        <div className="relative h-full w-full">
          <AddTaskRowDayCells
            cellsPerDay={displayAsWeeks ? 1 : cellsPerDay}
            dayColumnWidth={dayColumnWidth}
            holidayDayIndices={holidayDayIndices}
            rowHeight={rowHeight}
            sprintStartDate={sprintStartDate}
            workingDays={effectiveColumns}
          />
        </div>
      </td>
    </tr>
  );
}

interface OccupancyTableBodyProps {
  assigneeIdToTaskPositions: Map<string, Array<{ taskId: string; position: TaskPosition }>>;
  availabilityDevelopersWithSegments: Array<{
    developer: Developer;
    segments: AvailabilitySegment[];
  }>;
  /** 1 = одна ячейка на день, 3 = три части дня (по умолчанию) */
  cellsPerDay?: 1 | 3;
  collapsedParents: Set<string>;
  comments: Comment[];
  commentsVisible: boolean;
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  dayColumnWidth: number | undefined;
  developerMap: Map<string, Developer>;
  /** В компактном режиме — колонки по неделям (2 на спринт) */
  displayAsWeeks?: boolean;
  displayColumnCount?: number;
  factChangelogs: Map<string, ChangelogEntry[]>;
  factComments: Map<string, IssueComment[]>;
  factDurations: Map<string, StatusDuration[]>;
  factVisible: boolean;
  globalNameFilter: string;
  goalStoryEpicNames: Set<string>;
  /** Высота шапки для позиционирования sticky parent-строк */
  headerHeight?: number;
  /** Индексы дней (0..9), которые являются нерабочими/праздничными */
  holidayDayIndices?: Set<number>;
  hoverConnectedPhaseIds: Set<string> | null;
  hoveredErrorTaskId?: string | null;
  hoveredPhaseTaskId: string | null;
  isReorderMode: boolean;
  legacyCompactLayout?: boolean;
  linkingFromTaskId: string | null;
  occupancyErrorReasons: Map<string, string[]>;
  occupancyErrorTaskIds: Set<string>;
  openCommentEditId?: string | null;
  overlappingTaskIds?: Set<string>;
  /** Сроки по эпикам/стори для полосы плана в строке родителя */
  parentKeyToPlanPhase?: Map<string, TaskPosition>;
  parentStatuses?: Map<string, string>;
  parentTypes?: Map<string, string>;
  plannedInSprintMaxStack?: Map<string, number>;
  /** Позиция «запланировано в спринт» для строки (по storyKey/task.id) */
  plannedInSprintPositions?: Map<string, TaskPosition[]>;
  positionPreviews: Map<string, PositionPreview>;
  /** Режим фаз квартального плана: без доп. оценки, без ошибок, синие фазы и эмодзи инструментов */
  quarterlyPhaseStyle?: boolean;
  /** Ключи, у которых по плану фаза заканчивается в текущем спринте (показывать сегмент «релиз») */
  releaseInSprintKeys?: Set<string>;
  /** Набор полей, отображаемых в строке занятости */
  rowFieldsVisibility?: OccupancyRowFieldsVisibility;
  segmentEditTaskId?: string | null;
  sortableRowIds: string[];
  sourceRowEndCell: number | null;
  sourceRowPhaseIds: Set<string> | null;
  sprintStartDate: Date;
  taskColumnWidth: number;
  taskLinks: Array<{ fromTaskId: string; toTaskId: string; id: string }>;
  taskPositions: Map<string, TaskPosition>;
  taskRowHeights: Map<string, number>;
  timelineSettings: TimelineSettings;
  totalParts: number;
  visibleRows: FlattenedRow[];
  /** Количество рабочих дней в таймлайне (10 для одного спринта, N*10 для мультиспринта) */
  workingDays?: number;
  getRowId: (row: FlattenedRow) => string;
  handleEmptyCellClick: (
    targetTask: Task,
    dayIndex: number,
    partIndex: number,
    cellElement: HTMLElement,
    getAnchorRect?: (cell: HTMLElement) => DOMRect
  ) => void;
  handlePositionPreview: (taskId: string, preview: PositionPreview | null) => void;
  onCancelLinking?: () => void;
  onCommentCreate?: (comment: Comment) => void;
  onCommentDelete?: (id: string) => void;
  onCommentPositionUpdate?: (id: string, x: number, y: number, assigneeId?: string) => void;
  onCommentUpdate?: (id: string, text: string) => void;
  onCompleteLink?: (toTaskId: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task, isBacklogTask?: boolean, hideRemoveFromPlan?: boolean) => void;
  /** Создание задачи для родительской строки (стори) */
  onCreateTaskForParent?: (row: { id: string; display: string; key?: string }) => void;
  onPositionSave?: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void> | void;
  onSegmentEditCancel?: () => void;
  onSegmentEditSave?: (position: TaskPosition, segments: Array<{ startDay: number; startPart: number; duration: number }>, isQa: boolean) => void;
  onStartLinking?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskOrderChange?: (order: OccupancyTaskOrder) => void;
  setHoveredPhaseTaskId: (taskId: string | null) => void;
  setTaskRowRef: (taskId: string) => (el: HTMLDivElement | null) => void;
  toggleParent: (parentId: string) => void;
}

/** Тело таблицы: строки родителей и задач с DnD. */

export function OccupancyTableBody({
  assigneeIdToTaskPositions,
  cellsPerDay = 3,
  visibleRows,
  collapsedParents,
  comments,
  commentsVisible,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  goalStoryEpicNames,
  globalNameFilter,
  taskPositions,
  developerMap,
  taskRowHeights,
  setTaskRowRef,
  taskColumnWidth,
  dayColumnWidth,
  totalParts,
  positionPreviews,
  occupancyErrorTaskIds,
  occupancyErrorReasons,
  overlappingTaskIds,
  hoveredErrorTaskId: _hoveredErrorTaskId,
  parentKeyToPlanPhase,
  parentStatuses,
  parentTypes,
  releaseInSprintKeys,
  factChangelogs,
  factComments,
  factDurations,
  factVisible,
  timelineSettings,
  sortableRowIds,
  isReorderMode,
  legacyCompactLayout = false,
  rowFieldsVisibility,
  onTaskOrderChange,
  sprintStartDate,
  holidayDayIndices,
  onTaskClick,
  onContextMenu,
  onPositionSave,
  onSegmentEditCancel,
  onSegmentEditSave,
  segmentEditTaskId = null,
  handlePositionPreview,
  onCreateTaskForParent,
  handleEmptyCellClick,
  setHoveredPhaseTaskId,
  hoverConnectedPhaseIds,
  hoveredPhaseTaskId,
  linkingFromTaskId,
  sourceRowPhaseIds,
  sourceRowEndCell,
  taskLinks,
  onCancelLinking,
  onStartLinking,
  onCompleteLink,
  openCommentEditId,
  plannedInSprintPositions,
  plannedInSprintMaxStack,
  displayAsWeeks = false,
  displayColumnCount,
  quarterlyPhaseStyle = false,
  onCommentCreate,
  onCommentDelete,
  onCommentPositionUpdate,
  onCommentUpdate,
  getRowId,
  toggleParent,
  availabilityDevelopersWithSegments,
  workingDays = 10,
  headerHeight = OCCUPANCY_DAY_ROW_HEIGHT,
}: OccupancyTableBodyProps) {
  const effectiveColumns =
    displayAsWeeks && displayColumnCount != null ? displayColumnCount : workingDays;

  if (visibleRows.length === 0) {
    const emptyColSpan =
      1 + (displayAsWeeks && displayColumnCount != null ? displayColumnCount : workingDays);
    return (
      <tbody>
        <OccupancyEmptyState globalNameFilter={globalNameFilter} tableColSpan={emptyColSpan} />
      </tbody>
    );
  }

  return (
    <tbody>
      <SingleTooltipGroupProvider>
        <SortableContext items={sortableRowIds} strategy={verticalListSortingStrategy}>
          {/* eslint-disable-next-line sonarjs/cognitive-complexity -- parent vs task branches; metrics in occupancyTableBodyRowMetrics */}
          {visibleRows.map((row, rowIndex) => {
            const rowId = getRowId(row);
            const isSortable = !!onTaskOrderChange && isReorderMode;

            if (row.type === 'parent') {
              const isCollapsed = collapsedParents.has(row.id);
              return (
                <OccupancySortableRow
                  key={rowId}
                  className="sticky z-30 bg-violet-50 dark:bg-slate-700"
                  id={rowId}
                  isSortable={isSortable}
                  style={{
                    top: headerHeight,
                    height: 40,
                    minHeight: 40,
                    maxHeight: 40,
                    boxSizing: 'border-box',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden' as const,
                  }}
                >
                  {(dragHandle) => (
                    <OccupancyParentRow
                      cellsPerDay={cellsPerDay}
                      colSpan={effectiveColumns}
                      displayAsWeeks={displayAsWeeks}
                      dragHandle={dragHandle}
                      goalStoryEpicNames={goalStoryEpicNames}
                      isCollapsed={isCollapsed}
                      issueType={row.key ? parentTypes?.get(row.key) : undefined}
                      planPosition={row.key ? parentKeyToPlanPhase?.get(row.key) : undefined}
                      quarterlyPhaseStyle={quarterlyPhaseStyle}
                      releaseInSprint={row.key ? releaseInSprintKeys?.has(row.key) : false}
                      row={row}
                      sprintStartDate={sprintStartDate}
                      status={row.key ? parentStatuses?.get(row.key) : undefined}
                      taskColumnWidth={taskColumnWidth}
                      totalParts={totalParts}
                      onCreateTaskForParent={onCreateTaskForParent}
                      onToggle={toggleParent}
                    />
                  )}
                </OccupancySortableRow>
              );
            }

            const { task, qaTask } = row;
            const position = taskPositions.get(task.id);
            const qaPosition = qaTask ? taskPositions.get(qaTask.id) : undefined;
            const plannedInSprintPositionsForTask = plannedInSprintPositions?.get(task.id);
            const assignee = task.assignee ? developerMap.get(task.assignee) : undefined;
            const qaAssignee = qaTask?.assignee ? developerMap.get(qaTask.assignee) : undefined;
            // В полосе фазы и в колонке задачи при наличии позиции показываем исполнителя из позиции.
            const positionAssignee = position?.assignee ? developerMap.get(position.assignee) : undefined;
            const qaPositionAssignee = qaPosition?.assignee ? developerMap.get(qaPosition.assignee) : undefined;
            const nameFromPosition = position && positionAssignee ? positionAssignee.name : undefined;
            const qaNameFromPosition = qaPosition && qaPositionAssignee ? qaPositionAssignee.name : undefined;
            const assigneeDisplayName = nameFromPosition ?? task.assigneeName ?? assignee?.name;
            const qaDisplayName = qaTask ? (qaNameFromPosition ?? qaTask.assigneeName ?? qaAssignee?.name) : undefined;
            const initials = positionAssignee
              ? positionAssignee.name.split(' ').map((n) => n[0]).join('').toUpperCase()
              : '—';
            const qaInitials = qaPositionAssignee
              ? qaPositionAssignee.name.split(' ').map((n) => n[0]).join('').toUpperCase()
              : '—';
            const displayKey = (task.originalTaskId ? task.originalTaskId : task.id).toString();
            const hasQa = !!qaTask && task.id !== qaTask.id;
            const hasStoryPoints = task.storyPoints != null && task.storyPoints > 0;
            const hasTestPoints =
              (task.testPoints != null && task.testPoints > 0) ||
              (hasQa && !!qaTask && qaTask.testPoints != null && qaTask.testPoints > 0);
            const unplannedWarning = computeUnplannedWarning({
              hasQa,
              hasStoryPoints,
              hasTestPoints,
              position,
              qaPosition,
              task,
            });
            const isPlanned = unplannedWarning === null;
            const rowMinHeight = computeRowMinHeight(legacyCompactLayout, factVisible);
            const planRowHeight = computePlanRowHeightPx({
              factVisible,
              legacyCompactLayout,
              plannedInSprintMaxStack,
              plannedInSprintPositionsForTask,
              position,
              quarterlyPhaseStyle,
              rowMinHeight,
              taskId: task.id,
              taskRowHeights,
              unplannedWarning,
            });

            const factDurationsForTask = factDurations.get(task.id) ?? [];
            const factChangelogForTask = factChangelogs.get(task.id) ?? [];
            const factCommentsForTask = factComments.get(task.id) ?? [];
            // assigneeId теперь хранит создателя заметки, а не исполнителя строки.
            // Заметки привязаны к задаче через taskId; для старых заметок (без taskId) — фоллбэк по assigneeId.
            const rowAssigneeIds = [task.assignee, task.qaEngineer].filter(Boolean) as string[];
            const commentsForRow = comments.filter(
              (c) =>
                c.taskId === task.id ||
                (c.taskId == null && rowAssigneeIds.includes(c.assigneeId))
            );
            const hasFact = factVisible;
            const totalRowHeight = planRowHeight;
            const nextRow = visibleRows[rowIndex + 1];
            const isLastBeforeParent = nextRow?.type === 'parent';
            const isLastRow = rowIndex === visibleRows.length - 1;
            const showBottomBorder = !isLastBeforeParent || isLastRow;

            const parentSource = task.parent ?? task.epic;
            const parentForTask = parentSource
              ? {
                  id: parentSource.id,
                  display: parentSource.display,
                  key: parentSource.key,
                }
              : undefined;
            const currentParentId = parentForTask?.id ?? '__root__';
            let nextParentId: string | undefined;
            if (nextRow && nextRow.type === 'task') {
              const nextParent = nextRow.task.parent ?? nextRow.task.epic;
              nextParentId = nextParent ? nextParent.id : '__root__';
            } else {
              nextParentId = undefined;
            }
            const isLastInParentGroup =
              !!parentForTask &&
              (nextRow == null ||
                nextRow.type === 'parent' ||
                nextParentId !== currentParentId);

            return (
              <React.Fragment key={rowId}>
                <OccupancySortableRow
                  className={`relative border-gray-200 dark:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors overflow-hidden ${showBottomBorder ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
                  id={rowId}
                  isSortable={isSortable}
                  style={{
                    height: totalRowHeight,
                    minHeight: rowMinHeight - ROW_BORDER_PX,
                  }}
                >
                  {(dragHandle) => (
                    <OccupancyTaskRow
                      assignee={assignee}
                      assigneeDisplayName={assigneeDisplayName}
                      assigneeIdToTaskPositions={assigneeIdToTaskPositions}
                      cellsPerDay={cellsPerDay}
                      comments={commentsForRow}
                      commentsVisible={commentsVisible}
                      contextMenuBlurOtherCards={contextMenuBlurOtherCards}
                      contextMenuTaskId={contextMenuTaskId}
                      dayColumnWidth={dayColumnWidth}
                      developerMap={developerMap}
                      displayAsWeeks={displayAsWeeks}
                      displayColumnCount={displayColumnCount ?? workingDays}
                      displayKey={displayKey}
                      dragHandle={dragHandle}
                      factChangelog={factChangelogForTask}
                      factChangelogs={factChangelogs}
                      factComments={factCommentsForTask}
                      factDurations={factDurationsForTask}
                      goalStoryEpicNames={goalStoryEpicNames}
                      handleEmptyCellClick={handleEmptyCellClick}
                      handlePositionPreview={handlePositionPreview}
                      hasFact={hasFact}
                      hasQa={hasQa}
                      holidayDayIndices={holidayDayIndices}
                      hoverConnectedPhaseIds={hoverConnectedPhaseIds}
                      hoveredPhaseTaskId={hoveredPhaseTaskId}
                      initials={initials}
                      isPlanned={isPlanned}
                      isSortable={isSortable}
                      legacyCompactLayout={legacyCompactLayout}
                      linkingFromTaskId={linkingFromTaskId}
                      occupancyErrorReasons={occupancyErrorReasons}
                      occupancyErrorTaskIds={occupancyErrorTaskIds}
                      openCommentEditId={openCommentEditId}
                      overlappingTaskIds={overlappingTaskIds}
                      planRowHeight={planRowHeight}
                      plannedInSprintPositions={plannedInSprintPositionsForTask}
                      position={position}
                      positionAssignee={positionAssignee}
                      positionPreviews={positionPreviews}
                      qaAssignee={qaAssignee}
                      qaDisplayName={qaDisplayName}
                      qaInitials={qaInitials}
                      qaPosition={qaPosition}
                      qaPositionAssignee={qaPositionAssignee}
                      qaTask={qaTask}
                      quarterlyPhaseStyle={quarterlyPhaseStyle}
                      rowAssigneeIdForComment={task.assignee ?? task.qaEngineer ?? ''}
                      rowFieldsVisibility={rowFieldsVisibility}
                      rowId={rowId}
                      rowMinHeight={rowMinHeight}
                      segmentEditTaskId={segmentEditTaskId}
                      setHoveredPhaseTaskId={setHoveredPhaseTaskId}
                      setTaskRowRef={setTaskRowRef}
                      sourceRowEndCell={sourceRowEndCell}
                      sourceRowPhaseIds={sourceRowPhaseIds}
                      sprintStartDate={sprintStartDate}
                      task={task}
                      taskColumnWidth={taskColumnWidth}
                      taskLinks={taskLinks}
                      taskRowHeights={taskRowHeights}
                      timelineSettings={timelineSettings}
                      totalParts={totalParts}
                      totalRowHeight={totalRowHeight}
                      unplannedWarning={unplannedWarning}
                      workingDays={workingDays}
                      onCancelLinking={onCancelLinking}
                      onCommentCreate={onCommentCreate}
                      onCommentDelete={onCommentDelete}
                      onCommentPositionUpdate={onCommentPositionUpdate}
                      onCommentUpdate={onCommentUpdate}
                      onCompleteLink={onCompleteLink}
                      onContextMenu={onContextMenu}
                      onPositionSave={onPositionSave}
                      onSegmentEditCancel={onSegmentEditCancel}
                      onSegmentEditSave={onSegmentEditSave}
                      onStartLinking={onStartLinking}
                      onTaskClick={onTaskClick}
                    />
                  )}
                </OccupancySortableRow>
                {onCreateTaskForParent &&
                  parentForTask &&
                  parentForTask.key &&
                  isLastInParentGroup && (
                    <AddTaskRow
                      cellsPerDay={cellsPerDay}
                      dayColumnWidth={dayColumnWidth}
                      displayAsWeeks={displayAsWeeks}
                      effectiveColumns={effectiveColumns}
                      holidayDayIndices={holidayDayIndices}
                      legacyCompactLayout={legacyCompactLayout}
                      parent={parentForTask}
                      sprintStartDate={sprintStartDate}
                      taskColumnWidth={taskColumnWidth}
                      workingDays={workingDays}
                      onCreateTaskForParent={onCreateTaskForParent}
                    />
                  )}
              </React.Fragment>
            );
          })}
        </SortableContext>
        <OccupancyAvailabilitySection
          availabilityDevelopersWithSegments={availabilityDevelopersWithSegments}
          dayColumnWidth={dayColumnWidth}
          legacyCompactLayout={legacyCompactLayout}
          taskColumnWidth={taskColumnWidth}
          workingDays={workingDays}
        />
      </SingleTooltipGroupProvider>
    </tbody>
  );
}
