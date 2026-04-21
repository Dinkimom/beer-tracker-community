'use client';

import type { BurndownDayChangelogItem } from '../hooks/useBurndownChartData';
import type { BurndownChartDataPoint } from './BurndownAreaChart';
import type { GetTaskInfoFn } from '@/hooks/useApiStorage';
import type { Task, TaskPosition } from '@/types';
import type { SprintListItem } from '@/types/tracker';
import type { TooltipProps } from 'recharts';

import { useQuery } from '@tanstack/react-query';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { computeBurndownTilesFromOccupancyRows } from '@/features/sprint/components/SprintPlanner/occupancy/occupancyViewHelpers';
import { buildFlattenedRows } from '@/features/sprint/components/SprintPlanner/occupancy/utils/buildFlattenedRows';
import { SprintSelector } from '@/features/sprint/components/SprintSelector';
import { useTaskState } from '@/features/sprint/hooks/useTaskState';
import { computeBurndownTilesFromTasks } from '@/features/sprint/utils/sprintMetrics';
import { useOccupancyTaskOrderApi, useTaskPositionsApi } from '@/hooks/useApiStorage';
import { useThemeStorage } from '@/hooks/useLocalStorage';
import { fetchBurndownData } from '@/lib/beerTrackerApi';
import { useRootStore } from '@/lib/layers';

import { useBurndownChartData } from '../hooks/useBurndownChartData';
import { useBurndownMetrics } from '../hooks/useBurndownMetrics';

import { BurndownAreaChart } from './BurndownAreaChart';

interface BurndownChartProps {
  boardId?: number;
  /** Идентификаторы целей спринта (как в `MetricsTab`), чтобы исключить их из плиток. */
  goalTaskIdsForTiles?: string[];
  sprintId: number | null;
  sprints: SprintListItem[];
  sprintsLoading?: boolean;
  /** После загрузки задач — плитки «X / Y» и % по объёму «Занятость» (строки с фазой на таймлайне); до загрузки позиций — как сумма по задачам; `undefined` = плитки из changelog. */
  sprintTasksForTiles?: Task[];
  onSprintChange: (sprintId: number | null) => void;
}

const MAX_SUMMARY_LENGTH = 80;

type MetricType = 'SP' | 'TP';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

// Кастомный tooltip: дата, факт/план по выбранной метрике (SP или TP), ченжлог дня по SP
function CustomTooltip({
  active,
  payload,
  theme,
  metricType = 'SP',
  t,
  locale,
  changelogTypeLabels,
}: TooltipProps<number, string> & {
  theme: 'dark' | 'light';
  metricType?: MetricType;
  t: TranslateFn;
  locale: string;
  changelogTypeLabels: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload as {
    date?: string;
    fullDate?: string;
    dayChangelog?: BurndownDayChangelogItem[];
    remainingSP?: number;
    idealSP?: number;
    remainingTP?: number;
    idealTP?: number;
  } | undefined;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';

  const dateLabel = point?.fullDate
    ? new Date(point.fullDate).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    : '';

  const isTP = metricType === 'TP';
  const factValue = isTP ? point?.remainingTP : point?.remainingSP;
  const planValue = isTP ? point?.idealTP : point?.idealSP;
  const factColor = isTP ? '#f59e0b' : '#3b82f6';
  const metricLabel = isTP ? 'TP' : 'SP';

  const rawChangelog = Array.isArray(point?.dayChangelog) ? point.dayChangelog : [];
  const dayChangelog = rawChangelog.filter((item: BurndownDayChangelogItem) => {
    if (item.type === 'status_change' || item.type === 'sprint_field_change') return true;
    if (item.type === 'added' || item.type === 'removed') return true;
    if (item.type === 'closed') return true;
    if (item.type === 'story_points_change') return !isTP;
    if (item.type === 'test_points_change') return isTP;
    if (item.type === 'reestimated') return (isTP ? item.changeTP : item.change) !== 0;
    const changeVal = isTP ? item.changeTP : item.change;
    return changeVal !== 0;
  });
  const showChangelogSection = factValue !== undefined;
  const hasChangelogItems = dayChangelog.length > 0;

  const TOOLTIP_CHANGELOG_MAX_HEIGHT = 220;
  const changeHeader = t('burndown.changelog.changeColumn');
  const remainingHeader = t('burndown.changelog.remainingColumn');
  const dash = '—';

  return (
    <div
      className="cursor-default"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '10px 12px',
        color: textColor,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        maxWidth: 420,
      }}
    >
      {/* Фиксированная шапка: дата и факт/план */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
        {dateLabel}
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: showChangelogSection ? 10 : 0, fontSize: 12, color: mutedColor }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, backgroundColor: factColor, borderRadius: 1 }} />
          {t('burndown.changelog.factLine', {
            value: typeof factValue === 'number' ? factValue.toFixed(1) : dash,
            metric: metricLabel,
          })}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, border: '1px dashed #94a3b8', borderRadius: 1 }} />
          {t('burndown.changelog.planLine', {
            value: typeof planValue === 'number' ? planValue.toFixed(1) : dash,
            metric: metricLabel,
          })}
        </span>
      </div>
      {showChangelogSection &&
        (hasChangelogItems ? (
            <div
              style={{
                maxHeight: TOOLTIP_CHANGELOG_MAX_HEIGHT,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: 10,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 500, position: 'sticky', top: 0, backgroundColor: bgColor, zIndex: 1 }} />
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500, position: 'sticky', top: 0, backgroundColor: bgColor, zIndex: 1, whiteSpace: 'nowrap' }}>
                      {changeHeader}
                    </th>
                    <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500, position: 'sticky', top: 0, backgroundColor: bgColor, zIndex: 1, whiteSpace: 'nowrap' }}>
                      {remainingHeader}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayChangelog.map((item: BurndownDayChangelogItem, rowIdx: number) => {
                    const summary = item.summary.length > MAX_SUMMARY_LENGTH
                      ? `${item.summary.slice(0, MAX_SUMMARY_LENGTH)}…`
                      : item.summary;
                    const changeVal = isTP ? item.changeTP : item.change;
                    const typeLabel = changelogTypeLabels[item.type] ?? item.type;
                    let changeStr: string;
                    let changeColor: string;
                    if (item.type === 'status_change') {
                      const f = item.statusFromKey ?? dash;
                      const to = item.statusToKey ?? dash;
                      changeStr = `${f} → ${to}`;
                      changeColor = mutedColor;
                    } else if (
                      item.type === 'sprint_field_change' ||
                      (item.type === 'story_points_change' && isTP) ||
                      (item.type === 'test_points_change' && !isTP)
                    ) {
                      changeStr = dash;
                      changeColor = mutedColor;
                    } else {
                      changeStr = changeVal >= 0 ? `+${changeVal}` : String(changeVal);
                      changeColor = changeVal > 0 ? '#dc2626' : '#16a34a';
                    }
                    const remainingVal = isTP ? item.remainingTP : item.remainingSP;
                    return (
                      <tr key={`${item.issueKey}-${item.type}-${rowIdx}-${changeStr}-${remainingVal}`} style={{ borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}` }}>
                        <td style={{ padding: '6px 8px 6px 0', verticalAlign: 'top', minWidth: 0 }} title={item.summary}>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 10,
                              color: mutedColor,
                              backgroundColor: isDark ? '#374151' : '#e5e7eb',
                              padding: '2px 6px',
                              borderRadius: 4,
                              marginBottom: 4,
                            }}
                          >
                            {typeLabel}
                          </span>
                          <div style={{ marginTop: 2 }}>{summary}</div>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'bottom', color: changeColor, fontWeight: 600 }}>
                          {changeStr}
                        </td>
                        <td style={{ padding: '6px 0', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                          {remainingVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: mutedColor, paddingTop: 4 }}>
              {t('burndown.changelog.noChanges')}
            </div>
          ))}
    </div>
  );
}

export const BurndownChart = observer(function BurndownChart({
  boardId,
  sprintTasksForTiles,
  goalTaskIdsForTiles,
  sprintId,
  sprints,
  sprintsLoading = false,
  onSprintChange,
}: BurndownChartProps) {
  const { t, language } = useI18n();
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const changelogTypeLabels = useMemo(
    () => ({
      closed: t('burndown.changelog.types.closed'),
      added: t('burndown.changelog.types.added'),
      removed: t('burndown.changelog.types.removed'),
      reestimated: t('burndown.changelog.types.reestimated'),
      status_change: t('burndown.changelog.types.status_change'),
      story_points_change: t('burndown.changelog.types.story_points_change'),
      test_points_change: t('burndown.changelog.types.test_points_change'),
      sprint_field_change: t('burndown.changelog.types.sprint_field_change'),
    }),
    [t]
  );

  const isDemoPlannerBoards = useDemoPlannerBoardsQueryScope();
  const [theme] = useThemeStorage();
  const [pinnedPoint, setPinnedPoint] = useState<BurndownChartDataPoint | null>(null);
  const [pinnedMetricType, setPinnedMetricType] = useState<'SP' | 'TP'>('SP');
  const [pinnedPosition, setPinnedPosition] = useState<{ x: number; y: number } | null>(null);

  // Определяем статус выбранного спринта (до других хуков)
  const selectedSprint = useMemo(() => {
    return sprints.find((s) => s.id === sprintId);
  }, [sprints, sprintId]);

  const isDraft = selectedSprint?.status === 'draft';
  const isArchived = selectedSprint?.archived || selectedSprint?.status === 'archived';

  const {
    data: burndownData,
    isLoading,
    error,
  } = useQuery({
    queryKey: isDemoPlannerBoards
      ? (['burndown', 'demo', sprintId, boardId] as const)
      : (['burndown', sprintId, boardId] as const),
    queryFn: () =>
      sprintId ? fetchBurndownData(sprintId, boardId ?? undefined) : null,
    enabled: !!sprintId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Вычисляем данные для графика
  const chartData = useBurndownChartData({
    burndownData,
    isArchived,
    isDraft,
  });

  const { taskPositions: taskPositionsStore, sprintPlannerUi } = useRootStore();
  const globalNameFilter = sprintPlannerUi.globalNameFilter;

  const loadTilePositions = sprintTasksForTiles !== undefined && sprintId != null;
  const getTaskInfoRef = useRef<GetTaskInfoFn | undefined>(undefined);
  const [taskPositionsRaw] = useTaskPositionsApi(loadTilePositions ? sprintId : null, getTaskInfoRef);
  const [taskOrder] = useOccupancyTaskOrderApi(loadTilePositions ? sprintId : null);

  const { tasksMap, qaTasksByOriginalId } = useTaskState({
    tasks: sprintTasksForTiles ?? [],
    taskPositions: taskPositionsRaw,
    developers: [],
  });

  useEffect(() => {
    getTaskInfoRef.current = (taskId: string) => {
      const t = tasksMap.get(taskId) || qaTasksByOriginalId.get(taskId);
      return t
        ? { isQa: t.team === 'QA', devTaskKey: t.team === 'QA' ? t.originalTaskId : undefined }
        : { isQa: false };
    };
  }, [tasksMap, qaTasksByOriginalId]);

  const filteredTaskPositions = useMemo(() => {
    const m = new Map<string, TaskPosition>();
    taskPositionsRaw.forEach((pos, taskId) => {
      if (tasksMap.has(taskId) || qaTasksByOriginalId.has(taskId)) {
        m.set(taskId, pos);
      }
    });
    return m;
  }, [taskPositionsRaw, tasksMap, qaTasksByOriginalId]);

  const flattenedRowsForBurndownTiles = useMemo(
    () =>
      loadTilePositions && sprintTasksForTiles
        ? buildFlattenedRows(
            sprintTasksForTiles,
            filteredTaskPositions,
            globalNameFilter,
            undefined,
            taskOrder
          )
        : [],
    [loadTilePositions, sprintTasksForTiles, filteredTaskPositions, globalNameFilter, taskOrder]
  );

  const positionsSettledForSprint =
    sprintId != null &&
    taskPositionsStore.positionsSettledSprintId === sprintId &&
    !taskPositionsStore.positionsLoadPending;

  const occupancyBurndownTiles = useMemo(() => {
    if (!loadTilePositions || !sprintTasksForTiles?.length) return null;
    if (!positionsSettledForSprint) return null;
    return computeBurndownTilesFromOccupancyRows(flattenedRowsForBurndownTiles, filteredTaskPositions);
  }, [
    loadTilePositions,
    sprintTasksForTiles,
    positionsSettledForSprint,
    flattenedRowsForBurndownTiles,
    filteredTaskPositions,
  ]);

  const taskFallbackTileMetrics = useMemo(() => {
    if (sprintTasksForTiles === undefined) return null;
    return computeBurndownTilesFromTasks(sprintTasksForTiles, goalTaskIdsForTiles);
  }, [sprintTasksForTiles, goalTaskIdsForTiles]);

  const occupancyShowsZeroButTasksHaveScope =
    occupancyBurndownTiles != null &&
    occupancyBurndownTiles.totalScopeSP === 0 &&
    occupancyBurndownTiles.totalScopeTP === 0 &&
    (taskFallbackTileMetrics?.totalScopeSP ?? 0) + (taskFallbackTileMetrics?.totalScopeTP ?? 0) > 0;

  const taskTileMetrics = occupancyShowsZeroButTasksHaveScope
    ? taskFallbackTileMetrics
    : (occupancyBurndownTiles ?? taskFallbackTileMetrics);

  // Вычисляем метрики
  const changelogTileMetrics = useBurndownMetrics({
    burndownData:
      burndownData != null ? { sprintTimelineTotals: burndownData.sprintTimelineTotals } : null,
  });

  const {
    completedSP,
    completedTP,
    totalScopeSP,
    totalScopeTP,
    completionPercentSP,
    completionPercentTP,
  } = taskTileMetrics ?? changelogTileMetrics;

  const remainingSPForLabel =
    taskTileMetrics != null
      ? Math.max(0, taskTileMetrics.totalScopeSP - taskTileMetrics.completedSP)
      : (burndownData?.sprintTimelineTotals?.remainingSP ?? burndownData?.currentSP ?? 0);
  const remainingTPForLabel =
    taskTileMetrics != null
      ? Math.max(0, taskTileMetrics.totalScopeTP - taskTileMetrics.completedTP)
      : (burndownData?.sprintTimelineTotals?.remainingTP ?? burndownData?.currentTP ?? 0);

  // Тултип для каждого графика со своей метрикой (SP или TP)
  const tooltipContentSP = useMemo(
    () =>
      (props: TooltipProps<number, string>) =>
        pinnedPoint && pinnedMetricType === 'SP' ? null : (
          <CustomTooltip
            {...props}
            changelogTypeLabels={changelogTypeLabels}
            locale={locale}
            metricType="SP"
            t={t}
            theme={theme}
          />
        ),
    [theme, pinnedPoint, pinnedMetricType, t, locale, changelogTypeLabels]
  );
  const tooltipContentTP = useMemo(
    () =>
      (props: TooltipProps<number, string>) =>
        pinnedPoint && pinnedMetricType === 'TP' ? null : (
          <CustomTooltip
            {...props}
            changelogTypeLabels={changelogTypeLabels}
            locale={locale}
            metricType="TP"
            t={t}
            theme={theme}
          />
        ),
    [theme, pinnedPoint, pinnedMetricType, t, locale, changelogTypeLabels]
  );

  const handlePointClick = useMemo(
    () => (payload: BurndownChartDataPoint, metricType: 'SP' | 'TP', event: React.MouseEvent) => {
      setPinnedPoint(payload);
      setPinnedMetricType(metricType);
      setPinnedPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const clearPinned = useMemo(
    () => () => {
      setPinnedPoint(null);
      setPinnedMetricType('SP');
      setPinnedPosition(null);
    },
    []
  );

  if (!sprintId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center">
            <div className="shrink-0">
              <SprintSelector
                loading={false}
                selectedSprintId={null}
                sprints={sprints}
                sprintsLoading={sprintsLoading}
                onSprintChange={onSprintChange}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium mb-2">{t('burndown.selectSprintTitle')}</p>
            <p className="text-sm">{t('burndown.selectSprintDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center">
            <div className="shrink-0">
              <SprintSelector
                loading={isLoading}
                selectedSprintId={sprintId}
                sprints={sprints}
                sprintsLoading={sprintsLoading}
                onSprintChange={onSprintChange}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Icon className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" name="spinner" />
            <p className="text-gray-500 dark:text-gray-400">{t('burndown.loadingData')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !burndownData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center">
            <div className="shrink-0">
              <SprintSelector
                loading={false}
                selectedSprintId={sprintId}
                sprints={sprints}
                sprintsLoading={sprintsLoading}
                onSprintChange={onSprintChange}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-red-500 dark:text-red-400">
            <p className="text-lg font-medium mb-2">{t('burndown.loadErrorTitle')}</p>
            <p className="text-sm">
              {error instanceof Error ? error.message : t('burndown.loadErrorFallback')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hideTpFromTasksIntegration =
    sprintTasksForTiles?.some((t) => t.hideTestPointsByIntegration === true) ?? false;
  const hideTpInBurndown =
    burndownData.testingFlowMode === 'standalone_qa_tasks' || hideTpFromTasksIntegration;


  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Заголовок с селектором спринта и кнопкой данных для анализа */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            <SprintSelector
              loading={isLoading}
              selectedSprintId={sprintId}
              sprints={sprints}
              sprintsLoading={sprintsLoading}
              onSprintChange={onSprintChange}
            />
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">

      {/* Метрики */}
      <div className={`grid ${hideTpInBurndown ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-6 flex-shrink-0`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('burndown.metrics.storyPointsTitle')}
          </h3>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {completedSP} / {totalScopeSP}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('burndown.remainingSp', { value: remainingSPForLabel })}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${completionPercentSP}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
              {completionPercentSP}%
            </span>
          </div>
        </div>

        {!hideTpInBurndown && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('burndown.metrics.testPointsTitle')}
            </h3>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {completedTP} / {totalScopeTP}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('burndown.remainingTp', { value: remainingTPForLabel })}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-600 dark:bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${completionPercentTP}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
                {completionPercentTP}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Графики */}
      <div className="flex-1 flex flex-col gap-6 min-h-0 relative">
        {typeof document !== 'undefined' &&
          pinnedPoint &&
          pinnedPosition &&
          createPortal(
            <>
            <Button
              aria-label={t('burndown.accessibility.closePinnedTooltip')}
              className="fixed inset-0 z-40 !cursor-default !rounded-none !border-0 !bg-transparent !p-0 !shadow-none hover:!bg-transparent focus-visible:!ring-0 dark:hover:!bg-transparent"
              type="button"
              variant="ghost"
              onClick={clearPinned}
            />
              <div
                aria-label={t('burndown.accessibility.dayChangelogDialog')}
                className="fixed z-50 cursor-default"
                role="dialog"
                style={{
                  left: Math.min(pinnedPosition.x + 12, typeof window !== 'undefined' ? window.innerWidth - 380 : pinnedPosition.x + 12),
                  top: Math.max(8, Math.min(pinnedPosition.y, (typeof window !== 'undefined' ? window.innerHeight : 0) - 320)),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <CustomTooltip
                  active
                  changelogTypeLabels={changelogTypeLabels}
                  locale={locale}
                  metricType={pinnedMetricType}
                  payload={[{ payload: pinnedPoint }]}
                  t={t}
                  theme={theme}
                />
              </div>
            </>,
            document.body
          )}
        <BurndownAreaChart
          chartData={chartData}
          idealSeriesName={t('burndown.chart.idealLine')}
          pinnedPoint={pinnedMetricType === 'SP' ? pinnedPoint : null}
          remainingSeriesName={t('burndown.chart.remainingSp')}
          theme={theme}
          title={t('burndown.metrics.storyPointsTitle')}
          tooltipContent={tooltipContentSP}
          type="SP"
          onPointClick={handlePointClick}
        />
        {!hideTpInBurndown && (
          <BurndownAreaChart
            chartData={chartData}
            idealSeriesName={t('burndown.chart.idealLine')}
            pinnedPoint={pinnedMetricType === 'TP' ? pinnedPoint : null}
            remainingSeriesName={t('burndown.chart.remainingTp')}
            theme={theme}
            title={t('burndown.metrics.testPointsTitle')}
            tooltipContent={tooltipContentTP}
            type="TP"
            onPointClick={handlePointClick}
          />
        )}
      </div>
      </div>
    </div>
  );
});
