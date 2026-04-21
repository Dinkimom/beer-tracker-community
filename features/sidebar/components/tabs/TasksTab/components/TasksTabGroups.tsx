/**
 * Компонент списка задач с группировкой для TasksTab
 */

import type { Developer, LayoutViewMode, SidebarGroupBy, Task } from '@/types';

import { useI18n } from '@/contexts/LanguageContext';
import { DraggableTask } from '@/features/task/components/DraggableTask';

interface TasksTabGroupsProps {
  activeTaskDuration?: number | null;
  activeTaskId?: string | null;
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  developers: Developer[];
  groupBy: SidebarGroupBy;
  groupedTasks: Record<string, Task[]>;
  groupKeys: string[];
  qaTasksMap: Map<string, Task>;
  selectedSprintId?: number | null;
  sidebarWidth?: number;
  viewMode?: LayoutViewMode;
  onAutoAddToSwimlane?: (task: Task) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task, isBacklogTask?: boolean) => void;
}

export function TasksTabGroups({
  groupKeys,
  groupedTasks,
  groupBy,
  developers,
  onContextMenu,
  qaTasksMap,
  activeTaskId,
  activeTaskDuration,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  viewMode,
  sidebarWidth,
  selectedSprintId,
  onAutoAddToSwimlane,
}: TasksTabGroupsProps) {
  const { t } = useI18n();
  const hasTasks = groupKeys.some((key) => (groupedTasks[key]?.length ?? 0) > 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 overscroll-contain">
      {!hasTasks ? (
        <div className="flex min-h-full items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sidebar.tasksTabGroups.allTasksPlanned')}
          </p>
        </div>
      ) : (
      groupKeys.map((groupKey, groupIndex) => {
        const tasksInGroup = groupedTasks[groupKey];
        if (tasksInGroup.length === 0) return null;

        const isLastGroup = groupIndex === groupKeys.length - 1;

        return (
          <div key={groupKey} className={groupBy !== 'none' && !isLastGroup ? 'mb-4 pb-4' : groupBy !== 'none' ? 'mb-4' : ''}>
            {groupBy !== 'none' && (
              <div className="mb-3">
                <h3 className="w-full text-center text-xs font-semibold text-gray-800 dark:text-gray-200 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-md">
                  {groupKey}
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-blue-600 rounded-full">
                    {tasksInGroup.length}
                  </span>
                </h3>
              </div>
            )}
            <div className="space-y-2.5">
              {tasksInGroup.map((task) => (
                <DraggableTask
                  key={task.id}
                  activeTaskDuration={activeTaskDuration}
                  activeTaskId={activeTaskId}
                  contextMenuBlurOtherCards={contextMenuBlurOtherCards}
                  contextMenuTaskId={contextMenuTaskId}
                  developers={developers}
                  qaTasksMap={qaTasksMap}
                  selectedSprintId={selectedSprintId}
                  sidebarWidth={sidebarWidth}
                  task={task}
                  viewMode={viewMode}
                  onAutoAddToSwimlane={onAutoAddToSwimlane}
                  onContextMenu={onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, task, false) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })
      )}
    </div>
  );
}

