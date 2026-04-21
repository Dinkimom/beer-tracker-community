'use client';

import type { TimelineSettings } from './SprintPlanner/occupancy/components/table/OccupancyTableHeader';
import type { Task, TaskPosition } from '@/types';
import type { SprintInfo, SprintListItem, ChecklistItem } from '@/types/tracker';

import { useQueryClient } from '@tanstack/react-query';
import { observer } from 'mobx-react-lite';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { useXarrow } from 'react-xarrows';

import { useConfirmDialog } from '@/components/ConfirmDialog';
import { ZIndex } from '@/constants';
import { useBoards } from '@/features/board/hooks/useBoards';
import { useQATaskManagement } from '@/features/qa/hooks/useQATaskManagement';
import { buildSyntheticQaTaskId } from '@/features/qa/utils/qaTaskUtils';
import { computeAssigneePointsStats } from '@/features/sprint/utils/assigneePointsStats';
import { getDevelopersForTaskSorted } from '@/features/sprint/utils/getDevelopersForTask';
import { useDragAndDrop } from '@/features/swimlane/hooks/useDragAndDrop';
import { useOccupancyTaskOrderApi } from '@/hooks/useApiStorage';
import { useDebouncedCallback } from '@/hooks/usePerformance';
import { usePlannerIntegrationRules } from '@/hooks/usePlannerIntegrationRules';
import { useProductTenantOrganizations } from '@/hooks/useProductTenantOrganizations';
import { useRootStore } from '@/lib/layers';
import { isPlannerReleasesTabOffered } from '@/lib/trackerIntegration/plannerReleasesTabOffered';
import { resolveOccupancyMinEstimates } from '@/lib/trackerIntegration/plannerThresholds';
import { DELAYS } from '@/utils/constants';
import { getSprintStartDate, resolveSprintTimelineWorkingDaysCount } from '@/utils/dateUtils';

import { useBoardVacations } from '../hooks/useBoardVacations';
import { useDevelopersManagement } from '../hooks/useDevelopersManagement';
import { useKeyboardAndMouseHandlers } from '../hooks/useKeyboardAndMouseHandlers';
import { useScrollToCurrentDay } from '../hooks/useScrollToCurrentDay';
import { useSprintPagePlanPhases } from '../hooks/useSprintPagePlanPhases';
import { useTaskOperations } from '../hooks/useTaskOperations';

import { SprintPlannerBoardViews } from './SprintPlanner/board';
import { ModalsSection } from './SprintPlanner/components/ModalsSection';
import { SidebarSection } from './SprintPlanner/components/SidebarSection';
import { SprintPlannerControlsBar } from './SprintPlanner/components/SprintPlannerControlsBar';
import { useSprintPlannerAssigneePicker } from './SprintPlanner/hooks/useSprintPlannerAssigneePicker';
import { useSprintPlannerEstimateHandlers } from './SprintPlanner/hooks/useSprintPlannerEstimateHandlers';
import { useSprintPlannerHandlers } from './SprintPlanner/hooks/useSprintPlannerHandlers';
import { useSprintPlannerLocalPreferences } from './SprintPlanner/hooks/useSprintPlannerLocalPreferences';
import { useSprintPlannerOccupancyAndSwimlaneData } from './SprintPlanner/hooks/useSprintPlannerOccupancyAndSwimlaneData';
import { useSprintPlannerState } from './SprintPlanner/hooks/useSprintPlannerState';
import { useSprintPlannerWorkflowScreens } from './SprintPlanner/hooks/useSprintPlannerWorkflowScreens';
import { PlannerMobxSessionBridge } from './SprintPlanner/mobx/PlannerMobxSessionBridge';
import { OccupancyAssigneePicker } from './SprintPlanner/occupancy';
import { SprintPlannerDndShell } from './SprintPlanner/SprintPlannerDndShell';

interface SprintPlannerProps {
  checklistDone?: number;
  checklistTotal?: number;
  deliveryChecklistItems?: ChecklistItem[];
  deliveryGoalsLoading?: boolean;
  /** Для `/demo/planner`: UUID организации в БД для загрузки правил интеграции без активного tenant. */
  demoPlannerRulesOrganizationId?: string;
  discoveryChecklistItems?: ChecklistItem[];
  discoveryGoalsLoading?: boolean;
  goalsLoading?: boolean;
  goalTaskIds?: string[];
  loading?: boolean;
  /**
   * Если задан — запросы данных планера (задачи, отпуска, кэш-ключи React Query и т.д.) идут на эту доску,
   * а не на `selectedBoardId` из localStorage основного планера.
   */
  lockedBoardId?: number;
  selectedSprintId: number | null;
  sprintInfo: SprintInfo | null;
  sprints: SprintListItem[];
  sprintsLoading?: boolean;
  /** Идёт перезагрузка задач по кнопке «Обновить задачи» */
  tasksReloading?: boolean;
  onGoalsUpdate?: () => void;
  onSprintChange: (sprintId: number | null) => void;
  onTasksReload?: (options?: { showToast?: boolean }) => void;
}

export const SprintPlanner = observer(function SprintPlanner({
  sprintInfo,
  sprints,
  selectedSprintId,
  onSprintChange,
  loading: tasksLoading = false,
  sprintsLoading = false,
  checklistDone = 0,
  checklistTotal = 0,
  deliveryChecklistItems = [],
  deliveryGoalsLoading = false,
  discoveryChecklistItems = [],
  discoveryGoalsLoading = false,
  goalTaskIds = [],
  goalsLoading = false,
  onGoalsUpdate,
  onTasksReload,
  tasksReloading = false,
  demoPlannerRulesOrganizationId,
  lockedBoardId,
}: SprintPlannerProps) {
  const queryClient = useQueryClient();
  const { sprintPlannerUi } = useRootStore();
  const updateXarrow = useXarrow();
  const { getQueueByBoardId } = useBoards();
  const { activeOrganizationId: tenantOrganizationId } = useProductTenantOrganizations({
    pollIntervalMs: 30_000,
  });
  const activeOrganizationId =
    demoPlannerRulesOrganizationId ?? tenantOrganizationId;
  const { data: plannerIntegrationRules, isFetched: plannerRulesFetched } =
    usePlannerIntegrationRules(activeOrganizationId);
  const occupancyAssigneeThresholds = useMemo(
    () => resolveOccupancyMinEstimates(plannerIntegrationRules),
    [plannerIntegrationRules]
  );

  const hideReleasesTab = !isPlannerReleasesTabOffered(
    tenantOrganizationId,
    plannerRulesFetched,
    plannerIntegrationRules
  );

  // Оптимизация: debounce для updateXarrow чтобы избежать частых вызовов
  const debouncedUpdateXarrow = useDebouncedCallback(
    updateXarrow,
    100,
    { leading: true, trailing: true }
  );

  const {
    selectedBoardId,
    participantsColumnWidth,
    setParticipantsColumnWidth,
    selectedAssigneeIds,
    setSelectedAssigneeIds,
    timelineSettingsStorage,
    swimlaneLinksVisible,
    swimlaneFactTimelineVisible,
    linksDimOnHover,
    occupancyOldTmLayout,
    occupancyRowFields,
    occupancyStatusFilter,
    setOccupancyStatusFilter,
    occupancyTimelineScale,
    syncAssignees,
    syncEstimates,
    kanbanGroupBy,
  } = useSprintPlannerLocalPreferences();

  const boardIdForPlannerData: number | null =
    lockedBoardId !== undefined ? lockedBoardId : selectedBoardId;

  const integrationRulesRevisionGateRef = useRef<{
    orgId: string | null;
    sprintId: number | null;
    revision: number | undefined;
  } | null>(null);

  useEffect(() => {
    if (!selectedSprintId || !plannerRulesFetched) {
      return;
    }

    const orgId = activeOrganizationId ?? null;
    const rev = plannerIntegrationRules?.configRevision;
    if (rev === undefined) {
      return;
    }

    const prev = integrationRulesRevisionGateRef.current;
    const sameContext =
      prev != null && prev.orgId === orgId && prev.sprintId === selectedSprintId;

    if (!sameContext) {
      // Смена org/sprint: кеш задач не содержит org в queryKey — при смене организации
      // обязательно перезагружаем. Первый заход в контекст без предыдущего — не инвалидируем:
      // задачи уже запрашиваются с актуальной сессией; лишняя инвалидация давала моргание UI.
      if (
        prev != null &&
        prev.sprintId === selectedSprintId &&
        prev.orgId !== orgId &&
        orgId != null &&
        prev.orgId != null
      ) {
        queryClient.invalidateQueries({
          queryKey: ['tasks', selectedSprintId, boardIdForPlannerData ?? null],
        });
        queryClient.invalidateQueries({
          queryKey: ['tasks', 'occupancy', selectedSprintId, boardIdForPlannerData ?? null],
        });
      }
      integrationRulesRevisionGateRef.current = {
        orgId,
        sprintId: selectedSprintId,
        revision: rev,
      };
      return;
    }

    if (prev.revision === rev) {
      return;
    }

    integrationRulesRevisionGateRef.current = {
      orgId,
      sprintId: selectedSprintId,
      revision: rev,
    };

    // Тот же спринт/org: изменилась ревизия правил интеграции — пересчёт в /api/tracker.
    queryClient.invalidateQueries({
      queryKey: ['tasks', selectedSprintId, boardIdForPlannerData ?? null],
    });
    queryClient.invalidateQueries({
      queryKey: ['tasks', 'occupancy', selectedSprintId, boardIdForPlannerData ?? null],
    });
  }, [
    activeOrganizationId,
    plannerIntegrationRules?.configRevision,
    plannerRulesFetched,
    queryClient,
    boardIdForPlannerData,
    selectedSprintId,
  ]);
  const [taskOrder, setTaskOrder] = useOccupancyTaskOrderApi(selectedSprintId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { confirm, DialogComponent } = useConfirmDialog();

  // Преобразуем настройки из хранилища в формат TimelineSettings для совместимости
  const timelineSettings: TimelineSettings = {
    showStatuses: timelineSettingsStorage.showStatuses,
    showComments: timelineSettingsStorage.showComments,
    showReestimations: timelineSettingsStorage.showReestimations,
    showLinks: timelineSettingsStorage.showLinks ?? true,
    showFreeSlotPreview: timelineSettingsStorage.showFreeSlotPreview ?? true,
  };

  const factVisible = timelineSettingsStorage.enabled;
  const showStoryPlanPhases = timelineSettingsStorage.showStoryPlanPhases !== false;
  const workflowScreens = useSprintPlannerWorkflowScreens(boardIdForPlannerData, getQueueByBoardId);

  // Используем хук для управления состоянием
  const state = useSprintPlannerState({
    selectedBoardId: boardIdForPlannerData,
    selectedSprintId,
  });

  const {
    developers,
    tasks,
    setTasks,
    sidebarWidth,
    setSidebarWidth,
    viewMode,
    setViewMode,
    isMounted,
    taskPositions,
    setTaskPositions,
    savePosition,
    deletePosition,
    taskLinks,
    setTaskLinks,
    saveLink,
    deleteLink,
    comments,
    setComments,
    deleteComment,
    qaTasksMap,
    allTasksForDrag,
    tasksMap,
    qaTasksByOriginalId,
    unassignedTasks,
    tasksByAssignee,
    filteredTaskPositions,
    filteredTaskLinks,
  } = state;

  useEffect(() => {
    if (
      plannerIntegrationRules?.testingFlowMode !== 'standalone_qa_tasks' ||
      !selectedSprintId ||
      taskPositions.size === 0
    ) {
      return;
    }

    const staleSyntheticQaIds = tasks
      .map((task) => buildSyntheticQaTaskId(task.id))
      .filter((qaTaskId) => taskPositions.has(qaTaskId));

    if (staleSyntheticQaIds.length === 0) {
      return;
    }

    void Promise.allSettled(staleSyntheticQaIds.map((qaTaskId) => deletePosition(qaTaskId)));
  }, [
    deletePosition,
    plannerIntegrationRules?.testingFlowMode,
    selectedSprintId,
    taskPositions,
    tasks,
  ]);

  useEffect(() => {
    if (viewMode === 'kanban') {
      sprintPlannerUi.setSegmentEditTaskId(null);
    }
  }, [viewMode, sprintPlannerUi]);

  const contextMenuBlurOtherCards =
    Boolean(sprintPlannerUi.contextMenu?.anchorRect) && sprintPlannerUi.contextMenu?.dimPeerUi !== false;

  const {
    occupancyTasksLoading,
    swimlaneTaskChangelogsMap,
    swimlaneTaskDurationsMap,
    swimlaneTaskIssueCommentsMap,
    tasksForOccupancy,
  } = useSprintPlannerOccupancyAndSwimlaneData({
      allTasksForDrag,
      occupancyStatusFilter,
      selectedBoardId: boardIdForPlannerData,
      selectedSprintId,
      swimlaneFactTimelineVisible,
      viewMode,
    });

  const swimlaneFactTimelineEnabled =
    swimlaneFactTimelineVisible && (viewMode === 'full' || viewMode === 'compact');

  const handleAddLink = useCallback(
    (link: { fromTaskId: string; toTaskId: string; id: string }) => {
      setTaskLinks((prev) => [...prev, link]);
      saveLink(link).catch((err) => console.error('Error saving link:', err));
    },
    [setTaskLinks, saveLink]
  );

  // Callback для получения задачи из бэклога и удаления её из списка
  const backlogTaskRef = useRef<{ getTask: (taskId: string) => Task | undefined; removeTask: (taskId: string) => void } | null>(null);

  // Обновляем стрелки после загрузки данных из localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedUpdateXarrow();
    }, DELAYS.UI_UPDATE);
    return () => clearTimeout(timeoutId);
  }, [debouncedUpdateXarrow]);

  // Сброс преходящего UI при смене спринта (поиск, меню, редактор сегментов и т.д.)
  useEffect(() => {
    startTransition(() => {
      sprintPlannerUi.clearTransientUiOnSprintChange();
    });
  }, [selectedSprintId, sprintPlannerUi]);

  // Статистика по исполнителям для picker — только то, что запланировано в свимлейне (итоги = сумма по строкам)
  const assigneePointsStats = useMemo(
    () => computeAssigneePointsStats(filteredTaskPositions, tasksMap),
    [filteredTaskPositions, tasksMap]
  );

  // Вычисляем дату начала спринта из sprintInfo или используем текущую неделю (мемоизируем)
  const sprintStartDate = useMemo(() => {
    return sprintInfo?.startDate ? new Date(sprintInfo.startDate) : getSprintStartDate();
  }, [sprintInfo]);

  const sprintTimelineWorkingDays = useMemo(
    () => resolveSprintTimelineWorkingDaysCount(sprintInfo?.startDate, sprintInfo?.endDate),
    [sprintInfo?.endDate, sprintInfo?.startDate]
  );

  // Отпуска: теперь из независимой таблицы vacations (по доске), чтобы покрывать переходы между кварталами.
  const { data: boardVacations = [] } = useBoardVacations(boardIdForPlannerData ?? null);
  // Tech-sprints пока остаются пустыми (старый источник был quarterly plan).
  const availability = useMemo(() => {
    if (!boardIdForPlannerData) return null;
    return { planId: `board-${boardIdForPlannerData}`, vacations: boardVacations, techSprints: [] };
  }, [boardVacations, boardIdForPlannerData]);

  // Родительские тикеты из группировки occupancy — запрос плана только по ним
  const occupancyParentKeys = useMemo(
    () => [...new Set(tasksForOccupancy.map((t) => t.parent?.key).filter(Boolean))] as string[],
    [tasksForOccupancy]
  );
  const { parentKeyToPlanPhase, releaseInSprintKeys } = useSprintPagePlanPhases(
    boardIdForPlannerData ?? null,
    selectedSprintId,
    sprintStartDate,
    sprints,
    occupancyParentKeys
  );

  // Автоматическая прокрутка к текущей ячейке
  useScrollToCurrentDay({
    isMounted,
    viewMode,
    sprintInfo,
    selectedSprintId,
    sprints,
    scrollContainerRef,
  });

  // Управление участниками (сортировка и скрытие)
  const developersManagement = useDevelopersManagement(developers, filteredTaskPositions, tasksByAssignee);

  // Используем хуки для операций с задачами
  const taskOperations = useTaskOperations({
    tasks,
    taskPositions,
    taskLinks,
    selectedSprintId,
    sprints,
    setTasks,
    setTaskPositions,
    setTaskLinks,
    deletePosition,
    deleteLink,
    onTasksReload,
    updateXarrow: debouncedUpdateXarrow,
  });


  // Хук для управления QA задачами
  const qaTaskManagement = useQATaskManagement({
    taskPositions,
    filteredTaskPositions,
    filteredTaskLinks,
    allTasksForDrag,
    sortedDevelopers: developersManagement.sortedDevelopers,
    selectedSprintId,
    savePosition,
    setTaskPositions,
    setTaskLinks,
    saveLink,
    updateXarrow: debouncedUpdateXarrow,
  });

  const {
    handleEstimateUpdateSuccess,
    handleOccupancyPositionSave,
    handleSegmentEditSave,
    handleSplitPhaseIntoSegments,
    handleUpdateEstimate,
  } = useSprintPlannerEstimateHandlers({
    filteredTaskPositions,
    onTasksReload,
    qaTasksByOriginalId,
    savePosition,
    setTaskPositions,
    setTasks,
    syncEstimates,
    tasksMap,
  });

  const {
    assigneePicker,
    setAssigneePicker,
    handleAssigneeSelect,
    handleChangeAssignee,
    handleOpenAssigneePicker,
    onRequestQaEngineerPicker,
  } = useSprintPlannerAssigneePicker({
    developers,
    filteredTaskPositions,
    qaTaskManagement,
    savePosition,
    setTasks,
    syncAssignees,
    taskPositions,
    tasks,
  });

  const resetDragStateRef = useRef<(() => void) | null>(null);

  const handlers = useSprintPlannerHandlers({
    selectedSprintId,
    setComments,
    setSidebarOpen: sprintPlannerUi.setSidebarOpen,
    setTaskLinks,
    setTaskPositions,
    setTasks,
    backlogTaskRef,
    allTasksForDrag,
    confirm,
    debouncedUpdateXarrow,
    developersManagement,
    resetDragStateRef,
    filteredTaskLinks,
    filteredTaskPositions,
    qaTaskManagement,
    qaTasksMap,
    qaTasksByOriginalId,
    sprintStartDate,
    sprintTimelineWorkingDays,
    taskOperations,
    tasks,
    tasksMap,
    taskPositions,
    deleteLink,
    deletePosition,
    deleteComment,
    onRequestQaEngineerPicker,
    saveLink,
    savePosition,
    onTasksReload,
    workflowScreens,
  });

  const handleCommentCreateWithFocus = useCallback(
    (comment: Parameters<NonNullable<typeof handlers>['handleCommentCreate']>[0]) => {
      handlers.handleCommentCreate(comment);
      sprintPlannerUi.setOpenCommentEditId(comment.id);
    },
    [handlers, sprintPlannerUi]
  );

  // Не сбрасываем openCommentEditId сразу после кадра (ломало бы попап при Strict Mode).
  // Стабильность попапа после ответа API — за счёт clientInstanceId + key в OccupancyTimelineCells.

  // Контекст перетаскивания для определения дропа в сайдбаре по координатам (когда collision detection вернул ячейку свимлейна)
  const dragContextRef = useRef<{
    isDragFromSidebar: boolean;
    sidebarOpen: boolean;
    sidebarWidth: number;
  } | null>(null);

  // Хук для управления перетаскиванием (создаем после handlers)
  const dragAndDrop = useDragAndDrop({
    tasks: allTasksForDrag,
    taskPositions: filteredTaskPositions,
    onPositionUpdate: handlers.handlePositionUpdate,
    onPositionDelete: handlers.handlePositionDelete,
    updateXarrow: debouncedUpdateXarrow,
    onBacklogTaskDrop: handlers.handleBacklogTaskDrop,
    dragContextRef,
    swimlaneTimelineWorkingDays: sprintTimelineWorkingDays,
  });

  useLayoutEffect(() => {
    resetDragStateRef.current = dragAndDrop.resetDragState;
    return () => {
      resetDragStateRef.current = null;
    };
  }, [dragAndDrop.resetDragState]);

  // Хук для обработки событий клавиатуры и мыши
  useKeyboardAndMouseHandlers({
    filteredTaskPositions,
    selectedSprintId,
    setTaskPositions,
    setTaskLinks,
    deletePosition,
    deleteLink,
    filteredTaskLinks,
  });

  // Активная задача для DragOverlay и флаг «перетаскивание из сайдбара»
  const [isDragFromSidebar, setIsDragFromSidebar] = useState(false);
  const activeTask = useMemo(() => {
    if (!dragAndDrop.activeTaskId) return null;
    return allTasksForDrag.find((t) => t.id === dragAndDrop.activeTaskId) || null;
  }, [dragAndDrop.activeTaskId, allTasksForDrag]);

  return (
    <>
    <PlannerMobxSessionBridge />
    <SprintPlannerDndShell
      activeTask={activeTask}
      developers={developers}
      developersManagement={developersManagement}
      dragAndDrop={dragAndDrop}
      dragContextRef={dragContextRef}
      isDragFromSidebar={isDragFromSidebar}
      setIsDragFromSidebar={setIsDragFromSidebar}
      sidebarOpen={sprintPlannerUi.sidebarOpen}
      sidebarWidth={sidebarWidth}
    >
      <div
        className="relative flex flex-col bg-gray-50 dark:bg-gray-900 flex-1 min-h-0 overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <SprintPlannerControlsBar
          commentsLength={comments.length}
          commentsVisible={sprintPlannerUi.commentsVisible}
          developers={developers}
          occupancyStatusFilter={occupancyStatusFilter}
          selectedAssigneeIds={selectedAssigneeIds}
          selectedSprintId={selectedSprintId}
          setCommentsVisible={sprintPlannerUi.setCommentsVisible}
          setOccupancyStatusFilter={setOccupancyStatusFilter}
          setSelectedAssigneeIds={setSelectedAssigneeIds}
          setViewMode={setViewMode}
          sidebarOpen={sprintPlannerUi.sidebarOpen}
          sprints={sprints}
          sprintsLoading={sprintsLoading}
          tasksLoading={tasksLoading}
          tasksReloading={tasksReloading}
          viewMode={viewMode}
          onOpenSidebar={handlers.handleToggleSidebar}
          onSprintChange={onSprintChange}
          onTasksReload={onTasksReload}
        />
        {/* Контейнер с шапкой/свимлейнами или режимом занятости */}
        <div className="flex flex-1 overflow-hidden min-h-0 relative" style={{ zIndex: ZIndex.base }}>
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
            <SprintPlannerBoardViews
              kanban={{
                boardId: boardIdForPlannerData ?? null,
                contextMenuBlurOtherCards,
                developers,
                groupBy: kanbanGroupBy,
                tasks: allTasksForDrag,
                onContextMenu: handlers.handleContextMenu,
                onStatusChange: handlers.handleStatusChange,
                onTaskClick: handlers.handleTaskClick,
              }}
              occupancy={{
                availability,
                contextMenuBlurOtherCards,
                deliveryChecklistItems,
                developers,
                discoveryChecklistItems,
                factVisible,
                linksDimOnHover,
                occupancyCallbacks: {
                  onAddLink: handleAddLink,
                  onCommentCreate: handleCommentCreateWithFocus,
                  onCommentDelete: handlers.handleCommentDelete,
                  onCommentMove: handlers.handleCommentMove,
                  onCommentPositionUpdate: handlers.handleCommentPositionUpdate,
                  onCommentUpdate: handlers.handleCommentUpdate,
                  onContextMenu: handlers.handleContextMenu,
                  onDeleteLink: handlers.handleDeleteLink,
                  onOpenAssigneePicker: handleOpenAssigneePicker,
                  onPositionSave: handleOccupancyPositionSave,
                  onSegmentEditSave: handleSegmentEditSave,
                  onTaskClick: handlers.handleTaskClick,
                  onTaskOrderChange: (order) => setTaskOrder(() => order),
                },
                occupancyComments: {
                  comments,
                  commentsVisible: sprintPlannerUi.commentsVisible,
                },
                occupancyLayout: {
                  legacyCompactLayout: occupancyOldTmLayout,
                  plannerSidebarOpen: sprintPlannerUi.sidebarOpen,
                  plannerSidebarWidth: sidebarWidth,
                  rowFieldsVisibility: occupancyRowFields,
                  timelineScale: occupancyTimelineScale,
                },
                parentKeyToPlanPhase: showStoryPlanPhases ? parentKeyToPlanPhase : undefined,
                releaseInSprintKeys: showStoryPlanPhases ? releaseInSprintKeys : undefined,
                selectedAssigneeIds,
                sprintStartDate,
                sprintWorkingDaysCount: sprintTimelineWorkingDays,
                swimlaneLinksVisible,
                taskLinks: filteredTaskLinks,
                taskOrder,
                taskPositions: filteredTaskPositions,
                tasks: tasksForOccupancy,
                timelineSettings,
                usePlannerUiStore: true,
              }}
              occupancyStatusFilter={occupancyStatusFilter}
              occupancyTasksLoading={occupancyTasksLoading}
              swimlanes={{
                allTasksForDrag,
                availability,
                boardId: boardIdForPlannerData ?? null,
                comments: [],
                commentsVisible: false,
                contextMenuBlurOtherCards,
                developers,
                developersManagement,
                dragAndDrop,
                filteredTaskLinks,
                linksDimOnHover,
                participantsColumnWidth,
                qaTasksMap,
                scrollContainerRef,
                selectedSprintId,
                showLinks: swimlaneLinksVisible,
                sidebarOpen: sprintPlannerUi.sidebarOpen,
                sidebarWidth,
                sprintStartDate,
                sprintTimelineWorkingDays,
                swimlaneFactTimelineEnabled,
                taskChangelogsByTaskId: swimlaneTaskChangelogsMap,
                taskDurationsByTaskId: swimlaneTaskDurationsMap,
                taskIssueCommentsByTaskId: swimlaneTaskIssueCommentsMap,
                taskPositions,
                tasksByAssignee,
                tasksMap,
                onCloseSidebar: handlers.handleCloseSidebar,
                onCommentCreate: undefined,
                onCommentDelete: handlers.handleCommentDelete,
                onCommentPositionUpdate: handlers.handleCommentPositionUpdate,
                onCommentUpdate: handlers.handleCommentUpdate,
                onContextMenu: handlers.handleContextMenu,
                onCreateQATask: handlers.handleCreateQATask,
                onDeleteLink: handlers.handleDeleteLink,
                onParticipantsColumnWidthChange: setParticipantsColumnWidth,
                onSegmentEditSave: handleSegmentEditSave,
                onTaskClick: handlers.handleTaskClick,
                onTaskResize: handlers.handleTaskResize,
              }}
              viewMode={viewMode}
            />
          </div>

          <SidebarSection
            activeTaskDuration={dragAndDrop.activeTaskDuration}
            activeTaskId={dragAndDrop.activeTaskId}
            allSprintTasks={tasks}
            backlogTaskRef={backlogTaskRef}
            checklistDone={checklistDone}
            checklistTotal={checklistTotal}
            contextMenuBlurOtherCards={contextMenuBlurOtherCards}
            deliveryChecklistItems={deliveryChecklistItems}
            deliveryGoalsLoading={deliveryGoalsLoading}
            developers={developers}
            developersManagement={developersManagement}
            discoveryChecklistItems={discoveryChecklistItems}
            discoveryGoalsLoading={discoveryGoalsLoading}
            goalTaskIds={goalTaskIds}
            goalsLoading={goalsLoading}
            hideReleasesTab={hideReleasesTab}
            qaTasksMap={qaTasksMap}
            selectedBoardId={boardIdForPlannerData}
            selectedSprintId={selectedSprintId}
            sidebarOpen={sprintPlannerUi.sidebarOpen}
            sidebarWidth={sidebarWidth}
            sprintInfo={sprintInfo}
            sprints={sprints}
            taskPositions={filteredTaskPositions}
            unassignedTasks={unassignedTasks}
            viewMode={viewMode}
            onAutoAddToSwimlane={handlers.handleAutoAddToSwimlane}
            onAutoAssignTasks={handlers.handleAutoAssignTasks}
            onContextMenu={handlers.handleContextMenu}
            onGoalsUpdate={onGoalsUpdate}
            onReturnAllTasks={handlers.handleReturnAllTasks}
            onTasksReload={onTasksReload}
            onToggle={handlers.handleToggleSidebar}
            onWidthChange={setSidebarWidth}
          />
        </div>
      </div>
    </SprintPlannerDndShell>
    <ModalsSection
      DialogComponent={DialogComponent}
      selectedSprintId={selectedSprintId}
      sprints={sprints}
      taskPositions={filteredTaskPositions}
      transitionModal={handlers.transitionModal}
      viewMode={viewMode}
      onAccountWork={handlers.handleAccountWork}
      onChangeAssignee={handleChangeAssignee}
      onCloseTransitionModal={handlers.closeTransitionModal}
      onEstimateUpdateSuccess={handleEstimateUpdateSuccess}
      onMoveToSprint={handlers.handleMoveToSprint}
      onRemoveFromPlan={handlers.handleRemoveFromPlan}
      onRemoveFromSprint={handlers.handleRemoveFromSprint}
      onSplitPhaseIntoSegments={handleSplitPhaseIntoSegments}
      onStatusChange={handlers.handleStatusChange}
      onTransitionSubmit={handlers.handleTransitionSubmit}
      onUpdateEstimate={handleUpdateEstimate}
    />
    {assigneePicker && (
      <OccupancyAssigneePicker
        anchorRect={assigneePicker.anchorRect}
        assigneePointsStats={assigneePointsStats}
        availability={availability}
        developers={getDevelopersForTaskSorted(
          developers,
          assigneePicker.mode === 'qaEngineerQuickAdd'
            ? {
                ...assigneePicker.devTask,
                team: 'QA',
                originalTaskId: assigneePicker.devTask.id,
              }
            : assigneePicker.task
        )}
        minStoryPointsForAssignee={occupancyAssigneeThresholds.minStoryPointsForAssignee}
        minTestPointsForAssignee={occupancyAssigneeThresholds.minTestPointsForAssignee}
        position={
          assigneePicker.mode === 'phase'
            ? assigneePicker.position
            : ({
                taskId: assigneePicker.devTask.id,
                assignee: '',
                duration: 1,
                startDay: 0,
                startPart: 0,
              } as TaskPosition)
        }
        sprintStartDate={sprintStartDate}
        task={
          assigneePicker.mode === 'phase'
            ? assigneePicker.task
            : {
                ...assigneePicker.devTask,
                team: 'QA',
                originalTaskId: assigneePicker.devTask.id,
              }
        }
        onClose={() => setAssigneePicker(null)}
        onSelect={handleAssigneeSelect}
      />
    )}
    </>
  );
});
