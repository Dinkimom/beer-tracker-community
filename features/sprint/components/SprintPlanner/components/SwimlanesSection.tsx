/**
 * Компонент секции со свимлейнами
 * Отвечает за отображение DaysHeader, Swimlanes и TaskArrows
 */

import type { StatusDuration } from '@/features/task/components/TaskTimeline/types';
import type { TaskResizeParams } from '@/features/task/hooks/useTaskResize';
import type { Comment, Developer, PhaseSegment, Task, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Xwrapper } from 'react-xarrows';

import { WORKING_DAYS } from '@/constants';
import { sprintPlannerDaysHeaderContentWidthCss } from '@/features/sprint/components/SprintPlanner/layout/sprintPlannerSwimlaneLayoutWidths';
import {
  buildDeveloperAvailabilityMap,
  computeHoverConnectedTaskIds,
} from '@/features/sprint/components/SprintPlanner/utils/swimlanesSectionHelpers';
import { useHolidayDays } from '@/features/sprint/hooks/useHolidayDays';
import { buildAssigneeUnavailableDays, getOccupancyErrorDays, getOccupancyErrorDetailsByDay, getOccupancyErrorReasons, getOccupancyErrorTaskIds } from '@/features/sprint/utils/occupancyValidation';
import { Swimlane } from '@/features/swimlane/components/Swimlane';
import { TaskArrows } from '@/features/swimlane/components/task-arrows';
import { SwimlaneXarrowRedrawProvider } from '@/features/swimlane/SwimlaneArrowRedrawContext';
import {
  buildSwimlaneInProgressFactSegmentsForAssignee,
  type SwimlaneInProgressFactSegment,
} from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';
import { useRootStore } from '@/lib/layers';

import { DaysHeader } from '../../DaysHeader';

type SwimlaneLinkAnchor = 'bottom' | 'left' | 'right' | 'top';

interface SwimlanesSectionProps {
  allTasksForDrag: Task[];
  /** Данные об отпусках и техспринтах из квартального планирования */
  availability?: QuarterlyAvailability | null;
  boardId: number | null;
  comments: Comment[];
  commentsVisible: boolean;
  contextMenuBlurOtherCards?: boolean;
  developers: Developer[];
  developersManagement: {
    handleDragEnd: (activeId: string, overId: string) => void;
    hiddenIds: Set<string>;
    hideAllDevelopers: () => void;
    setSortBy: (sort: 'custom' | 'name' | 'sp' | 'tasks' | 'tp') => void;
    showAllDevelopers: () => void;
    sortBy: 'custom' | 'name' | 'sp' | 'tasks' | 'tp';
    sortedDevelopers: Developer[];
    toggleDeveloperVisibility: (id: string) => void;
    visibleDevelopers: Developer[];
  };
  dragAndDrop: {
    activeDraggableId: string | null;
    activeTaskId: string | null;
    activeTaskDuration: number | null;
    hoveredCell: { assigneeId: string; day: number; part: number } | null;
    isDraggingTask: boolean;
  };
  filteredTaskLinks: Array<{
    fromTaskId: string;
    toTaskId: string;
    id: string;
    fromAnchor?: SwimlaneLinkAnchor;
    toAnchor?: SwimlaneLinkAnchor;
  }>;
  linksDimOnHover?: boolean;
  participantsColumnWidth: number;
  qaTasksMap: Map<string, Task>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedSprintId: number | null;
  showLinks?: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sprintStartDate: Date;
  sprintTimelineWorkingDays?: number;
  /** Показывать под строкой свимлейна таймлайн факта только по статусу «В работе» */
  swimlaneFactTimelineEnabled?: boolean;
  taskChangelogsByTaskId?: Map<string, ChangelogEntry[]>;
  /** Длительности по статусам из changelog (как в занятости) — для полосы факта «В работе» */
  taskDurationsByTaskId?: Map<string, StatusDuration[]>;
  taskIssueCommentsByTaskId?: Map<string, IssueComment[]>;
  taskPositions: Map<string, TaskPosition>;
  tasksByAssignee: Map<string, Task[]>;
  /** Карта всех задач доски — для расчёта статистики по тому, что лежит в свимлейне. */
  tasksMap: Map<string, Task>;
  viewMode: 'compact' | 'full';
  onCloseSidebar: () => void;
  onCommentCreate?: (comment: Comment) => void;
  onCommentDelete: (id: string) => void;
  onCommentPositionUpdate: (id: string, x: number, y: number, assigneeId?: string) => void;
  onCommentUpdate: (id: string, text: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task, isBacklogTask?: boolean) => void;
  onCreateQATask: (devTaskId: string, anchorRect?: DOMRect) => void;
  onDeleteLink: (linkId: string) => void;
  onParticipantsColumnWidthChange?: (width: number) => void;
  onSegmentEditSave?: (position: TaskPosition, segments: PhaseSegment[], isQa: boolean) => void;
  onTaskClick: (taskId: string) => void;
  onTaskResize: (taskId: string, params: TaskResizeParams) => void;
}

export const SwimlanesSection = observer(function SwimlanesSection({
  allTasksForDrag,
  availability,
  boardId,
  comments,
  commentsVisible,
  contextMenuBlurOtherCards = false,
  developers,
  developersManagement,
  dragAndDrop,
  filteredTaskLinks,
  linksDimOnHover = true,
  participantsColumnWidth,
  qaTasksMap,
  scrollContainerRef,
  selectedSprintId,
  showLinks = true,
  sidebarOpen,
  sidebarWidth,
  sprintStartDate,
  sprintTimelineWorkingDays = WORKING_DAYS,
  taskPositions,
  taskChangelogsByTaskId,
  taskDurationsByTaskId,
  taskIssueCommentsByTaskId,
  tasksByAssignee,
  tasksMap,
  swimlaneFactTimelineEnabled = false,
  viewMode,
  onCloseSidebar,
  onCommentCreate,
  onCommentDelete,
  onCommentPositionUpdate,
  onCommentUpdate,
  onContextMenu,
  onCreateQATask,
  onDeleteLink,
  onParticipantsColumnWidthChange,
  onTaskClick,
  onTaskResize,
  onSegmentEditSave,
}: SwimlanesSectionProps) {
  const { sprintPlannerUi } = useRootStore();
  const contextMenuTaskId = sprintPlannerUi.contextMenuTaskId;
  const globalNameFilter = sprintPlannerUi.globalNameFilter;
  const hoveredTaskId = sprintPlannerUi.hoveredTaskId;
  const segmentEditTaskId = sprintPlannerUi.segmentEditTaskId;

  const [factHoveredTaskId, setFactHoveredTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!swimlaneFactTimelineEnabled) {
      setFactHoveredTaskId(null);
    }
  }, [swimlaneFactTimelineEnabled]);

  useEffect(() => {
    if (dragAndDrop.isDraggingTask) {
      setFactHoveredTaskId(null);
    }
  }, [dragAndDrop.isDraggingTask]);

  const holidayDayIndices = useHolidayDays(sprintStartDate, sprintTimelineWorkingDays);

  const swimlaneFactDeveloperMap = useMemo(
    () => new Map(developers.map((d) => [d.id, d] as const)),
    [developers]
  );

  const assigneeUnavailableDays = useMemo(
    () =>
      buildAssigneeUnavailableDays(availability ?? null, sprintStartDate, sprintTimelineWorkingDays),
    [availability, sprintStartDate, sprintTimelineWorkingDays]
  );

  const occupancyErrorTaskIds = useMemo(
    () => getOccupancyErrorTaskIds(allTasksForDrag, taskPositions, assigneeUnavailableDays),
    [allTasksForDrag, taskPositions, assigneeUnavailableDays]
  );
  const occupancyErrorDays = useMemo(
    () => getOccupancyErrorDays(allTasksForDrag, taskPositions, assigneeUnavailableDays),
    [allTasksForDrag, taskPositions, assigneeUnavailableDays]
  );
  const occupancyErrorReasons = useMemo(
    () => getOccupancyErrorReasons(allTasksForDrag, taskPositions, assigneeUnavailableDays),
    [allTasksForDrag, taskPositions, assigneeUnavailableDays]
  );
  const occupancyErrorDetailsByDay = useMemo(
    () => getOccupancyErrorDetailsByDay(allTasksForDrag, taskPositions, assigneeUnavailableDays),
    [allTasksForDrag, taskPositions, assigneeUnavailableDays]
  );

  const swimlaneInProgressFactSegmentsByDev = useMemo(() => {
    const map = new Map<string, SwimlaneInProgressFactSegment[]>();
    if (!swimlaneFactTimelineEnabled || !taskDurationsByTaskId?.size) {
      return map;
    }
    for (const dev of developersManagement.visibleDevelopers) {
      map.set(
        dev.id,
        buildSwimlaneInProgressFactSegmentsForAssignee(
          dev.id,
          dev.role,
          taskPositions,
          taskDurationsByTaskId,
          tasksMap
        )
      );
    }
    return map;
  }, [
    swimlaneFactTimelineEnabled,
    taskDurationsByTaskId,
    taskPositions,
    tasksMap,
    developersManagement.visibleDevelopers,
  ]);

  const developerAvailabilityMap = useMemo(
    () => buildDeveloperAvailabilityMap(availability ?? null, developers),
    [availability, developers]
  );

  /** При наведении на карточку — ID задач, связанных с ней (сама карточка + связи + dev→QA только если обе в свимлейне). Остальные карточки затемняем opacity 0.5. */
  const hoverConnectedTaskIds = useMemo(
    () => computeHoverConnectedTaskIds(hoveredTaskId, filteredTaskLinks, qaTasksMap, taskPositions),
    [hoveredTaskId, filteredTaskLinks, qaTasksMap, taskPositions]
  );

  const handleTaskHover = useCallback((taskId: string | null) => {
    if (dragAndDrop.isDraggingTask) {
      sprintPlannerUi.setHoveredTaskId(null);
      return;
    }
    sprintPlannerUi.setHoveredTaskId(taskId);
    setFactHoveredTaskId(taskId);
  }, [dragAndDrop.isDraggingTask, sprintPlannerUi]);

  const effectiveFactHoveredTaskId = dragAndDrop.isDraggingTask ? null : factHoveredTaskId;

  const swimlanesContentWidth = sprintPlannerDaysHeaderContentWidthCss(
    viewMode,
    participantsColumnWidth,
    sidebarOpen ? sidebarWidth : 0,
    sprintTimelineWorkingDays
  );

  return (
    <div
      ref={scrollContainerRef}
      className={`overflow-y-auto min-h-0 ${viewMode === 'full' ? 'overflow-x-auto' : 'overflow-x-hidden'} scrollbar-thin-custom`}
      style={sidebarOpen
        ? { flex: 1, minWidth: 0, transition: 'none' }
        : { flex: 1, transition: 'none' }
      }
    >
      {/* Days Header - Scrolls with content */}
      <DaysHeader
        developers={developers}
        developersManagement={developersManagement}
        errorDayDetails={occupancyErrorDetailsByDay}
        errorDayIndices={occupancyErrorDays}
        holidayDayIndices={holidayDayIndices}
        participantsColumnWidth={participantsColumnWidth}
        sidebarOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        sprintStartDate={sprintStartDate}
        sprintTimelineWorkingDays={sprintTimelineWorkingDays}
        viewMode={viewMode}
        onParticipantsColumnWidthChange={onParticipantsColumnWidthChange}
      />

      {/* Swimlanes: ширина = колонка участников + таймлайн до конца контента (без бесконечного 200vw) */}
      <div
        className="flex flex-col relative bg-white dark:bg-gray-800"
        style={{
          width: swimlanesContentWidth,
          minWidth: swimlanesContentWidth,
          transition: 'none',
          zIndex: 0,
        }}
      >
        <Xwrapper>
          <SwimlaneXarrowRedrawProvider>
            {developersManagement.visibleDevelopers.map((developer) => {
              const activeTask: Task | null = dragAndDrop.activeTaskId
                ? (allTasksForDrag.find(t => t.id === dragAndDrop.activeTaskId) || null)
                : null;
              return (
                <Swimlane
                  key={developer.id}
                  activeDraggableId={dragAndDrop.activeDraggableId}
                  activeTask={activeTask}
                  activeTaskDuration={dragAndDrop.activeTaskDuration}
                  boardId={boardId}
                  comments={commentsVisible ? comments.filter((c: Comment) => c.assigneeId === developer.id) : []}
                  contextMenuBlurOtherCards={contextMenuBlurOtherCards}
                  contextMenuTaskId={contextMenuTaskId}
                  developer={developer}
                  developerAvailability={developerAvailabilityMap.get(developer.id)}
                  developers={developers}
                  disableCloseSidebarOnClick={true}
                  errorReasons={occupancyErrorReasons}
                  errorTaskIds={occupancyErrorTaskIds}
                  factHoveredTaskId={effectiveFactHoveredTaskId}
                  globalNameFilter={globalNameFilter}
                  holidayDayIndices={holidayDayIndices}
                  hoverConnectedTaskIds={showLinks && linksDimOnHover ? hoverConnectedTaskIds : null}
                  hoveredCell={
                    dragAndDrop.hoveredCell?.assigneeId === developer.id
                      ? dragAndDrop.hoveredCell
                      : null
                  }
                  hoveredTaskId={hoveredTaskId}
                  isDraggingTask={dragAndDrop.isDraggingTask}
                  participantsColumnWidth={participantsColumnWidth}
                  qaTasksMap={qaTasksMap}
                  segmentEditTaskId={segmentEditTaskId}
                  selectedSprintId={selectedSprintId}
                selectedTaskId={null}
                  sidebarOpen={sidebarOpen}
                  sidebarWidth={sidebarWidth}
                  sprintStartDate={sprintStartDate}
                  sprintTimelineWorkingDays={sprintTimelineWorkingDays}
                  swimlaneFactChangelogsByTaskId={taskChangelogsByTaskId}
                  swimlaneFactCommentsByTaskId={taskIssueCommentsByTaskId}
                  swimlaneFactDeveloperMap={swimlaneFactDeveloperMap}
                  swimlaneFactTimelineEnabled={swimlaneFactTimelineEnabled}
                  swimlaneInProgressDurations={swimlaneInProgressFactSegmentsByDev.get(developer.id) ?? []}
                  taskPositions={taskPositions}
                  tasks={tasksByAssignee.get(developer.id) || []}
                  tasksMap={tasksMap}
                  viewMode={viewMode}
                  onCloseSidebar={onCloseSidebar}
                  onCommentCreate={onCommentCreate}
                  onCommentDelete={onCommentDelete}
                  onCommentPositionUpdate={onCommentPositionUpdate}
                  onCommentUpdate={onCommentUpdate}
                  onContextMenu={onContextMenu}
                  onCreateQATask={onCreateQATask}
                  onFactSegmentHover={dragAndDrop.isDraggingTask ? () => undefined : setFactHoveredTaskId}
                  onSegmentEditCancel={() => sprintPlannerUi.setSegmentEditTaskId(null)}
                  onSegmentEditSave={onSegmentEditSave}
                  onTaskClick={onTaskClick}
                  onTaskHover={handleTaskHover}
                  onTaskResize={onTaskResize}
                />
              );
            })}
            {/* TaskArrows - внутри Xwrapper для правильной работы react-xarrows */}
            {showLinks && (
              <TaskArrows
                activeTaskId={dragAndDrop.activeTaskId}
                developers={developersManagement.visibleDevelopers}
                hoveredTaskId={hoveredTaskId}
                qaTasksMap={qaTasksMap}
                segmentEditTaskId={segmentEditTaskId}
                taskLinks={filteredTaskLinks}
                taskPositions={taskPositions}
                tasks={allTasksForDrag}
                visibleDeveloperIds={new Set(developersManagement.visibleDevelopers.map(d => d.id))}
                onDeleteLink={onDeleteLink}
              />
            )}
          </SwimlaneXarrowRedrawProvider>
        </Xwrapper>
        <div
          aria-hidden="true"
          className="h-8 border-t border-ds-border-subtle bg-gradient-to-b from-transparent to-white/70 dark:to-gray-800/70"
        />
      </div>
    </div>
  );
});
