'use client';

/**
 * Страница «Квартальное планирование (новое)».
 * Отображение занятости по эпикам и стори: эпик = уровень группировки, строки = стори этого эпика (дни одной ячейкой).
 */

import type { StoryPhasePosition } from '../types';
import type { Quarter } from '@/types';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { useI18n } from '@/contexts/LanguageContext';
import { ResizableSidebar } from '@/components/ResizableSidebar';
import { QuarterSelector } from '@/features/quarterly-planning/components/Quarter/QuarterSelector';
import { getCurrentQuarter } from '@/features/quarterly-planning/utils/quarterUtils';
import { EpicOccupancyView } from '@/features/sprint/components/SprintPlanner/occupancy/EpicOccupancyView';
import { useSprints } from '@/features/sprint/hooks/useSprints';
import {
  useLocalStorage,
  useQuarterlyV2OccupancyOldTmLayoutStorage,
  useQuarterlyV2OccupancyRowFieldsStorage,
  useQuarterlyV2OccupancyTimelineSettingsStorage,
  useQuarterlyV2ShowPlannedTasksStorage,
} from '@/hooks/useLocalStorage';
import { fetchEpicsList, type EpicListItem } from '@/lib/api/epics';

import { useEpicStoriesOccupancyData } from '../hooks/useEpicStoriesOccupancyData';
import { useQuarterlyPlanV2 } from '../hooks/useQuarterlyPlanV2';

import { EpicsSidebar } from './EpicsSidebar';

const SIDEBAR_STORAGE_KEY = 'quarterly-v2-sidebar-width';
const SIDEBAR_OPEN_KEY = 'quarterly-v2-sidebar-open';

interface QuarterlyPlanningV2PageProps {
  boardId: number;
}

export function QuarterlyPlanningV2Page({ boardId }: QuarterlyPlanningV2PageProps) {
  const { t } = useI18n();
  const { year: initialYear, quarter: initialQuarter } = getCurrentQuarter();
  const [year, setYear] = useState(initialYear);
  const [quarter, setQuarter] = useState<Quarter>(initialQuarter);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage(SIDEBAR_STORAGE_KEY, 320);
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage(SIDEBAR_OPEN_KEY, true);
  const [planEpicKeys, setPlanEpicKeys] = useState<string[]>([]);
  const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(null);
  const [storyPhases, setStoryPhases] = useState<Record<string, StoryPhasePosition>>({});
  const [epics, setEpics] = useState<EpicListItem[]>([]);
  const [epicsLoading, setEpicsLoading] = useState(false);
  const [, setEpicsError] = useState<string | null>(null);

  const [quarterlyV2LegacyLayout] = useQuarterlyV2OccupancyOldTmLayoutStorage();
  const [quarterlyV2RowFields] = useQuarterlyV2OccupancyRowFieldsStorage();
  const [quarterlyV2TimelineSettings] = useQuarterlyV2OccupancyTimelineSettingsStorage();
  const [quarterlyV2ShowPlannedTasks] = useQuarterlyV2ShowPlannedTasksStorage();

  const handleQuarterChange = useCallback((y: number, q: Quarter) => {
    setYear(y);
    setQuarter(q);
  }, []);

  const { planData, isLoadingPlan, savePlan } = useQuarterlyPlanV2(
    boardId,
    year,
    quarter
  );

  // Загрузка эпиков доски для сайдбара (и отображения названий/статусов уже добавленных эпиков)
  useEffect(() => {
    let cancelled = false;

    async function loadEpics() {
      setEpicsLoading(true);
      setEpicsError(null);
      try {
        const epicItems = await fetchEpicsList(boardId, { perPage: 500 });
        if (!cancelled) {
          setEpics(epicItems);
        }
      } catch (error) {
        console.error('Failed to load epics for quarterly planning:', error);
        if (!cancelled) {
          setEpicsError(t('planning.quarterlyV2.loadEpicsFailed'));
          setEpics([]);
        }
      } finally {
        if (!cancelled) {
          setEpicsLoading(false);
        }
      }
    }

    if (boardId) {
      loadEpics();
    }

    return () => {
      cancelled = true;
    };
  }, [boardId, t]);

  // Синхронизация локального состояния с загруженным планом при смене квартала/доски
  useEffect(() => {
    if (!planData) return;
    startTransition(() => {
      setPlanEpicKeys(planData.epicKeys);
      setStoryPhases(planData.storyPhases ?? {});
    });
  }, [planData]);

  const planEpicKeysSet = useMemo(() => new Set(planEpicKeys), [planEpicKeys]);

  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(boardId);

  const epicDetailsMap = useMemo(() => {
    const map = new Map<string, { epicKey: string; epicName: string; epicOriginalStatus?: string; epicPriority?: string; epicType?: string }>();
    for (const key of planEpicKeys) {
      const epic = epics.find((e) => e.id === key);
      map.set(key, {
        epicKey: key,
        epicName: epic?.name ?? key,
        epicOriginalStatus: epic?.originalStatus,
        epicPriority: (epic as { priority?: string })?.priority,
        epicType: epic?.type,
      });
    }
    return map;
  }, [planEpicKeys, epics]);

  const handleStoryPhaseChange = useCallback(
    (storyKey: string, position: StoryPhasePosition | null) => {
      const next = { ...storyPhases };
      if (position) next[storyKey] = position;
      else delete next[storyKey];
      setStoryPhases(next);
      savePlan(planEpicKeys, next).catch((err) => {
        console.error('Failed to save plan after phase change:', err);
      });
    },
    [planEpicKeys, savePlan, storyPhases]
  );

  const {
    handlePositionSave,
    isLoading: occupancyLoading,
    plannedInSprintMaxStack,
    plannedInSprintPositions,
    sprintInfos,
    tasks,
    taskPositions,
  } = useEpicStoriesOccupancyData({
    boardId,
    epicDetailsMap,
    planEpicKeys,
    quarter: quarter as 1 | 2 | 3 | 4,
    sprints,
    storyPhases,
    year,
    onStoryPhaseChange: handleStoryPhaseChange,
  });

  const handleAddEpic = useCallback(
    (epicKey: string) => {
      const nextKeys = planEpicKeys.includes(epicKey)
        ? planEpicKeys
        : [...planEpicKeys, epicKey];
      setPlanEpicKeys(nextKeys);
      if (!selectedEpicKey) setSelectedEpicKey(epicKey);
      savePlan(nextKeys, storyPhases).catch((err) => {
        console.error('Failed to save plan after adding epic:', err);
      });
    },
    [planEpicKeys, savePlan, selectedEpicKey, storyPhases]
  );

  const isLoading = epicsLoading || sprintsLoading || isLoadingPlan;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <LoadingOverlay isVisible={isLoading} message={t('planning.quarterlyV2.loadingOverlay')} />

      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
        <QuarterSelector
          quarter={quarter}
          year={year}
          onQuarterChange={handleQuarterChange}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {planEpicKeys.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              {t('planning.quarterlyV2.emptyPlanHint')}
            </div>
          ) : planEpicKeys.length > 0 ? (
            <EpicOccupancyView
              cellsPerDay={1}
              developers={[]}
              hideFilters
              isLoading={occupancyLoading}
              legacyCompactLayout={quarterlyV2LegacyLayout}
              plannedInSprintMaxStack={quarterlyV2ShowPlannedTasks ? plannedInSprintMaxStack : undefined}
              plannedInSprintPositions={quarterlyV2ShowPlannedTasks ? plannedInSprintPositions : undefined}
              quarterlyPhaseStyle
              rowFieldsVisibility={{
                ...quarterlyV2RowFields,
                showAssignee: false,
                showStoryPoints: false,
                showTeam: false,
                showTestPoints: false,
                showType: false,
              }}
              sprintInfos={sprintInfos}
              taskLinks={[]}
              taskPositions={taskPositions}
              tasks={tasks}
              timelineSettings={quarterlyV2TimelineSettings}
              twoLineDayHeader
              onPositionSave={handlePositionSave}
            />
          ) : null}
        </div>

        <ResizableSidebar
          headerActions={
            <HeaderIconButton
              aria-label={t('planning.quarterlyV2.closeEpicsPanelAria')}
              title={t('planning.quarterlyV2.closeEpicsPanelTitle')}
              type="button"
              onClick={() => setIsSidebarOpen(false)}
            >
              <Icon className="h-5 w-5" name="chevron-right" />
            </HeaderIconButton>
          }
          isOpen={isSidebarOpen}
          maxWidth={500}
          minWidth={240}
          resizeHandleSide="left"
          title={t('planning.quarterlyV2.epicsSidebarTitle')}
          width={sidebarWidth}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          onWidthChange={setSidebarWidth}
        >
          <EpicsSidebar
            epics={epics}
            planEpicKeys={planEpicKeysSet}
            onAddEpic={handleAddEpic}
          />
        </ResizableSidebar>
      </div>
    </div>
  );
}
