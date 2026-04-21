'use client';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';
import { DraggableTask } from '@/features/task/components/DraggableTask';

export function BacklogTab() {
  const { t } = useI18n();
  const {
    backlogLoading,
    isInitialBacklogLoad,
    groupKeys,
    groupedTasks,
    groupBy,
    backlogDevelopers,
    onContextMenu,
    activeTaskId,
    activeTaskDuration,
    viewMode,
    width: sidebarWidth,
    selectedSprintId,
    backlogTasks,
    backlogTotalCount,
    backlogHasMore,
    isBacklogRateLimitError,
    onRetryBacklog,
    onLoadMore,
    contextMenuBlurOtherCards,
    contextMenuTaskId,
  } = useTaskSidebar();

  if (isBacklogRateLimitError && onRetryBacklog) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t('sidebar.backlogTab.rateLimitMessage')}
        </p>
        <Button className="gap-2" type="button" variant="outline" onClick={onRetryBacklog}>
          <Icon className="h-4 w-4" name="refresh" />
          {t('sidebar.backlogTab.reload')}
        </Button>
      </div>
    );
  }

  if (backlogLoading && isInitialBacklogLoad) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-12 font-medium">
        {t('sidebar.backlogTab.loadingTasks')}
      </div>
    );
  }

  if (groupKeys.length === 0 || groupKeys.every(key => groupedTasks[key].length === 0)) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-12 font-medium">
        {t('sidebar.backlogTab.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Прокручиваемый список задач */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {groupKeys.map((groupKey, groupIndex) => {
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
                    developers={backlogDevelopers}
                    selectedSprintId={selectedSprintId}
                    sidebarWidth={sidebarWidth}
                    task={task}
                    viewMode={viewMode}
                    onContextMenu={onContextMenu ? (e) => onContextMenu(e, task, true) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Кнопка "Загрузить еще" и счетчик для бэклога в конце списка */}
        {backlogTotalCount > 0 && (
          <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {t('sidebar.backlogTab.loadedCount', {
              loaded: backlogTasks.length,
              total: backlogTotalCount,
            })}
          </div>
        )}
        {backlogHasMore && (
          <div className="flex justify-center mt-3">
            <Button
              className="rounded px-4 py-2 text-xs font-medium"
              disabled={backlogLoading}
              type="button"
              variant="outline"
              onClick={onLoadMore}
            >
              {backlogLoading && !isInitialBacklogLoad ? (
                <span className="flex items-center gap-2">
                  <Icon className="h-3 w-3 animate-spin" name="spinner" />
                  {t('common.loading')}
                </span>
              ) : (
                t('sidebar.backlogTab.loadMore')
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
