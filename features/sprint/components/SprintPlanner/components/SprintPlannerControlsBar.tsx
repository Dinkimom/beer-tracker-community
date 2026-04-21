'use client';

import type { BoardViewMode } from '@/hooks/useLocalStorage';
import type { Developer, StatusFilter } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { observer } from 'mobx-react-lite';

import { Button } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { Icon } from '@/components/Icon';
import { SearchInput } from '@/components/SearchInput';
import { useI18n } from '@/contexts/LanguageContext';
import { useRootStore } from '@/lib/layers';

import { SprintSelector } from '../../SprintSelector';

import { OccupancyAssigneeFilter } from './OccupancyAssigneeFilter';

interface SprintPlannerControlsBarProps {
  commentsLength: number;
  commentsVisible: boolean;
  developers: Developer[];
  /** Фильтр по статусу задач (только для режима занятости) */
  occupancyStatusFilter?: StatusFilter;
  selectedAssigneeIds: Set<string>;
  selectedSprintId: number | null;
  /** Сайдбар открыт — кнопка меню в активном состоянии */
  sidebarOpen?: boolean;
  sprints: SprintListItem[];
  sprintsLoading?: boolean;
  tasksLoading: boolean;
  /** Идёт перезагрузка по кнопке «Обновить задачи» */
  tasksReloading?: boolean;
  viewMode: BoardViewMode;
  /** Переключить сайдбар открыт/закрыт (кнопка с иконкой меню) */
  onOpenSidebar?: () => void;
  onSprintChange: (sprintId: number | null) => void;
  /** Внешний обработчик перезагрузки задач из трекера/БД (showToast — показывать тост только при явном нажатии кнопки) */
  onTasksReload?: (options?: { showToast?: boolean }) => void;
  setCommentsVisible: (visible: boolean) => void;
  setOccupancyStatusFilter?: (value: StatusFilter) => void;
  setSelectedAssigneeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setViewMode: (value: BoardViewMode | ((prev: BoardViewMode) => BoardViewMode)) => void;
}

/**
 * Панель контролов спринт-планнера: спринт, поиск, фильтр исполнителей, комментарии, режим отображения.
 */
export const SprintPlannerControlsBar = observer(function SprintPlannerControlsBar({
  commentsLength,
  commentsVisible,
  developers,
  occupancyStatusFilter = 'all',
  selectedAssigneeIds,
  selectedSprintId,
  setOccupancyStatusFilter,
  setCommentsVisible,
  setSelectedAssigneeIds,
  setViewMode,
  sidebarOpen = false,
  sprints,
  sprintsLoading = false,
  tasksLoading,
  tasksReloading = false,
  viewMode,
  onOpenSidebar,
  onSprintChange,
  onTasksReload,
}: SprintPlannerControlsBarProps) {
  const { t } = useI18n();
  const { sprintPlannerUi } = useRootStore();
  const globalNameFilter = sprintPlannerUi.globalNameFilter;
  const setGlobalNameFilter = sprintPlannerUi.setGlobalNameFilter;
  const isReloading = tasksLoading || tasksReloading;

  let viewModeSelectValue: 'kanban' | 'occupancy' | 'swimlanes' = 'swimlanes';
  if (viewMode === 'occupancy') {
    viewModeSelectValue = 'occupancy';
  } else if (viewMode === 'kanban') {
    viewModeSelectValue = 'kanban';
  }

  let tasksReloadButtonTitle: string;
  if (isReloading) {
    tasksReloadButtonTitle = t('sprintPlanner.controls.reloadInProgress');
  } else if (selectedSprintId) {
    tasksReloadButtonTitle = t('sprintPlanner.controls.reloadFromTracker');
  } else {
    tasksReloadButtonTitle = t('sprintPlanner.controls.selectSprintFirst');
  }

  return (
    <div className="flex-shrink-0 border-b border-ds-border-subtle bg-ds-surface-header px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center shrink-0">
            <SprintSelector
              loading={tasksLoading}
              selectedSprintId={selectedSprintId}
              sprints={sprints}
              sprintsLoading={sprintsLoading}
              onSprintChange={onSprintChange}
            />
          </div>
          <span
            aria-hidden
            className="mx-1 h-6 w-px shrink-0 self-center bg-ds-border-subtle"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SearchInput
              className="min-w-0 max-w-md flex-1"
              placeholder={t('sprintPlanner.controls.searchPlaceholder')}
              size="md"
              value={globalNameFilter}
              onChange={setGlobalNameFilter}
            />
            {viewMode === 'occupancy' && setOccupancyStatusFilter && (
              <>
                <CustomSelect<StatusFilter>
                  className="w-[200px] shrink-0"
                  options={[
                    { label: t('sprintPlanner.controls.statusAll'), value: 'all' },
                    { label: t('sprintPlanner.controls.statusActive'), value: 'active' },
                    { label: t('sprintPlanner.controls.statusCompleted'), value: 'completed' },
                  ]}
                  selectedPrefix={t('sprintPlanner.controls.taskStatusPrefix')}
                  size="compact"
                  title={t('sprintPlanner.controls.statusFilterTitle')}
                  value={occupancyStatusFilter}
                  onChange={setOccupancyStatusFilter}
                />
                <OccupancyAssigneeFilter
                  developers={developers}
                  selectedAssigneeIds={selectedAssigneeIds}
                  onSelectionChange={setSelectedAssigneeIds}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 h-8">
          <div className="flex items-center gap-2 h-full">
            {viewMode === 'occupancy' && (
              <Button
                className={`!h-8 gap-1.5 !px-2.5 text-sm font-medium ${
                  commentsVisible
                    ? '!border-blue-500/50 !bg-blue-50 !text-blue-700 hover:!bg-blue-100 dark:!border-blue-500/40 dark:!bg-blue-950/50 dark:!text-blue-200 dark:hover:!bg-blue-900/40'
                    : 'text-gray-600 hover:!bg-gray-50 hover:!text-gray-900 dark:text-gray-400 dark:hover:!bg-gray-700/40 dark:hover:!text-gray-100'
                }`}
                title={
                  commentsVisible
                    ? t('sprintPlanner.controls.commentsHide')
                    : t('sprintPlanner.controls.commentsShow')
                }
                type="button"
                variant="outline"
                onClick={() => setCommentsVisible(!commentsVisible)}
              >
                <Icon className="h-4 w-4 shrink-0" name="comment" />
                {commentsLength > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      commentsVisible
                        ? 'bg-blue-200/90 text-blue-900 dark:bg-blue-800/80 dark:text-blue-100'
                        : 'bg-gray-400 text-white'
                    }`}
                  >
                    {commentsLength}
                  </span>
                )}
              </Button>
            )}
            <CustomSelect<'kanban' | 'occupancy' | 'swimlanes'>
              className="w-[165px]"
              options={[
                { label: t('sprintPlanner.controls.viewByTasks'), value: 'occupancy' },
                { label: t('sprintPlanner.controls.viewByAssignees'), value: 'swimlanes' },
                { label: t('sprintPlanner.controls.viewKanban'), value: 'kanban' },
              ]}
              size="compact"
              title={t('sprintPlanner.controls.viewModeTitle')}
              value={viewModeSelectValue}
              onChange={(v) => {
                if (v === 'occupancy') setViewMode('occupancy');
                else if (v === 'kanban') setViewMode('kanban');
                else setViewMode((prev: BoardViewMode) => (prev === 'full' || prev === 'compact' ? prev : 'full'));
              }}
            />
            <Button
              aria-busy={isReloading || undefined}
              className="!h-8 gap-1.5 !px-2.5 text-sm text-gray-600 hover:!text-gray-800 dark:text-gray-400 dark:hover:!text-gray-200"
              disabled={!onTasksReload || !selectedSprintId || isReloading}
              title={tasksReloadButtonTitle}
              type="button"
              variant="outline"
              onClick={() => onTasksReload?.({ showToast: true })}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${isReloading ? 'animate-spin' : ''}`}
                name="refresh"
              />
              <span>
                {isReloading
                  ? t('sprintPlanner.controls.refreshing')
                  : t('sprintPlanner.controls.refreshTasks')}
              </span>
            </Button>
            {onOpenSidebar && (
              <Button
                aria-label={t('sprintPlanner.controls.sidebarToggle')}
                className={`!h-8 !w-8 !min-w-0 shrink-0 !justify-center !px-0 ${
                  sidebarOpen
                    ? '!border-blue-500/50 !bg-blue-50 !text-blue-700 hover:!bg-blue-100 dark:!border-blue-500/40 dark:!bg-blue-950/50 dark:!text-blue-200 dark:hover:!bg-blue-900/40'
                    : 'text-gray-600 hover:!bg-gray-50 hover:!text-gray-900 dark:text-gray-400 dark:hover:!bg-gray-700/40 dark:hover:!text-gray-100'
                }`}
                title={t('sprintPlanner.controls.sidebarToggle')}
                type="button"
                variant="outline"
                onClick={onOpenSidebar}
              >
                <Icon className="h-4 w-4" name="menu" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
