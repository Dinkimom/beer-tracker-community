'use client';

import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';

import { TasksTabActions } from './TasksTab/components/TasksTabActions';
import { TasksTabFilters } from './TasksTab/components/TasksTabFilters';
import { TasksTabGroups } from './TasksTab/components/TasksTabGroups';

export function TasksTab() {
  const {
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
    activeTaskId,
    activeTaskDuration,
    viewMode,
    width: sidebarWidth,
    selectedSprintId,
    contextMenuBlurOtherCards,
    contextMenuTaskId,
    onContextMenu,
    onReturnAllTasks,
    onAutoAddToSwimlane,
    onAutoAssignTasks,
  } = useTaskSidebar();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <TasksTabFilters
        activeTab={activeTab}
        allTasksCount={allTasksCount}
        devTasksCount={devTasksCount}
        groupBy={groupBy}
        nameFilter={nameFilter}
        qaTasksCount={qaTasksCount}
        setActiveTab={setActiveTab}
        setGroupBy={setGroupBy}
        setNameFilter={setNameFilter}
        setStatusFilter={setStatusFilter}
        statusFilter={statusFilter}
      />

      <TasksTabGroups
        activeTaskDuration={activeTaskDuration}
        activeTaskId={activeTaskId}
        contextMenuBlurOtherCards={contextMenuBlurOtherCards}
        contextMenuTaskId={contextMenuTaskId}
        developers={developers}
        groupBy={groupBy}
        groupKeys={groupKeys}
        groupedTasks={groupedTasks}
        qaTasksMap={qaTasksMap}
        selectedSprintId={selectedSprintId}
        sidebarWidth={sidebarWidth}
        viewMode={viewMode}
        onAutoAddToSwimlane={onAutoAddToSwimlane}
        onContextMenu={onContextMenu}
      />

      <TasksTabActions
        onAutoAssignTasks={onAutoAssignTasks}
        onReturnAllTasks={onReturnAllTasks}
      />
    </div>
  );
}
