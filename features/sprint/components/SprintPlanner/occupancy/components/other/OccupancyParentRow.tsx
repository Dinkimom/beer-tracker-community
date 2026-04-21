'use client';

import type { TaskPosition } from '@/types';

import { useCallback, useMemo } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { useI18n } from '@/contexts/LanguageContext';
import { TASK_GROUP_KEY_NO_PARENT } from '@/features/task/constants/taskGroupKeys';
import { StatusTag } from '@/components/StatusTag';
import { PARTS_PER_DAY } from '@/constants';
import { isNameInSprintGoals } from '@/features/sprint/utils/goalNamesFromChecklist';
import { getDayDate } from '@/features/sprint/utils/occupancyUtils';
import { getTaskCardStyles } from '@/features/task/components/TaskCard/components/TaskCardBody';
import { getTeamTagClasses } from '@/utils/teamColors';

import { OccupancyPhaseBar } from '../task-row/plan/OccupancyPhaseBar';
import { PHASE_BAR_HEIGHT_COMPACT_PX } from '../task-row/plan/occupancyPhaseBarConstants';

const OCCUPANCY_DAY_ROW_HEIGHT = 40;
/** Вертикальное выравнивание полосы фазы в строке стори (высота строки 40px, полоса 26px) */
const PARENT_ROW_PHASE_BAR_TOP_OFFSET_PX = (OCCUPANCY_DAY_ROW_HEIGHT - PHASE_BAR_HEIGHT_COMPACT_PX) / 2;
const DAYS_PER_WEEK = 5;

interface OccupancyParentRowProps {
  /** 1 = одна ячейка на день (квартальный план) */
  cellsPerDay?: 1 | 3;
  /** Количество колонок таймлайна (по умолчанию 10 — один спринт) */
  colSpan?: number;
  /** В компактном режиме — колонки по неделям */
  displayAsWeeks?: boolean;
  dragHandle: { attributes: object; listeners: object | undefined } | null;
  goalStoryEpicNames: Set<string>;
  isCollapsed: boolean;
  /** Тип родительской задачи (epic, story и т.д.) для иконки */
  issueType?: string;
  /** Плановая фаза (сроки) для отображения полосы в строке эпика/стори */
  planPosition?: TaskPosition;
  /** Режим фаз квартального плана (синяя полоса) */
  quarterlyPhaseStyle?: boolean;
  /** По плану фаза заканчивается в этом спринте — показывать последний день как сегмент «релиз» */
  releaseInSprint?: boolean;
  row: { id: string; display: string; key?: string };
  /** Дата начала спринта для вывода сроков фазы (ДД.ММ - ДД.ММ) */
  sprintStartDate?: Date;
  status?: string;
  taskColumnWidth: number;
  totalParts?: number;
  /** Клик по кнопке создания задачи в рамках этой стори (если row.key задан) */
  onCreateTaskForParent?: (row: { id: string; display: string; key?: string }) => void;
  onToggle: (parentId: string) => void;
}

function OccupancyParentRow({
  cellsPerDay = 3,
  colSpan = 10,
  displayAsWeeks = false,
  dragHandle,
  goalStoryEpicNames,
  isCollapsed,
  issueType,
  planPosition,
  quarterlyPhaseStyle: _quarterlyPhaseStyle = false,
  releaseInSprint = false,
  row,
  sprintStartDate,
  status,
  taskColumnWidth,
  totalParts = 30,
  onToggle,
  onCreateTaskForParent,
}: OccupancyParentRowProps) {
  const { t } = useI18n();
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const phaseDateRangeLabel = useMemo(() => {
    if (!planPosition || !sprintStartDate || planPosition.duration < PARTS_PER_DAY) return undefined;
    const workingDays = totalParts / PARTS_PER_DAY;
    const startDayIndex = Math.floor(planPosition.startDay);
    const endDayIndex = Math.min(
      workingDays - 1,
      Math.floor(planPosition.startDay + (planPosition.duration - 1) / PARTS_PER_DAY)
    );
    if (startDayIndex > endDayIndex) return undefined;
    const formatDDMM = (d: Date) =>
      `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const startDate = getDayDate(sprintStartDate, startDayIndex, colSpan);
    const endDate = getDayDate(sprintStartDate, endDayIndex, colSpan);
    return t('sprintPlanner.occupancy.phaseDateRange', {
      start: formatDDMM(startDate),
      end: formatDDMM(endDate),
    });
  }, [planPosition, sprintStartDate, totalParts, colSpan, t]);

  const toWeekPosition = useCallback(
    (pos: TaskPosition): TaskPosition => {
      if (!displayAsWeeks) return pos;
      const durationInDays = cellsPerDay === 1 ? pos.duration : pos.duration / PARTS_PER_DAY;
      return {
        ...pos,
        startDay: Math.floor(pos.startDay / DAYS_PER_WEEK),
        startPart: 0,
        duration: Math.max(1, Math.ceil(durationInDays / DAYS_PER_WEEK)),
      };
    },
    [displayAsWeeks, cellsPerDay]
  );
  const syntheticTask = useMemo(
    () =>
      ({
        id: row.key ?? row.id,
        name: row.display,
        link: '#',
        team: 'Back' as const,
      }),
    [row.key, row.id, row.display]
  );
  const cardStyles = useMemo(
    () => getTaskCardStyles(syntheticTask, 'swimlane', phaseCardColorScheme),
    [syntheticTask, phaseCardColorScheme]
  );
  const displayLabel =
    row.display === TASK_GROUP_KEY_NO_PARENT ? t('task.grouping.noParent') : row.display;
  const isInGoals = isNameInSprintGoals(row.display, goalStoryEpicNames);

  /** Разбивка фазы на основную часть и последний день (сегмент «релиз»). Релиз показываем только если по плану фаза заканчивается в этом спринте. */
  const { mainPhase, releasePhase } = useMemo(() => {
    if (!planPosition || planPosition.duration < PARTS_PER_DAY) {
      return { mainPhase: null, releasePhase: null };
    }
    if (!releaseInSprint) {
      return { mainPhase: planPosition, releasePhase: null };
    }
    const mainDuration = planPosition.duration - PARTS_PER_DAY;
    if (mainDuration <= 0) {
      return { mainPhase: null, releasePhase: planPosition };
    }
    const mainPhase: TaskPosition = {
      ...planPosition,
      duration: mainDuration,
    };
    const releasePhase: TaskPosition = {
      ...planPosition,
      startDay: planPosition.startDay + mainDuration / PARTS_PER_DAY,
      startPart: 0,
      duration: PARTS_PER_DAY,
    };
    return { mainPhase, releasePhase };
  }, [planPosition, releaseInSprint]);

  return (
    <>
      <td
        className="sticky left-0 z-[11] bg-violet-50 dark:bg-slate-700 p-0 align-middle relative overflow-hidden"
        style={{
          width: taskColumnWidth,
          minWidth: taskColumnWidth,
          height: 40,
          maxHeight: 40,
          boxSizing: 'border-box',
        }}
      >
        <div
          className="absolute left-0 top-0 right-0 h-px bg-gray-200 dark:bg-slate-600 pointer-events-none"
          style={{ zIndex: 61 }}
        />
        <div
          className="absolute left-0 bottom-0 right-0 h-px bg-gray-200 dark:bg-slate-600 pointer-events-none"
          style={{ zIndex: 12 }}
        />
        <div className="flex items-center w-full h-10 max-h-10 min-h-10">
          {dragHandle && (
            <div
              {...dragHandle.attributes}
              {...dragHandle.listeners}
              className="cursor-grab active:cursor-grabbing flex-shrink-0 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              title={t('sprintPlanner.occupancy.dragToReorder')}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon
                className="w-4 h-4 text-gray-400 dark:text-gray-500"
                name="grip-vertical"
              />
            </div>
          )}
          <Button
            aria-expanded={!isCollapsed}
            className="h-full min-h-10 min-w-0 flex-1 !justify-start !gap-2 !rounded-none !border-0 !bg-violet-50 !px-3 text-left shadow-none hover:!bg-violet-100/80 dark:!bg-slate-700/95 dark:hover:!bg-slate-600/95"
            type="button"
            variant="ghost"
            onClick={() => onToggle(row.id)}
          >
            <Icon
              className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0"
              name={isCollapsed ? 'chevron-right' : 'chevron-down'}
            />
            {isInGoals && (
              <span className="mr-0.5 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap border bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700">
                {t('sprintPlanner.occupancy.sprintGoalBadge')}
              </span>
            )}
            <StatusTag className="mr-1" status={status} />
            {issueType ? (
              <IssueTypeIcon className="w-4 h-4 shrink-0" type={issueType} />
            ) : null}
            {row.key ? (
              <a
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                href={`https://tracker.yandex.ru/${row.key}`}
                rel="noopener noreferrer"
                target="_blank"
                title={t('sprintPlanner.occupancy.openInTracker', { key: row.key })}
                onClick={(e) => e.stopPropagation()}
              >
                {row.key}
              </a>
            ) : null}
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate min-w-0 whitespace-nowrap">
              {displayLabel}
            </span>
          </Button>
          {onCreateTaskForParent && row.key && (
            <Button
              className="mr-2 !min-h-0 !p-1.5 text-xs font-medium text-blue-600 shadow-none hover:!bg-blue-50 dark:text-blue-300 dark:hover:!bg-blue-900/40"
              title={t('sprintPlanner.occupancy.createTaskInStory')}
              type="button"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCreateTaskForParent(row);
              }}
            >
              <Icon className="h-4 w-4" name="plus" />
            </Button>
          )}
        </div>
      </td>
      <td
        className="sticky z-10 bg-violet-50 dark:bg-slate-700 p-0 align-middle relative overflow-hidden"
        colSpan={colSpan}
        style={{
          height: 40,
          maxHeight: 40,
          boxSizing: 'border-box',
          top: OCCUPANCY_DAY_ROW_HEIGHT,
        }}
      >
        <div
          className="absolute left-0 right-0 top-0 h-px bg-gray-200 dark:bg-slate-600 pointer-events-none"
          style={{ zIndex: 61 }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 h-px bg-gray-200 dark:bg-slate-600 pointer-events-none"
          style={{ zIndex: 11 }}
        />
        {(mainPhase || releasePhase || planPosition) && (
          <div className="absolute inset-0 flex items-center justify-center px-0.5">
            {mainPhase && (
              <OccupancyPhaseBar
                badgeClass={getTeamTagClasses('Back')}
                barHeight={PHASE_BAR_HEIGHT_COMPACT_PX}
                barTopOffset={PARENT_ROW_PHASE_BAR_TOP_OFFSET_PX}
                cellsPerDay={cellsPerDay}
                disableDragAndResize
                forceDevColor
                hideExtraDuration
                initials=""
                isQa={false}
                phaseDateRangeLabel={phaseDateRangeLabel}
                position={displayAsWeeks ? toWeekPosition(mainPhase) : mainPhase}
                readonly
                showToolsEmoji
                task={syntheticTask}
                taskId={syntheticTask.id}
                teamBorder={cardStyles.teamBorder}
                teamColor={cardStyles.teamColor}
                totalParts={totalParts}
              />
            )}
            {releasePhase && (
              <OccupancyPhaseBar
                badgeClass={getTeamTagClasses('Back')}
                barHeight={PHASE_BAR_HEIGHT_COMPACT_PX}
                barTopOffset={PARENT_ROW_PHASE_BAR_TOP_OFFSET_PX}
                cellsPerDay={cellsPerDay}
                disableDragAndResize
                forceReleaseStyle
                hideExtraDuration
                initials=""
                isQa={false}
                position={displayAsWeeks ? toWeekPosition(releasePhase) : releasePhase}
                readonly
                task={syntheticTask}
                taskId={`${syntheticTask.id}-release`}
                teamBorder={cardStyles.teamBorder}
                teamColor={cardStyles.teamColor}
                totalParts={totalParts}
              />
            )}
            {!mainPhase && !releasePhase && planPosition && (
              <OccupancyPhaseBar
                badgeClass={getTeamTagClasses('Back')}
                barHeight={PHASE_BAR_HEIGHT_COMPACT_PX}
                barTopOffset={PARENT_ROW_PHASE_BAR_TOP_OFFSET_PX}
                cellsPerDay={cellsPerDay}
                disableDragAndResize
                forceDevColor
                hideExtraDuration
                initials=""
                isQa={false}
                phaseDateRangeLabel={phaseDateRangeLabel}
                position={displayAsWeeks ? toWeekPosition(planPosition) : planPosition}
                readonly
                showToolsEmoji
                task={syntheticTask}
                taskId={syntheticTask.id}
                teamBorder={cardStyles.teamBorder}
                teamColor={cardStyles.teamColor}
                totalParts={totalParts}
              />
            )}
          </div>
        )}
      </td>
    </>
  );
}

export { OccupancyParentRow };
