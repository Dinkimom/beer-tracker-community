'use client';

import type { TaskSidebarContextValue } from '@/features/sidebar/contexts/TaskSidebarContext';
import type { Developer, Task, TaskPosition } from '@/types';
import type { ChecklistItem, SprintInfo, SprintListItem } from '@/types/tracker';

import { useDroppable } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { SidebarHeader } from '@/features/sidebar/components/SidebarHeader';
import { SidebarTabContent } from '@/features/sidebar/components/SidebarTabContent';
import { TaskSidebarContext } from '@/features/sidebar/contexts/TaskSidebarContext';
import { useBacklogManagement } from '@/features/sidebar/hooks/useBacklogManagement';
import { useSidebarHeaderTabs } from '@/features/sidebar/hooks/useSidebarHeaderTabs';
import { useSidebarTabsState } from '@/features/sidebar/hooks/useSidebarTabsState';
import { useSprintGoalManagement } from '@/features/sprint/hooks/useSprintGoalManagement';
import { collectInvalidSprintDevTasks } from '@/features/sprint/utils/sprintStartChecks';
import { useTaskFiltering } from '@/features/task/hooks/useTaskFiltering';
import { useTaskGrouping } from '@/features/task/hooks/useTaskGrouping';
import { useSidebarGroupByStorage, useSidebarStatusFilterStorage, useSidebarTabsSettingsStorage } from '@/hooks/useLocalStorage';
import { isTodaySprintFirstWeekMonday } from '@/utils/dateUtils';

interface TaskSidebarProps {
  // ID активной перетаскиваемой задачи
  activeTaskDuration?: number | null;
  // Функция автоматической расстановки задач
  activeTaskId?: string | null;
  /** Все задачи спринта (для метрик «Разбивка по исполнителям» и целей). Передавать полный список. */
  allSprintTasks?: Task[];
  // Чеклист целей спринта
  checklistDone?: number;
  checklistTotal?: number;
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  deliveryChecklistItems?: ChecklistItem[];
  deliveryGoalsLoading?: boolean;
  developers: Developer[];
  developersManagement?: {
    handleDragEnd: (activeId: string, overId: string) => void;
    hiddenIds: Set<string>;
    hideAllDevelopers: () => void;
    setSortBy: (sort: 'custom' | 'name' | 'sp' | 'tasks' | 'tp') => void;
    showAllDevelopers: () => void;
    sortBy: 'custom' | 'name' | 'sp' | 'tasks' | 'tp';
    toggleDeveloperVisibility: (id: string) => void;
    sortedDevelopers: Developer[];
  };
  discoveryChecklistItems?: ChecklistItem[];
  discoveryGoalsLoading?: boolean;
  goalsLoading?: boolean;
  goalTaskIds?: string[];
  hideBacklogTab?: boolean;
  hideReleasesTab?: boolean;
  hideTasksTab?: boolean;
  // Все задачи спринта (для метрик)
  qaTasksMap: Map<string, Task>;
  selectedBoardId?: number | null; // ID выбранной доски для загрузки бэклога
  selectedSprintId?: number | null; // ID текущего спринта для валидации
  sprintInfo?: SprintInfo | null; // Callback для обновления целей
  sprints?: SprintListItem[];
  taskPositions?: Map<string, TaskPosition> | null;
  // Словарь QA задач: ключ - оригинальный ID, значение - QA задача
  tasks: Task[]; // Длительность активной задачи для превью
  viewMode?: 'compact' | 'full';
  width?: number;
  onAutoAddToSwimlane?: (task: Task) => void;
  onAutoAssignTasks?: () => void;
  onBacklogTaskRef?: (ref: { getTask: (taskId: string) => Task | undefined; removeTask: (taskId: string) => void }) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task, isBacklogTask?: boolean) => void;
  // Информация о спринте для отображения целей
  onGoalsUpdate?: () => void;
  onReturnAllTasks?: () => void; // Общее количество целей
  onTasksReload?: () => void;
}

export function TaskSidebar({
  tasks,
  allSprintTasks,
  qaTasksMap,
  taskPositions = null,
  developers,
  width = 320,
  onReturnAllTasks,
  onAutoAssignTasks,
  activeTaskId,
  activeTaskDuration,
  viewMode = 'full',
  sprintInfo,
  onGoalsUpdate,
  onTasksReload,
  checklistDone: externalChecklistDone = 0,
  checklistTotal: externalChecklistTotal = 0,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  deliveryChecklistItems: externalDeliveryChecklistItems = [],
  discoveryChecklistItems: externalDiscoveryChecklistItems = [],
  deliveryGoalsLoading: externalDeliveryGoalsLoading = false,
  discoveryGoalsLoading: externalDiscoveryGoalsLoading = false,
  goalTaskIds: externalGoalTaskIds,
  goalsLoading: externalGoalsLoading = false,
  developersManagement,
  onContextMenu,
  selectedBoardId,
  selectedSprintId,
  sprints = [],
  onBacklogTaskRef,
  hideTasksTab = false,
  hideBacklogTab = false,
  hideReleasesTab = false,
  onAutoAddToSwimlane,
}: TaskSidebarProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'sidebar-unassigned',
  });

  const { activeTab, mainTab, setActiveTab, setMainTab } = useSidebarTabsState({
    hideBacklogTab,
    hideTasksTab,
  });

  useEffect(() => {
    if (hideReleasesTab && mainTab === 'releases') {
      setMainTab('tasks');
    }
  }, [hideReleasesTab, mainTab, setMainTab]);

  const [groupBy, setGroupBy] = useSidebarGroupByStorage();
  const [statusFilter, setStatusFilter] = useSidebarStatusFilterStorage();
  const [nameFilter, setNameFilter] = useState<string>('');
  const [sidebarTabsSettings] = useSidebarTabsSettingsStorage();

  const checklistDone = externalChecklistDone;
  const checklistTotal = externalChecklistTotal;
  const deliveryChecklistItems = externalDeliveryChecklistItems;
  const discoveryChecklistItems = externalDiscoveryChecklistItems;
  const goalsLoading = externalGoalsLoading || externalDeliveryGoalsLoading || externalDiscoveryGoalsLoading;

  const goalTaskIds =
    externalGoalTaskIds ??
    (allSprintTasks ?? tasks).filter((t) => t.type === 'goal').map((t) => t.id);

  // Все dev-задачи спринта с ошибками (как в чеклисте), а не только «в сайдбаре»
  const invalidTasks = collectInvalidSprintDevTasks(allSprintTasks ?? tasks, goalTaskIds);

  let canEdit = false;
  if (sprintInfo) {
    const isDraft = sprintInfo.status === 'draft' || sprintInfo.status === 'Draft';
    const goalsEditOnFirstMonday = !isDraft && isTodaySprintFirstWeekMonday(sprintInfo.startDate);
    canEdit = isDraft || goalsEditOnFirstMonday;
  }

  const queryClient = useQueryClient();

  const deliveryGoalManagement = useSprintGoalManagement({
    goalType: 'delivery',
    sprintId: selectedSprintId ?? null,
    boardId: selectedBoardId ?? null,
    queryClient,
    onGoalsUpdate,
  });

  const discoveryGoalManagement = useSprintGoalManagement({
    goalType: 'discovery',
    sprintId: selectedSprintId ?? null,
    boardId: selectedBoardId ?? null,
    queryClient,
    onGoalsUpdate,
  });

  const {
    devTasks,
    qaTasks,
    allTasks,
    allTasksCount,
    devTasksCount,
    qaTasksCount,
  } = useTaskFiltering({
    tasks,
    qaTasksMap,
    statusFilter,
    nameFilter,
    goalTaskIds,
  });

  const backlogManagement = useBacklogManagement({
    selectedBoardId,
    mainTab,
    statusFilter,
    nameFilter,
    goalTaskIds,
    onBacklogTaskRef,
  });

  let tasksToGroupResult: Task[] = [];
  if (mainTab === 'backlog') {
    tasksToGroupResult = backlogManagement.filteredBacklogTasks;
  } else if (mainTab === 'invalid') {
    tasksToGroupResult = invalidTasks.map(({ task }) => task);
  } else if (mainTab === 'tasks') {
    if (activeTab === 'all') {
      tasksToGroupResult = allTasks;
    } else if (activeTab === 'dev') {
      tasksToGroupResult = devTasks;
    } else {
      tasksToGroupResult = qaTasks;
    }
  }
  const tasksToGroup = tasksToGroupResult;

  const developersForGrouping = mainTab === 'backlog' ? backlogManagement.backlogDevelopers : developers;

  // Группируем задачи используя хук
  const { groupedTasks, groupKeys } = useTaskGrouping({
    tasks: tasksToGroup,
    groupBy,
    developers: developersForGrouping,
    sortedDevelopers: developersManagement?.sortedDevelopers,
  });

  const contextValue: TaskSidebarContextValue = {
    width,
    contextMenuBlurOtherCards,
    contextMenuTaskId,
    mainTab,
    setMainTab,
    hideBacklogTab,
    hideTasksTab,
    activeTab,
    setActiveTab,
    groupBy,
    setGroupBy,
    statusFilter,
    setStatusFilter,
    nameFilter,
    setNameFilter,
    allTasksCount,
    devTasksCount,
    qaTasksCount,
    groupKeys,
    groupedTasks,
    developers,
    qaTasksMap,
    taskPositions,
    activeTaskId,
    activeTaskDuration,
    viewMode,
    selectedSprintId,
    onContextMenu,
    onReturnAllTasks,
    onAutoAddToSwimlane,
    onAutoAssignTasks,
    canEdit,
    deliveryChecklistItems,
    deliveryGoalsLoading: externalDeliveryGoalsLoading,
    deliveryUpdatingItems: deliveryGoalManagement.updatingItems,
    discoveryChecklistItems,
    discoveryGoalsLoading: externalDiscoveryGoalsLoading,
    discoveryUpdatingItems: discoveryGoalManagement.updatingItems,
    goalsLoading,
    goalTaskIds,
    sprintInfo: sprintInfo ? { id: sprintInfo.id, status: sprintInfo.status, version: sprintInfo.version } : null,
    sprints,
    allSprintTasksForMetrics: allSprintTasks,
    goalsTasks: allSprintTasks || tasks,
    onAddDeliveryGoal: canEdit ? deliveryGoalManagement.handleAddGoal : undefined,
    onAddDiscoveryGoal: canEdit ? discoveryGoalManagement.handleAddGoal : undefined,
    onCheckboxChangeDelivery: deliveryGoalManagement.handleCheckboxChange,
    onCheckboxChangeDiscovery: discoveryGoalManagement.handleCheckboxChange,
    onDeleteDeliveryGoal: canEdit ? deliveryGoalManagement.handleDeleteGoal : undefined,
    onDeleteDiscoveryGoal: canEdit ? discoveryGoalManagement.handleDeleteGoal : undefined,
    onEditDeliveryGoal: canEdit ? deliveryGoalManagement.handleEditGoal : undefined,
    onEditDiscoveryGoal: canEdit ? discoveryGoalManagement.handleEditGoal : undefined,
    onGoalsUpdate,
    onTasksReload,
    backlogDevelopers: backlogManagement.backlogDevelopers,
    backlogHasMore: backlogManagement.backlogHasMore,
    backlogLoading: backlogManagement.backlogLoading,
    backlogTasks: backlogManagement.backlogTasks,
    backlogTotalCount: backlogManagement.backlogTotalCount,
    isBacklogRateLimitError: backlogManagement.isBacklogRateLimitError,
    isInitialBacklogLoad: backlogManagement.isInitialBacklogLoad,
    onLoadMore: backlogManagement.loadMoreBacklogTasks,
    onRetryBacklog: backlogManagement.refetchBacklog,
    invalidTasks,
  };

  const headerTabs = useSidebarHeaderTabs({
    allTasksCount,
    checklistDone,
    checklistTotal,
    hideBacklogTab,
    hideReleasesTab,
    hideTasksTab,
    invalidTasksCount: invalidTasks.length,
    sidebarTabsSettings,
    sprintInfo: sprintInfo ? { id: sprintInfo.id, status: sprintInfo.status, version: sprintInfo.version } : null,
  });

  return (
    <TaskSidebarContext.Provider value={contextValue}>
      <div
        ref={setNodeRef}
        className="flex flex-col h-full"
        style={{
          backgroundColor: isOver ? 'rgba(239, 246, 255, 0.6)' : undefined,
        }}
      >
        <SidebarHeader
          mainTab={mainTab}
          setMainTab={setMainTab}
          tabs={headerTabs}
        />
        <SidebarTabContent
          hideBacklogTab={hideBacklogTab}
          hideReleasesTab={hideReleasesTab}
          mainTab={mainTab}
        />
      </div>
    </TaskSidebarContext.Provider>
  );
}

