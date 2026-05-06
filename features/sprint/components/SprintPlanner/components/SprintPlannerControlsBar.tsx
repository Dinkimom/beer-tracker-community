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
import { PlannerHistoryControls } from './PlannerHistoryControls';

interface SprintPlannerControlsBarProps {
  commentsLength: number;
  commentsVisible: boolean;
  developers: Developer[];
  /** Фильтр по статусу задач (только для режима занятости) */
  occupancyStatusFilter?: StatusFilter;
  planHistory?: {
    canRedo: boolean;
    canUndo: boolean;
    redo: () => void;
    undo: () => void;
  };
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
  planHistory,
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

  const occupancyFiltersRow =
    viewMode === 'occupancy' && setOccupancyStatusFilter ? (
      <div className="-mx-4 flex flex-wrap items-center gap-2 border-t border-ds-border-subtle px-4 pt-2 sm:gap-x-3">
        <CustomSelect<StatusFilter>
          className="min-w-[11rem] max-w-[min(100%,13rem)] shrink-0 sm:min-w-[12.5rem] sm:max-w-[200px]"
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
          className="w-[min(100%,11rem)] shrink-0 sm:w-[min(100%,13rem)] lg:w-auto lg:max-w-none"
          developers={developers}
          selectedAssigneeIds={selectedAssigneeIds}
          onSelectionChange={setSelectedAssigneeIds}
        />
      </div>
    ) : null;

  return (
    <div className="flex-shrink-0 border-b border-ds-border-subtle bg-ds-surface-header px-4 py-3">
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-[min(100%,28rem)] flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 max-w-[min(100%,18rem)] shrink-0 sm:max-w-[min(100%,22rem)]">
              <SprintSelector
                className="!w-full min-w-0"
                loading={tasksLoading}
                selectedSprintId={selectedSprintId}
                sprints={sprints}
                sprintsLoading={sprintsLoading}
                onSprintChange={onSprintChange}
              />
            </div>
            <span
              aria-hidden
              className="hidden h-6 w-px shrink-0 self-center bg-ds-border-subtle sm:block"
            />
            <div className="min-w-0 flex-1 basis-[min(100%,14rem)] max-w-xl md:max-w-2xl xl:max-w-[34rem]">
              <SearchInput
                className="min-w-0 max-w-full"
                placeholder={t('sprintPlanner.controls.searchPlaceholder')}
                size="md"
                value={globalNameFilter}
                onChange={setGlobalNameFilter}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:ml-auto sm:justify-end">
            <div className="flex min-h-8 flex-wrap items-center gap-2">
              {planHistory && viewMode !== 'kanban' && (
                <PlannerHistoryControls
                  canRedo={planHistory.canRedo}
                  canUndo={planHistory.canUndo}
                  className="!border-0 !bg-transparent !p-0 !shadow-none"
                  onRedo={planHistory.redo}
                  onUndo={planHistory.undo}
                />
              )}
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
                className="w-[148px] shrink-0 md:w-[165px]"
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
                aria-label={tasksReloadButtonTitle}
                className="!h-8 gap-1.5 text-sm text-gray-600 hover:!text-gray-800 max-md:!px-2 dark:text-gray-400 dark:hover:!text-gray-200"
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
                <span className="hidden md:inline">
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
        {occupancyFiltersRow}
      </div>
    </div>
  );
});
