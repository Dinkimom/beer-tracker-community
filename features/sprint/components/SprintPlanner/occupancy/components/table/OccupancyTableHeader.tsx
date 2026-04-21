'use client';

import type { DayErrorDetail } from '@/features/sprint/utils/occupancyValidation';
import type { OccupancyTaskOrder } from '@/lib/api/types';
import type { Task } from '@/types';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SidebarResizeHandle } from '@/components/SidebarResizeHandle';
import { useI18n } from '@/contexts/LanguageContext';
import { WORKING_DAYS, WORKING_DAYS_PER_WEEK, ZIndex } from '@/constants';
import { DaysRow } from '@/features/sprint/components/DaysHeader/components/DaysRow';
import { countWorkingDaysInclusiveCalendarRange } from '@/utils/dateUtils';

export interface SprintInfo {
  endDate?: Date;
  id: number | string;
  name: string;
  startDate: Date;
}

const HEADER_ROW_HEIGHT = 40;
/** Фактическая высота строки шапки (с учётом box-shadow), для синхронного sticky top у строк эпиков */
export const OCCUPANCY_HEADER_ROW_HEIGHT_PX = HEADER_ROW_HEIGHT + 1;

export interface TimelineSettings {
  showComments: boolean;
  showFreeSlotPreview: boolean;
  showLinks: boolean;
  showReestimations: boolean;
  showStatuses: boolean;
}

const WEEKS_PER_SPRINT = 2;

interface OccupancyTableHeaderProps {
  allExpanded: boolean;
  dayColumnWidth: number | undefined;
  /** В компактном режиме — колонки по неделям (2 на спринт) */
  displayAsWeeks?: boolean;
  displayColumnCount?: number;
  errorDayDetails: Map<number, DayErrorDetail[]>;
  errorDayIndices: Set<number>;
  holidayDayIndices?: Set<number>;
  isReorderMode: boolean;
  isResizing: boolean;
  parentIds: string[];
  setIsReorderMode: React.Dispatch<React.SetStateAction<boolean>>;
  /** Не показывать эмодзи праздников в шапке (для квартального планирования) */
  showHolidayEmoji?: boolean;
  /** Для мультиспринтового режима — список спринтов; если задан, рендерится двухстрочная шапка */
  sprintInfos?: SprintInfo[];
  /** Используется в односпринтовом режиме */
  sprintStartDate: Date;
  /** Число колонок рабочих дней в шапке (длительность спринта / сумма по спринтам) */
  sprintWorkingDaysCount?: number;
  taskColumnWidth: number;
  tasks: Task[];
  /** Суммарные SP всех задач, которые имеют фазы в таймлайне (с учётом фильтров) */
  totalStoryPoints: number;
  /** Суммарные TP всех задач, которые имеют фазы в таймлайне (с учётом фильтров) */
  totalTestPoints: number;
  /** Отображать день и дату в две строки (используется в квартальном планировании v2) */
  twoLineDayHeader?: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onHoveredErrorTaskIdChange: (taskId: string | null) => void;
  onTaskOrderChange?: (order: OccupancyTaskOrder) => void;
  setIsResizing: (value: boolean) => void;
}

export function OccupancyTableHeader({
  taskColumnWidth,
  isResizing,
  setIsResizing,
  isReorderMode,
  setIsReorderMode,
  showHolidayEmoji,
  totalStoryPoints,
  totalTestPoints,
  parentIds,
  allExpanded,
  onExpandAll,
  onCollapseAll,
  onTaskOrderChange,
  dayColumnWidth,
  displayAsWeeks = false,
  displayColumnCount = 10,
  errorDayDetails,
  errorDayIndices,
  sprintStartDate,
  sprintWorkingDaysCount = WORKING_DAYS,
  sprintInfos,
  tasks,
  onHoveredErrorTaskIdChange,
  holidayDayIndices,
  twoLineDayHeader = false,
}: OccupancyTableHeaderProps) {
  const { t } = useI18n();
  const isMultiSprint = sprintInfos && sprintInfos.length > 1;

  /** Индекс спринта «в работе» (сегодня в его диапазоне) для подсветки в эпике */
  const currentSprintIndex =
    isMultiSprint && sprintInfos
      ? sprintInfos.findIndex((s) => {
          const start = new Date(s.startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(s.endDate ?? s.startDate);
          end.setHours(23, 59, 59, 999);
          const now = new Date();
          return now >= start && now <= end;
        })
      : -1;

  const taskColSingle = (
    <th
      className="relative sticky left-0 z-[11] bg-gray-100 dark:bg-gray-800 px-3 align-middle [box-shadow:inset_-1px_0_0_#e5e7eb] dark:[box-shadow:inset_-1px_0_0_#374151]"
      style={{
        width: taskColumnWidth,
        minWidth: taskColumnWidth,
        height: HEADER_ROW_HEIGHT + 1,
        minHeight: HEADER_ROW_HEIGHT + 1,
      }}
    >
      <SidebarResizeHandle
        isResizing={isResizing}
        side="right"
        title={t('sprintPlanner.occupancy.resizeTaskColumn')}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsResizing(true);
        }}
      />
      <div className="flex items-center justify-between gap-2 h-full">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate min-w-0 flex items-baseline gap-2">
          <span className="truncate">{t('sprintPlanner.occupancy.columnTitle')}</span>
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {totalStoryPoints} sp
            <span className="mx-1.5 text-gray-400 dark:text-gray-500">·</span>
            {totalTestPoints} tp
          </span>
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {onTaskOrderChange && (
            <Button
              className={`shrink-0 !min-h-0 !px-1.5 !py-1 ${
                isReorderMode
                  ? '!border-blue-300 !bg-blue-100 !text-blue-700 dark:!border-blue-700 dark:!bg-blue-900/50 dark:!text-blue-300'
                  : 'text-gray-500 hover:!text-gray-700 dark:text-gray-400 dark:hover:!text-gray-300'
              }`}
              title={
                isReorderMode
                  ? t('sprintPlanner.occupancy.finishReorder')
                  : t('sprintPlanner.occupancy.reorderTasks')
              }
              type="button"
              variant="outline"
              onClick={() => setIsReorderMode((prev) => !prev)}
            >
              <Icon className="h-4 w-4" name="grip-vertical" />
            </Button>
          )}
          {parentIds.length > 0 && (
            <Button
              className="shrink-0 !min-h-0 !px-2.5 !py-1 text-xs font-medium"
              title={
                allExpanded
                  ? t('sprintPlanner.occupancy.collapseAllGroups')
                  : t('sprintPlanner.occupancy.expandAllGroups')
              }
              type="button"
              variant="outline"
              onClick={allExpanded ? onCollapseAll : onExpandAll}
            >
              {allExpanded
                ? t('sprintPlanner.occupancy.collapseAll')
                : t('sprintPlanner.occupancy.expandAll')}
            </Button>
          )}
        </div>
      </div>
    </th>
  );

  if (isMultiSprint) {
    return (
      <thead>
        {/* Строка 1: названия спринтов */}
        {/* box-shadow вместо border-b: collapsed-border не работает со sticky в Chrome */}
        <tr
          className="sticky top-0 bg-gray-100 dark:bg-gray-800 [&>th]:overflow-hidden"
          style={{ zIndex: ZIndex.stickyMainHeader + 1 }}
        >
          <th
            className="relative sticky left-0 z-[11] bg-gray-100 dark:bg-gray-800 px-3 align-middle [box-shadow:inset_-1px_0_0_#e5e7eb,inset_0_-1px_0_#e5e7eb] dark:[box-shadow:inset_-1px_0_0_#374151,inset_0_-1px_0_#374151]"
            style={{
              width: taskColumnWidth,
              minWidth: taskColumnWidth,
              height: HEADER_ROW_HEIGHT + 1,
              minHeight: HEADER_ROW_HEIGHT + 1,
            }}
          >
            <SidebarResizeHandle
              isResizing={isResizing}
              side="right"
              title={t('sprintPlanner.occupancy.resizeTaskColumn')}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsResizing(true);
              }}
            />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-baseline gap-2">
              <span className="truncate">{t('sprintPlanner.occupancy.columnTitle')}</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {totalStoryPoints} sp
                <span className="mx-1.5 text-gray-400 dark:text-gray-500">·</span>
                {totalTestPoints} tp
              </span>
            </h3>
          </th>
          {sprintInfos.map((sprint, idx) => {
            const isCurrentSprint = currentSprintIndex === idx;
            const isPastSprint = currentSprintIndex >= 0 && idx < currentSprintIndex;
            const sprintWorkingDays =
              sprint.endDate != null
                ? Math.max(
                    1,
                    countWorkingDaysInclusiveCalendarRange(
                      new Date(sprint.startDate),
                      new Date(sprint.endDate)
                    )
                  )
                : WORKING_DAYS;
            const colSpan = displayAsWeeks ? Math.ceil(sprintWorkingDays / WORKING_DAYS_PER_WEEK) : sprintWorkingDays;
            return (
              <th
                key={sprint.id}
                className={`px-3 text-center align-middle text-xs font-semibold border-r border-gray-200 dark:border-gray-700 [box-shadow:inset_0_-1px_0_#e5e7eb] dark:[box-shadow:inset_0_-1px_0_#374151] ${
                  isCurrentSprint
                    ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-900/40 dark:to-blue-800/40 text-gray-800 dark:text-gray-200'
                    : isPastSprint
                      ? 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
                colSpan={colSpan}
                style={{ height: HEADER_ROW_HEIGHT + 1 }}
              >
                {sprint.name}
              </th>
            );
          })}
        </tr>
        {/* Строка 2: дни или недели по каждому спринту */}
        <tr
          className="sticky bg-gray-100 dark:bg-gray-800 [&>th]:overflow-hidden [&>th]:border-b [&>th]:border-gray-200 dark:[&>th]:border-gray-700"
          style={{ top: HEADER_ROW_HEIGHT + 1, zIndex: ZIndex.stickyMainHeader }}
        >
          <th
            className="relative sticky left-0 z-[11] bg-gray-100 dark:bg-gray-800 px-3 align-middle [box-shadow:inset_-1px_0_0_#e5e7eb] dark:[box-shadow:inset_-1px_0_0_#374151]"
            style={{
              width: taskColumnWidth,
              minWidth: taskColumnWidth,
              height: HEADER_ROW_HEIGHT + 1,
              minHeight: HEADER_ROW_HEIGHT + 1,
            }}
          >
            <div className="flex items-center justify-between gap-2 h-full">
              {onTaskOrderChange && (
                <Button
                  className={`shrink-0 !min-h-0 !px-1.5 !py-1 ${
                    isReorderMode
                      ? '!border-blue-300 !bg-blue-100 !text-blue-700 dark:!border-blue-700 dark:!bg-blue-900/50 dark:!text-blue-300'
                      : 'text-gray-500 hover:!text-gray-700 dark:text-gray-400 dark:hover:!text-gray-300'
                  }`}
                  title={
                    isReorderMode
                      ? t('sprintPlanner.occupancy.finishReorder')
                      : t('sprintPlanner.occupancy.reorderTasks')
                  }
                  type="button"
                  variant="outline"
                  onClick={() => setIsReorderMode((prev) => !prev)}
                >
                  <Icon className="h-4 w-4" name="grip-vertical" />
                </Button>
              )}
              {parentIds.length > 0 && (
                <Button
                  className="shrink-0 !min-h-0 !px-2.5 !py-1 text-xs font-medium"
                  title={
                    allExpanded
                      ? t('sprintPlanner.occupancy.collapseAllGroups')
                      : t('sprintPlanner.occupancy.expandAllGroups')
                  }
                  type="button"
                  variant="outline"
                  onClick={allExpanded ? onCollapseAll : onExpandAll}
                >
                  {allExpanded
                    ? t('sprintPlanner.occupancy.collapseAll')
                    : t('sprintPlanner.occupancy.expandAll')}
                </Button>
              )}
            </div>
          </th>
          {displayAsWeeks
            ? Array.from({ length: displayColumnCount }, (_, weekIndex) => (
                <th
                  key={weekIndex}
                  className="px-2 text-center align-middle text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  style={{
                    width: dayColumnWidth ?? '10%',
                    minWidth: dayColumnWidth,
                    height: HEADER_ROW_HEIGHT + 1,
                    minHeight: HEADER_ROW_HEIGHT + 1,
                  }}
                >
                  {t('sprintPlanner.occupancy.weekLabel', {
                    n: weekIndex % WEEKS_PER_SPRINT + 1,
                  })}
                </th>
              ))
            : sprintInfos.map((sprint) => {
                const sprintWd =
                  sprint.endDate != null
                    ? Math.max(
                        1,
                        countWorkingDaysInclusiveCalendarRange(
                          new Date(sprint.startDate),
                          new Date(sprint.endDate)
                        )
                      )
                    : WORKING_DAYS;
                return (
                  <DaysRow
                    key={sprint.id}
                    dayColumnWidth={dayColumnWidth}
                    multilineHeader={twoLineDayHeader}
                    rowHeight={HEADER_ROW_HEIGHT + 1}
                    showHolidayEmoji={showHolidayEmoji}
                    sprintStartDate={sprint.startDate}
                    variant="occupancy"
                    workingDaysCount={sprintWd}
                  />
                );
              })}
        </tr>
      </thead>
    );
  }

  return (
    <thead>
      {/* box-shadow вместо border-b: при скролле border даёт двойную линию со sticky */}
      <tr
        className="sticky top-0 bg-gray-100 dark:bg-gray-800 [&>th]:overflow-hidden [box-shadow:0_1px_0_0_#e5e7eb] dark:[box-shadow:0_1px_0_0_#374151]"
        style={{ zIndex: ZIndex.stickyMainHeader }}
      >
        {taskColSingle}
        {displayAsWeeks
          ? Array.from({ length: displayColumnCount }, (_, weekIndex) => (
              <th
                key={weekIndex}
                className="px-2 text-center align-middle text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                style={{
                  width: dayColumnWidth ?? '10%',
                  minWidth: dayColumnWidth,
                  height: 41,
                  minHeight: 41,
                }}
              >
                {t('sprintPlanner.occupancy.weekLabel', { n: weekIndex + 1 })}
              </th>
            ))
          : (
            <DaysRow
              dayColumnWidth={dayColumnWidth}
              errorDayDetails={errorDayDetails}
              errorDayIndices={errorDayIndices}
              holidayDayIndices={holidayDayIndices}
              multilineHeader={twoLineDayHeader}
              rowHeight={41}
              showHolidayEmoji={showHolidayEmoji}
              sprintStartDate={sprintStartDate}
              tasks={tasks}
              variant="occupancy"
              workingDaysCount={sprintWorkingDaysCount}
              onHoveredErrorTaskIdChange={onHoveredErrorTaskIdChange}
            />
          )}
      </tr>
    </thead>
  );
}
