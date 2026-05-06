'use client';

import type { MainPage, SprintTab } from '@/components/PageHeader';
import type { SprintListItem } from '@/types/tracker';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Icon } from '@/components/Icon';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { PageHeader } from '@/components/PageHeader';
import { PhaseCardColorSchemeProvider } from '@/components/PhaseCardColorSchemeContext';
import { ProductPlannerTenantBar } from '@/components/ProductPlannerTenantBar';
import { Snow } from '@/components/Snow';
import { useI18n } from '@/contexts/LanguageContext';
import { BacklogPage } from '@/features/backlog/components/BacklogPage';
import { useBoards } from '@/features/board/hooks/useBoards';
import { BurndownChart } from '@/features/burndown/components/BurndownChart';
import { EpicEditorPage } from '@/features/feature-planner/components/EpicEditorPage';
import { FeaturesPage } from '@/features/feature-planner/components/FeaturesPage';
import { QuarterlyPlanningV2Page } from '@/features/quarterly-planning-v2/components/QuarterlyPlanningV2Page';
import { SprintPlanner } from '@/features/sprint/components/SprintPlanner';
import { useSprintGoals } from '@/features/sprint/hooks/useSprintGoals';
import { useSprints } from '@/features/sprint/hooks/useSprints';
import { useReloadTasks } from '@/features/task/hooks/useTaskMutations';
import { useTasks } from '@/features/task/hooks/useTasks';
import { useSelectedBoardStorage, useSelectedSprintStorage } from '@/hooks/useLocalStorage';
import { usePlannerIntegrationRules } from '@/hooks/usePlannerIntegrationRules';
import { useProductTenantOrganizations } from '@/hooks/useProductTenantOrganizations';
import { useTaskPositionsBoardGateReady } from '@/hooks/useTaskPositionsBoardGateReady';
import { fetchSprints } from '@/lib/beerTrackerApi';
import { useRootStore } from '@/lib/layers';
import { buildPlannerPath, isPlannerPath, parsePlannerPath } from '@/lib/planner/plannerUrl';
import { resolveValidatedSprintId } from '@/lib/planner/resolveValidatedSprintId';

const mainPageParser = parseAsStringLiteral(['sprints', 'features', 'quarterly-v2']).withDefault('sprints');
const sprintTabParser = parseAsStringLiteral(['backlog', 'board', 'burndown']).withDefault('board');

/**
 * После первого подъёма MainPageClient в этой вкладке не показываем полноэкранный лоадер при remount
 * (например router.replace между /planner/:board/sprint/:sprint — иначе isMounted снова false на кадр).
 */
let mainPageClientShellEverReady = false;

export interface MainPageClientProps {
  /** Если открыто по ссылке `/planner/:boardId/sprint/:sprintId` — проверяем доску в списке пользователя и синхронизируем хранилище */
  plannerBoardId?: number;
  plannerSprintId?: number;
}

export default function MainPageClient({ plannerBoardId, plannerSprintId }: MainPageClientProps = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { getBoardById, getBoardSelectorLabel, isLoading: boardsLoading } = useBoards();
  const [selectedBoardId, setSelectedBoardId] = useSelectedBoardStorage();
  const [selectedSprintId, setSelectedSprintId] = useSelectedSprintStorage();

  // Роутинг через nuqs: page и tab синхронизированы с URL без ручных эффектов и ref
  const [{ page: activeMainPage, tab: activeTab }, setQueryStates] = useQueryStates(
    {
      page: mainPageParser,
      tab: sprintTabParser,
    },
    { shallow: false }
  );

  const boardName = useMemo(
    () => getBoardSelectorLabel(selectedBoardId),
    [selectedBoardId, getBoardSelectorLabel]
  );

  const isPlannerDeepLink =
    plannerBoardId != null && plannerSprintId != null && !Number.isNaN(plannerBoardId) && !Number.isNaN(plannerSprintId);
  const plannerDeepLinkKey = isPlannerDeepLink ? `${plannerBoardId}-${plannerSprintId}` : null;

  const featuresRouterBase =
    selectedBoardId != null && selectedSprintId != null
      ? buildPlannerPath(selectedBoardId, selectedSprintId)
      : '/';

  /** Стабильная строка query для зависимостей эффектов (объект searchParams меняется каждый рендер). */
  const searchParamsKey = searchParams.toString();

  const handleMainPageChange = useCallback(
    (page: MainPage) => {
      if (page === 'sprints') {
        setQueryStates({ page: 'sprints', tab: 'board' });
      } else {
        setQueryStates({ page });
      }
    },
    [setQueryStates]
  );

  const handleTabChange = useCallback(
    (tab: SprintTab) => {
      if (activeMainPage !== 'sprints') return;
      setQueryStates({ tab });
    },
    [activeMainPage, setQueryStates]
  );

  const updateSprintIdWithValidation = useCallback(
    (sprints: Array<{ id: number; status?: string; archived?: boolean }>) => {
      setSelectedSprintId((currentSprintId) => {
        const next = resolveValidatedSprintId(currentSprintId, sprints);
        if (
          currentSprintId != null &&
          next !== currentSprintId &&
          !sprints.some((s) => s.id === currentSprintId)
        ) {
          console.warn(`Сохраненный спринт ${currentSprintId} не найден в списке, выбираем новый`);
        }
        return next;
      });
    },
    [setSelectedSprintId]
  );

  // Первый визит: false на SSR и на первом кадре клиента (как и раньше). Повторный mount в той же сессии — сразу true.
  const [isMounted, setIsMounted] = useState(
    () => typeof window !== 'undefined' && mainPageClientShellEverReady
  );

  useEffect(() => {
    queueMicrotask(() => {
      mainPageClientShellEverReady = true;
      setIsMounted(true);
    });
  }, []);

  const productTenant = useProductTenantOrganizations();
  const { isFetched: plannerIntegrationRulesFetched } = usePlannerIntegrationRules(
    productTenant.activeOrganizationId
  );

  const adminHref = useMemo(() => {
    const adminOrg =
      productTenant.activeOrganization?.canAccessAdmin
        ? productTenant.activeOrganization
        : productTenant.organizations.find((o) => o.canAccessAdmin);
    if (!adminOrg) return null;
    return '/admin/org';
  }, [productTenant.activeOrganization, productTenant.organizations]);

  /**
   * Синхронизация URL /planner/:board/sprint/:sprint → хранилище только при смене пары в адресе.
   * После смены доски в UI state обновляется сразу, а пропсы из сегментов URL ещё старые — без этого ref
   * эффект откатывал бы выбор и зацикливал router.replace.
   */
  const lastSyncedPlannerKeyRef = useRef<string | null>(null);
  const isPlannerDeepLinkSyncPending =
    plannerDeepLinkKey != null && lastSyncedPlannerKeyRef.current !== plannerDeepLinkKey;

  /**
   * Прямая ссылка на планировщик: доска должна быть в списке досок пользователя (доступ из Tracker API).
   * useLayoutEffect: сегменты URL → хранилище до useEffect с router.replace, иначе гонка с id из
   * localStorage и бесконечный replace между «старым» спринтом из storage и id из пути.
   */
  useLayoutEffect(() => {
    if (!isMounted || !isPlannerDeepLink || boardsLoading) return;
    const board = getBoardById(plannerBoardId);
    if (!board) {
      router.replace('/select-board');
      return;
    }
    if (lastSyncedPlannerKeyRef.current === plannerDeepLinkKey) return;
    lastSyncedPlannerKeyRef.current = plannerDeepLinkKey;
    setSelectedBoardId(plannerBoardId);
    setSelectedSprintId(plannerSprintId);
  }, [
    isMounted,
    isPlannerDeepLink,
    boardsLoading,
    plannerBoardId,
    plannerSprintId,
    getBoardById,
    router,
    setSelectedBoardId,
    setSelectedSprintId,
    plannerDeepLinkKey,
  ]);

  /** С главной `/` с выбранной доской и спринтом — канонический URL с id в пути (сохраняем query: page, tab, фильтры). */
  useEffect(() => {
    if (!isMounted || boardsLoading) return;
    if (isPlannerDeepLinkSyncPending) return;
    if (pathname !== '/') return;
    if (selectedBoardId == null || selectedSprintId == null) return;
    if (!getBoardById(selectedBoardId)) return;
    const next = `${buildPlannerPath(selectedBoardId, selectedSprintId)}${searchParamsKey ? `?${searchParamsKey}` : ''}`;
    const current = `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ''}`;
    if (next === current) return;
    router.replace(next, { scroll: false });
  }, [
    isMounted,
    boardsLoading,
    isPlannerDeepLinkSyncPending,
    pathname,
    selectedBoardId,
    selectedSprintId,
    getBoardById,
    router,
    searchParamsKey,
  ]);

  /** После валидации спринта state может отличаться от id в URL — подставляем актуальные id. */
  useEffect(() => {
    if (!isMounted || boardsLoading) return;
    if (isPlannerDeepLinkSyncPending) return;
    if (!isPlannerPath(pathname)) return;
    if (selectedBoardId == null || selectedSprintId == null) return;
    const parsed = parsePlannerPath(pathname);
    if (!parsed) return;
    if (parsed.boardId === selectedBoardId && parsed.sprintId === selectedSprintId) return;
    const next = `${buildPlannerPath(selectedBoardId, selectedSprintId)}${searchParamsKey ? `?${searchParamsKey}` : ''}`;
    const current = `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ''}`;
    if (next === current) return;
    router.replace(next, { scroll: false });
  }, [
    isMounted,
    boardsLoading,
    isPlannerDeepLinkSyncPending,
    pathname,
    selectedBoardId,
    selectedSprintId,
    router,
    searchParamsKey,
  ]);

  // Загружаем спринты через React Query (только для страницы sprints)
  const shouldLoadSprintData = activeMainPage === 'sprints';

  const {
    data: sprints = [],
    isLoading: sprintsLoading,
    error: sprintsError,
  } = useSprints(selectedBoardId);

  // Загружаем задачи через React Query (только для страницы sprints)
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isPending: tasksPending,
    error: tasksError,
  } = useTasks(
    shouldLoadSprintData ? selectedSprintId : null,
    shouldLoadSprintData ? selectedBoardId : null
  );

  const tasks = tasksData?.tasks || [];
  const sprintInfo = tasksData?.sprintInfo || null;
  const effectiveSprintId = selectedSprintId ?? plannerSprintId ?? null;
  const selectedSprintName =
    sprintInfo?.name ?? sprints.find((s) => s.id === effectiveSprintId)?.name ?? null;

  useEffect(() => {
    if (activeMainPage !== 'sprints') return;
    if (!selectedSprintName?.trim()) return;

    document.title = selectedSprintName.trim();
  }, [
    activeMainPage,
    selectedSprintName,
  ]);

  // Цели спринта из таблицы sprint_goals (Delivery и Discovery)
  const shouldLoadGoals = !!shouldLoadSprintData && !!selectedSprintId;
  const { data: deliveryGoalsData, isLoading: deliveryGoalsLoading } = useSprintGoals(
    shouldLoadGoals ? selectedSprintId : null,
    'delivery'
  );
  const { data: discoveryGoalsData, isLoading: discoveryGoalsLoading } = useSprintGoals(
    shouldLoadGoals ? selectedSprintId : null,
    'discovery'
  );

  const deliveryChecklistItems = deliveryGoalsData?.checklistItems ?? [];
  const discoveryChecklistItems = discoveryGoalsData?.checklistItems ?? [];
  const checklistDone =
    (deliveryGoalsData?.checklistDone ?? 0) + (discoveryGoalsData?.checklistDone ?? 0);
  const checklistTotal =
    (deliveryGoalsData?.checklistTotal ?? 0) + (discoveryGoalsData?.checklistTotal ?? 0);
  const goalsLoading = deliveryGoalsLoading || discoveryGoalsLoading;

  // Исключаем задачи типа "цель" из списка (для фильтров и метрик)
  const goalTaskIds = tasks.filter((t) => t.type === 'goal').map((t) => t.id);

  // Мутация для перезагрузки задач
  const reloadTasksMutation = useReloadTasks(selectedSprintId, selectedBoardId);

  const { taskPositions } = useRootStore();
  const boardTabSprintIdForPositionsGate =
    activeMainPage === 'sprints' && activeTab === 'board' ? selectedSprintId : null;
  const taskPositionsBoardGateReady = useTaskPositionsBoardGateReady(boardTabSprintIdForPositionsGate);

  useEffect(() => {
    if (boardTabSprintIdForPositionsGate == null) return;
    void taskPositions.loadSprint(boardTabSprintIdForPositionsGate);
  }, [boardTabSprintIdForPositionsGate, taskPositions]);

  // Перенаправляем на выбор доски, если доска не выбрана (не мешаем загрузке валидной ссылки /planner/…)
  useEffect(() => {
    if (!isMounted) return;
    if (isPlannerDeepLink && boardsLoading) return;
    if (isPlannerDeepLink && plannerBoardId != null && getBoardById(plannerBoardId)) return;
    if (!selectedBoardId) {
      router.push('/select-board');
    }
  }, [isMounted, selectedBoardId, router, isPlannerDeepLink, boardsLoading, plannerBoardId, getBoardById]);

  // Валидация и выбор спринта при загрузке списка спринтов
  useEffect(() => {
    if (isPlannerDeepLinkSyncPending) return;
    if (!selectedBoardId || sprints.length === 0) {
      if (!selectedBoardId) {
        setSelectedSprintId(null);
      }
      return;
    }

    updateSprintIdWithValidation(sprints);
  }, [isPlannerDeepLinkSyncPending, sprints, selectedBoardId, setSelectedSprintId, updateSprintIdWithValidation]);

  // Функция для перезагрузки задач (showToast: только при явном нажатии «Обновить задачи», не при тихом reload после смены оценки)
  const handleTasksReload = (options?: { showToast?: boolean }) => {
    reloadTasksMutation.mutate(options);
  };

  const handleGoalsUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sprintGoals'] });
  }, [queryClient]);

  const handleSprintChange = useCallback(
    (sprintId: number | null) => {
      setSelectedSprintId(sprintId);
      if (selectedBoardId != null && sprintId != null) {
        router.replace(
          `${buildPlannerPath(selectedBoardId, sprintId)}${searchParamsKey ? `?${searchParamsKey}` : ''}`,
          { scroll: false }
        );
      }
    },
    [setSelectedSprintId, selectedBoardId, router, searchParamsKey]
  );

  // Функция для обработки изменения доски
  const handleBoardChange = useCallback(async (boardId: number | null) => {
    if (!boardId) {
      // Если доска сброшена, перенаправляем на страницу выбора
      setSelectedBoardId(null);
      router.push('/select-board');
      return;
    }

    try {
      // Загружаем спринты для выбранной доски
      const sprintsData: SprintListItem[] = await fetchSprints(boardId);

      // Находим первый активный спринт
      const activeSprint = sprintsData.find(
        (s: SprintListItem) => s.status === 'in_progress' && !s.archived
      );

      // Если активного спринта нет, берем первый в списке
      const sprintToSelect = activeSprint || (sprintsData.length > 0 ? sprintsData[0] : null);

      // Сохраняем доску
      setSelectedBoardId(boardId);

      // Сохраняем спринт, если он найден
      if (sprintToSelect) {
        setSelectedSprintId(sprintToSelect.id);
      } else {
        setSelectedSprintId(null);
      }

      // Инвалидируем кеш спринтов для новой доски
      queryClient.invalidateQueries({ queryKey: ['sprints', boardId] });

      const pathBase =
        sprintToSelect != null ? buildPlannerPath(boardId, sprintToSelect.id) : '/';

      // Если мы на странице фич, переходим в список фич (убираем featureId из URL)
      if (activeMainPage === 'features' && new URLSearchParams(searchParamsKey).get('featureId')) {
        const params = new URLSearchParams(searchParamsKey);
        params.delete('featureId');
        // Удаляем таб, если он был установлен для фичи
        const tab = params.get('tab');
        if (tab && !['general', 'tasks', 'documentation'].includes(tab)) {
          params.delete('tab');
        }
        router.replace(`${pathBase}?${params.toString()}`, { scroll: false });
      } else {
        router.replace(`${pathBase}${searchParamsKey ? `?${searchParamsKey}` : ''}`, { scroll: false });
      }
    } catch (err) {
      console.error('Error loading sprints:', err);
      // В случае ошибки не меняем доску
    }
  }, [
    setSelectedBoardId,
    setSelectedSprintId,
    router,
    queryClient,
    activeMainPage,
    searchParamsKey,
  ]);

  // Объединяем ошибки (только для страницы sprints)
  let sprintDataErrorMessage: string | null = null;
  if (shouldLoadSprintData && (sprintsError || tasksError)) {
    if (sprintsError instanceof Error) {
      sprintDataErrorMessage = sprintsError.message;
    } else if (tasksError instanceof Error) {
      sprintDataErrorMessage = tasksError.message;
    } else {
      sprintDataErrorMessage = t('sprint.errors.genericLoad');
    }
  }
  const error = sprintDataErrorMessage;
  const loading = shouldLoadSprintData ? tasksLoading : false;

  const waitForTasksOnBoardTab =
    activeMainPage === 'sprints' &&
    activeTab === 'board' &&
    selectedSprintId != null &&
    tasksPending;

  const waitForSprintsOnBoardTab =
    activeMainPage === 'sprints' &&
    activeTab === 'board' &&
    selectedBoardId != null &&
    sprintsLoading;

  const waitForPlannerRulesOnBoardTab =
    activeMainPage === 'sprints' &&
    activeTab === 'board' &&
    productTenant.activeOrganizationId != null &&
    !plannerIntegrationRulesFetched;

  const waitForGoalsOnBoardTab =
    activeMainPage === 'sprints' &&
    activeTab === 'board' &&
    selectedSprintId != null &&
    goalsLoading;

  const waitForTaskPositionsOnBoardTab =
    activeMainPage === 'sprints' &&
    activeTab === 'board' &&
    selectedSprintId != null &&
    !taskPositionsBoardGateReady;

  /** Один полноэкранный лоадер: гидратация, доски, спринты, правила интеграции, цели, позиции на доске, первая загрузка задач для «Доска». */
  const showFullScreenLoading =
    !isMounted ||
    boardsLoading ||
    waitForTasksOnBoardTab ||
    waitForSprintsOnBoardTab ||
    waitForPlannerRulesOnBoardTab ||
    waitForGoalsOnBoardTab ||
    waitForTaskPositionsOnBoardTab;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-600">
          {t('sprint.errors.loadFailedPrefix')} {error}
        </div>
      </div>
    );
  }

  const plannerAccessDenied =
    isMounted &&
    productTenant.signedIn &&
    !productTenant.sessionLoading &&
    productTenant.activeOrganization != null &&
    !productTenant.activeOrganization.canUsePlanner;

  if (plannerAccessDenied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 dark:bg-gray-900">
        <Icon aria-hidden className="h-14 w-14 text-amber-600 dark:text-amber-400" name="lock" />
        <p className="max-w-md text-center text-lg text-gray-800 dark:text-gray-200">
          {t('sprint.access.plannerDenied')}
        </p>
      </div>
    );
  }

  // Показываем загрузочный экран если доска не выбрана (пока происходит редирект)
  if (!selectedBoardId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-600">{t('common.redirecting')}</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Snow />
      <PhaseCardColorSchemeProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <PageHeader
            activeMainPage={activeMainPage}
            activeTab={activeTab}
            adminHref={adminHref}
            boardName={boardName}
            selectedBoardId={selectedBoardId}
            onBoardChange={handleBoardChange}
            onMainPageChange={handleMainPageChange}
            onTabChange={handleTabChange}
          />

          <ProductPlannerTenantBar
            activeOrganizationId={productTenant.activeOrganizationId}
            organizations={productTenant.organizations}
            sessionLoading={productTenant.sessionLoading}
            onOrganizationChange={productTenant.setActiveOrganizationId}
          />

          {!showFullScreenLoading && activeMainPage === 'sprints' && (
            <>
              {activeTab === 'backlog' && (
                <BacklogPage sprints={sprints} sprintsLoading={sprintsLoading} />
              )}

              {activeTab === 'board' && (
                <div className="flex flex-1 min-h-0 flex-col">
                  <SprintPlanner
                    checklistDone={checklistDone}
                    checklistTotal={checklistTotal}
                    deliveryChecklistItems={deliveryChecklistItems}
                    deliveryGoalsLoading={deliveryGoalsLoading}
                    discoveryChecklistItems={discoveryChecklistItems}
                    discoveryGoalsLoading={discoveryGoalsLoading}
                    goalTaskIds={goalTaskIds}
                    goalsLoading={goalsLoading}
                    loading={loading}
                    selectedSprintId={selectedSprintId}
                    sprintInfo={sprintInfo}
                    sprints={sprints}
                    sprintsLoading={sprintsLoading}
                    tasksReloading={reloadTasksMutation.isPending}
                    onGoalsUpdate={handleGoalsUpdate}
                    onSprintChange={handleSprintChange}
                    onTasksReload={handleTasksReload}
                  />
                </div>
              )}

              {activeTab === 'burndown' && (
                <BurndownChart
                  boardId={selectedBoardId ?? undefined}
                  goalTaskIdsForTiles={goalTaskIds}
                  sprintId={selectedSprintId}
                  sprintTasksForTiles={tasksPending ? undefined : tasks}
                  sprints={sprints}
                  sprintsLoading={sprintsLoading}
                  onSprintChange={handleSprintChange}
                />
              )}
            </>
          )}

          {!showFullScreenLoading && activeMainPage === 'quarterly-v2' && selectedBoardId && (
            <QuarterlyPlanningV2Page boardId={selectedBoardId} />
          )}

          {!showFullScreenLoading && activeMainPage === 'features' && (
            searchParams.get('epicId') ? (
              <EpicEditorPage epicId={searchParams.get('epicId')!} routerBasePath={featuresRouterBase} />
            ) : (
              <FeaturesPage boardId={selectedBoardId} routerBasePath={featuresRouterBase} />
            )
          )}
        </div>
        <LoadingOverlay isVisible={showFullScreenLoading} message={t('common.loading')} />
      </PhaseCardColorSchemeProvider>
    </ErrorBoundary>
  );
}
