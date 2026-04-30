'use client';

import type { SwimlaneProps } from '@/features/swimlane/components/SwimlaneProps';
import type { Developer } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { useDroppable } from '@dnd-kit/core';
import React, { useContext, useMemo } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { CommentCard } from '@/features/comments/components/CommentCard';
import { sprintPlannerSwimlaneTimelineWidthCss } from '@/features/sprint/components/SprintPlanner/layout/sprintPlannerSwimlaneLayoutWidths';
import { AvailabilityCardsLayer } from '@/features/swimlane/components/AvailabilityCardsLayer';
import { DeveloperHeader } from '@/features/swimlane/components/DeveloperHeader';
import { DeveloperVacationsMenu } from '@/features/swimlane/components/DeveloperVacationsMenu';
import { SwimlaneInProgressFactLayer } from '@/features/swimlane/components/in-progress-fact';
import { memoizedSwimlanePropsEqual } from '@/features/swimlane/components/memoizedSwimlanePropsEqual';
import { TaskLayer } from '@/features/swimlane/components/TaskLayer';
import { TimelineGrid } from '@/features/swimlane/components/TimelineGrid';
import { VacationsModal } from '@/features/swimlane/components/VacationsModal';
import { useSwimlaneDocumentDarkClass } from '@/features/swimlane/hooks/in-progress-fact/useSwimlaneDocumentDarkClass';
import { useSwimlaneLayout } from '@/features/swimlane/hooks/useSwimlaneLayout';
import { getSwimlaneInProgressFactLayerHeightPx } from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';

import { SwimlaneArrowRedrawContext } from '../SwimlaneArrowRedrawContext';

const EMPTY_SWIMLANE_FACT_CHANGELOGS = new Map<string, ChangelogEntry[]>();
const EMPTY_SWIMLANE_FACT_COMMENTS = new Map<string, IssueComment[]>();
const EMPTY_SWIMLANE_FACT_DEVELOPERS = new Map<string, Developer>();

export type { SwimlaneProps } from '@/features/swimlane/components/SwimlaneProps';

interface VacationsModalState {
  boardId: number;
  memberId: string;
  memberName: string;
}

export function Swimlane({
  developer,
  tasks: _tasks, // только для сравнения в React.memo, в рендере не используется
  taskPositions,
  tasksMap,
  activeDraggableId = null,
  activeTaskDuration,
  activeTask,
  boardId = null,
  globalNameFilter,
  hoveredCell,
  hoverConnectedTaskIds = null,
  hoveredTaskId = null,
  isDraggingTask = false,
  selectedTaskId = null,
  onTaskResize,
  onTaskClick,
  onCreateQATask,
  participantsColumnWidth,
  qaTasksMap,
  viewMode = 'full',
  sidebarWidth = 0,
  sidebarOpen = false,
  sprintStartDate,
  sprintTimelineWorkingDays = WORKING_DAYS,
  comments,
  developers,
  onCommentCreate,
  onCommentUpdate,
  onCommentDelete,
  onCommentPositionUpdate,
  onCloseSidebar,
  onTaskHover,
  onContextMenu,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  selectedSprintId,
  disableCloseSidebarOnClick = false,
  errorReasons,
  errorTaskIds,
  factHoveredTaskId,
  developerAvailability,
  holidayDayIndices,
  swimlaneFactChangelogsByTaskId,
  swimlaneFactCommentsByTaskId,
  swimlaneFactDeveloperMap,
  swimlaneFactTimelineEnabled = false,
  segmentEditTaskId = null,
  swimlaneInProgressDurations = [],
  onFactSegmentHover,
  onSegmentEditCancel,
  onSegmentEditSave,
}: SwimlaneProps) {
  const requestArrowRedraw = useContext(SwimlaneArrowRedrawContext) ?? (() => {});
  const [vacationsModal, setVacationsModal] = React.useState<VacationsModalState | null>(null);

  const { setNodeRef } = useDroppable({
    id: `swimlane-${developer.id}`,
  });

  const isDark = useSwimlaneDocumentDarkClass();

  // Используем хук для расчета layout: статистика по тому, что лежит в свимлейне (по позициям на доске)
  const layout = useSwimlaneLayout({
    developerId: developer.id,
    sprintStartDate,
    sprintTimelineWorkingDays,
    taskPositions,
    tasksMap,
  });

  const timelineTotalParts = sprintTimelineWorkingDays * PARTS_PER_DAY;

  const sidebarEffectiveWidthPx = sidebarOpen ? sidebarWidth : 0;
  const timelineWidth = sprintPlannerSwimlaneTimelineWidthCss(
    viewMode,
    participantsColumnWidth,
    sidebarEffectiveWidthPx,
    sprintTimelineWorkingDays
  );

  const factExtra =
    swimlaneFactTimelineEnabled && swimlaneInProgressDurations.length > 0
      ? getSwimlaneInProgressFactLayerHeightPx(swimlaneInProgressDurations)
      : 0;
  const availabilityVisible = Boolean(
    developerAvailability &&
      (developerAvailability.vacations.length > 0 || developerAvailability.techSprints.length > 0)
  );
  const availabilityLaneHeightPx = availabilityVisible ? 48 : 0;
  const mainAreaHeight = layout.totalHeight + factExtra;
  const timelineOuterHeight = mainAreaHeight + availabilityLaneHeightPx;

  const swimlaneRowTaskIds = useMemo(
    () => new Set(layout.positionedTasks.map(({ task }) => task.id)),
    [layout.positionedTasks]
  );

  return (
    <div
      className={`relative border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
        onCloseSidebar && !disableCloseSidebarOnClick ? 'cursor-pointer' : ''
      }`}
      onClick={(e) => {
        if (!onCloseSidebar || disableCloseSidebarOnClick) return;

        const target = e.target as HTMLElement;
        if (
          !target.closest('[data-task-id]') &&
          !target.closest('[data-comment-id]') &&
          !target.closest('button') &&
          !target.closest('a') &&
          !target.closest('[role="button"]') &&
          !target.closest('.pointer-events-none')
        ) {
          onCloseSidebar();
        }
      }}
    >
      <div
        className="flex min-w-max"
        style={{
          minHeight: `${timelineOuterHeight}px`,
        }}
      >
        {/* Developer Name + Avatar - Fixed */}
        <DeveloperHeader
          actions={
            <DeveloperVacationsMenu
              boardId={boardId}
              memberId={developer.id}
              memberName={developer.name}
              onEditVacations={(args) => setVacationsModal(args)}
            />
          }
          avatarUrl={developer.avatarUrl}
          completedSP={layout.completedSP}
          completedTP={layout.completedTP}
          developerName={developer.name}
          percentSP={layout.percentSP}
          percentTP={layout.percentTP}
          role={developer.role}
          showProgress
          totalSP={layout.totalSP}
          totalTP={layout.totalTP}
          width={participantsColumnWidth}
        />

        {/* Timeline Grid */}
        <div
          ref={setNodeRef}
          className="flex relative bg-white dark:bg-gray-800"
          data-swimlane={developer.id}
          style={{
            width: timelineWidth,
            minWidth: viewMode === 'full' ? timelineWidth : undefined,
            minHeight: `${timelineOuterHeight}px`,
          }}
        >
          {/* Сетка таймлайна на всю высоту, включая lane отпусков */}
          <TimelineGrid
            activeTask={activeTask}
            activeTaskDuration={activeTaskDuration}
            developerId={developer.id}
            holidayDayIndices={holidayDayIndices}
            hoveredCell={hoveredCell}
            isDraggingTask={isDraggingTask}
            sprintStartDate={sprintStartDate}
            sprintTimelineWorkingDays={sprintTimelineWorkingDays}
            totalHeight={timelineOuterHeight}
            onCommentCreate={onCommentCreate ? (comment) => {
              const newId = crypto.randomUUID();
              onCommentCreate({
                ...comment,
                id: newId,
                clientInstanceId: newId,
              });
            } : undefined}
          />

          {/* Зона карточек задач/комментов/факта (над отпусками) */}
          <div
            className="absolute left-0 right-0 top-0 pointer-events-none"
            style={{ height: mainAreaHeight }}
          >
            {/* Comments */}
            {comments
              .filter((comment) => comment.assigneeId === developer.id)
              .map((comment) => (
                <CommentCard
                  key={comment.clientInstanceId ?? comment.id}
                  comment={comment}
                  onDelete={onCommentDelete || (() => {})}
                  onPositionUpdate={onCommentPositionUpdate || (() => {})}
                  onUpdate={onCommentUpdate || (() => {})}
                />
              ))}

            {/* Task Bars */}
            <TaskLayer
              activeDraggableId={activeDraggableId}
              activeTask={activeTask}
              activeTaskDuration={activeTaskDuration}
              contextMenuBlurOtherCards={contextMenuBlurOtherCards}
              contextMenuTaskId={contextMenuTaskId}
              currentCell={layout.currentCell}
              developers={developers}
              errorReasons={errorReasons}
              errorTaskIds={errorTaskIds}
              factHoveredTaskId={factHoveredTaskId}
              globalNameFilter={globalNameFilter}
              hasTaskOverlaps={layout.hasTaskOverlaps}
              hoverConnectedTaskIds={hoverConnectedTaskIds}
              hoveredCell={hoveredCell}
              hoveredTaskId={hoveredTaskId}
              isDark={isDark}
              isDraggingTask={isDraggingTask}
              layerHeight={layout.layerHeight}
              positionedTasks={layout.positionedTasks}
              qaTasksMap={qaTasksMap}
              requestArrowRedraw={requestArrowRedraw}
              segmentEditTaskId={segmentEditTaskId}
              selectedSprintId={selectedSprintId}
              selectedTaskId={selectedTaskId}
              taskLayerMap={layout.taskLayerMap}
              taskPositions={taskPositions}
              timelineTotalParts={timelineTotalParts}
              totalHeight={layout.totalHeight}
              onContextMenu={onContextMenu}
              onCreateQATask={onCreateQATask}
              onSegmentEditCancel={onSegmentEditCancel}
              onSegmentEditSave={onSegmentEditSave}
              onTaskClick={onTaskClick}
              onTaskHover={onTaskHover}
              onTaskResize={onTaskResize}
            />

            {swimlaneFactTimelineEnabled && (
              <SwimlaneInProgressFactLayer
                assigneeRole={developer.role}
                changelogsByTaskId={
                  swimlaneFactChangelogsByTaskId ?? EMPTY_SWIMLANE_FACT_CHANGELOGS
                }
                commentsByTaskId={swimlaneFactCommentsByTaskId ?? EMPTY_SWIMLANE_FACT_COMMENTS}
                developerMap={swimlaneFactDeveloperMap ?? EMPTY_SWIMLANE_FACT_DEVELOPERS}
                layerId={`swimlane-fact-${developer.id}`}
                requestArrowRedraw={requestArrowRedraw}
                segments={swimlaneInProgressDurations}
                sprintStartDate={sprintStartDate}
                swimlaneRowTaskIds={swimlaneRowTaskIds}
                tasksMap={tasksMap}
                factHoveredTaskId={factHoveredTaskId}
                hoveredTaskId={hoveredTaskId}
                onFactSegmentHover={onFactSegmentHover}
              />
            )}
          </div>

          {/* Lane отпусков: отдельная дорожка ниже карточек задач (как "stacked") */}
          {availabilityVisible ? (
            <div
              aria-hidden
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: mainAreaHeight, height: availabilityLaneHeightPx }}
            >
              <AvailabilityCardsLayer
                developerId={developer.id}
                participantsColumnWidth={participantsColumnWidth}
                sprintStartDate={sprintStartDate}
                techSprints={developerAvailability?.techSprints ?? []}
                totalHeight={availabilityLaneHeightPx}
                vacations={developerAvailability?.vacations ?? []}
              />
            </div>
          ) : null}

        </div>
      </div>
      {vacationsModal ? (
        <VacationsModal
          boardId={vacationsModal.boardId}
          isOpen={true}
          memberId={vacationsModal.memberId}
          memberName={vacationsModal.memberName}
          onClose={() => setVacationsModal(null)}
        />
      ) : null}
    </div>
  );
}

// Оптимизация: мемоизируем Swimlane для предотвращения лишних ререндеров
export const MemoizedSwimlane = React.memo(Swimlane, memoizedSwimlanePropsEqual);

MemoizedSwimlane.displayName = 'MemoizedSwimlane';

