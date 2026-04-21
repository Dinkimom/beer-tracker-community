'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import { BeerLottie, type BeerLottieRef } from '@/components/BeerLottie';
import { Button } from '@/components/Button';
import { ChristmasLights, isInChristmasPeriod } from '@/components/ChristmasLights';
import { CurrentUserAvatar } from '@/components/CurrentUserAvatar';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { SettingsModal } from '@/components/SettingsModal';
import { useDemoPlannerShell } from '@/contexts/DemoPlannerShellContext';
import { useI18n } from '@/contexts/LanguageContext';
import { BoardSelector } from '@/features/board/components/BoardSelector';
import { OccupancyLegend } from '@/features/sprint/components/SprintPlanner/occupancy/components/shared/OccupancyLegend';
import { useChristmasThemeStorage, useExperimentalFeaturesStorage, useThemeStorage } from '@/hooks/useLocalStorage';

export type MainPage = 'features' | 'quarterly-v2' | 'sprints';
export type SprintTab = 'backlog' | 'board' | 'burndown';

interface PageHeaderProps {
  activeMainPage: MainPage;
  activeTab: SprintTab;
  adminHref?: string | null;
  boardName?: string | null;
  selectedBoardId?: number | null;
  onBoardChange?: (boardId: number | null) => void;
  onMainPageChange?: (page: MainPage) => void;
  onTabChange?: (tab: SprintTab) => void;
}

export function PageHeader({ activeMainPage, activeTab, adminHref, boardName, selectedBoardId, onBoardChange, onMainPageChange, onTabChange }: PageHeaderProps) {
  const { isDemoPlanner } = useDemoPlannerShell();
  const { t } = useI18n();
  const [theme, setTheme] = useThemeStorage();
  const [christmasThemeEnabled, setChristmasThemeEnabled] = useChristmasThemeStorage();
  const [experimentalFeatures] = useExperimentalFeaturesStorage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isChristmasPeriod = isInChristmasPeriod();
  const beerLottieRef = useRef<BeerLottieRef>(null);

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const handleChristmasThemeToggle = () => {
    setChristmasThemeEnabled(!christmasThemeEnabled);
  };

  const sprintTabs: Array<{ id: SprintTab; label: string }> = useMemo(
    () => [
      { id: 'backlog', label: t('header.sprintTabs.backlog') },
      { id: 'board', label: t('header.sprintTabs.board') },
      { id: 'burndown', label: t('header.sprintTabs.burndown') },
    ],
    [t]
  );

  const mainPages: Array<{ id: MainPage; label: string; experimental?: boolean }> = useMemo(
    () => [
      { id: 'sprints', label: t('header.pages.sprints') },
      { id: 'features', label: t('header.pages.features') },
      { id: 'quarterly-v2', label: t('header.pages.quarterlyPlanning'), experimental: true },
    ],
    [t]
  );

  const visibleMainPages = useMemo(
    () =>
      mainPages.filter(
        (p) => !p.experimental || experimentalFeatures
      ),
    [mainPages, experimentalFeatures]
  );

  const handleTabClick = (tab: SprintTab) => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleMainPageClick = (page: MainPage) => {
    if (onMainPageChange) {
      onMainPageChange(page);
    }
  };

  return (
    <div
      className="relative bg-ds-surface-header"
      data-page-header
    >
      {isChristmasPeriod && christmasThemeEnabled ? <ChristmasLights /> : null}
      {selectedBoardId !== undefined && (
        <div className="flex items-center justify-between gap-4 border-b border-ds-border-subtle px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Логотип приложения */}
            <Button
              aria-label={t('header.clickForAnimation')}
              className="h-auto min-h-0 gap-1 border-0 bg-transparent p-0 pr-2 text-left shadow-none hover:bg-transparent dark:hover:bg-transparent"
              type="button"
              variant="ghost"
              onClick={() => beerLottieRef.current?.play()}
            >
              <BeerLottie ref={beerLottieRef} />
              <span
                className="whitespace-nowrap text-2xl font-bold text-gray-900 dark:text-gray-100"
                style={{
                  fontFamily: 'var(--font-caveat), cursive',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  transform: 'rotate(-1deg)',
                }}
              >
                {t('header.appName')}
              </span>
            </Button>
            {/* Разделитель после логотипа */}
            <div className="h-6 w-px flex-shrink-0 bg-ds-border-subtle" />
            {onBoardChange ? (
              <BoardSelector
                selectedBoardId={selectedBoardId}
                onBoardChange={onBoardChange}
              />
            ) : (
              boardName && (
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {boardName}
                </h1>
              )
            )}
            {/* Визуальный разделитель */}
            {onMainPageChange && (
              <div className="h-6 w-px flex-shrink-0 bg-ds-border-subtle" />
            )}
            {/* Переключатель главных страниц */}
            {onMainPageChange && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/50">
                {visibleMainPages.map((page) => {
                  const isActive = activeMainPage === page.id;
                  return (
                    <Button
                      key={page.id}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex h-9 min-h-0 items-center justify-center gap-1.5 whitespace-nowrap !rounded-md border px-3 !py-0 text-sm ${
                        isActive
                          ? 'border-gray-200/90 bg-white !text-blue-600 hover:!border-gray-200/90 hover:!bg-white dark:border-transparent dark:bg-gray-800 dark:!text-blue-400 dark:hover:!border-transparent dark:hover:!bg-gray-800'
                          : 'border-transparent shadow-none !text-gray-600 hover:!border-transparent hover:!bg-transparent hover:!text-gray-900 dark:!text-gray-400 dark:hover:!bg-transparent dark:hover:!text-gray-200'
                      }`}
                      type="button"
                      variant="ghost"
                      onClick={() => handleMainPageClick(page.id)}
                    >
                      {page.experimental && (
                        <span aria-hidden="true" className="text-sm leading-none" role="img">🏗️</span>
                      )}
                      {page.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <HeaderIconButton title={t('header.actions.settings')} type="button" onClick={() => setIsSettingsOpen(true)}>
                <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" name="settings" />
              </HeaderIconButton>
              {isChristmasPeriod ? (
                <HeaderIconButton
                  title={
                    christmasThemeEnabled
                      ? t('header.actions.disableChristmasTheme')
                      : t('header.actions.enableChristmasTheme')
                  }
                  type="button"
                  onClick={handleChristmasThemeToggle}
                >
                  <Icon
                    className={
                      christmasThemeEnabled
                        ? 'h-4 w-4 text-blue-500 dark:text-blue-400'
                        : 'h-4 w-4 text-ds-text-muted'
                    }
                    name="snowflake"
                  />
                </HeaderIconButton>
              ) : null}
              <HeaderIconButton
                title={
                  theme === 'light'
                    ? t('header.actions.switchToDarkTheme')
                    : t('header.actions.switchToLightTheme')
                }
                type="button"
                onClick={handleThemeToggle}
              >
                {theme === 'light' ? (
                  <Icon className="h-4 w-4 text-amber-500" name="sun" />
                ) : (
                  <Icon className="h-4 w-4 text-amber-400" name="moon" />
                )}
              </HeaderIconButton>
            </div>
            <div
              aria-hidden
              className="hidden h-6 w-px shrink-0 bg-ds-border-subtle sm:block"
            />
            <div className="flex items-center gap-2">
              <OccupancyLegend />
              {adminHref ? (
                <Link
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-gray-800"
                  href={adminHref}
                >
                  <Icon className="h-4 w-4 shrink-0" name="wrench" />
                  <span className="whitespace-nowrap">{t('header.admin')}</span>
                </Link>
              ) : null}
            </div>
            {!isDemoPlanner ? (
              <>
                <div aria-hidden className="h-6 w-px shrink-0 bg-ds-border-subtle" />
                {/* Аватар текущего пользователя */}
                <CurrentUserAvatar />
              </>
            ) : null}
          </div>
        </div>
      )}
      {/* Подтабы для страницы Спринты */}
      {activeMainPage === 'sprints' && (
        <nav
          aria-label={t('header.accessibility.sprintTabsNavigation')}
          className="flex shrink-0 border-b border-ds-border-subtle px-4"
        >
          {sprintTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-0 whitespace-nowrap rounded-none border-0 border-b-2 px-4 py-3 text-sm shadow-none focus-visible:z-10 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/50 !text-blue-600 hover:!bg-blue-50/70 dark:border-blue-400 dark:bg-blue-900/10 dark:!text-blue-400 dark:hover:!bg-blue-900/20'
                    : 'border-transparent !text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:!text-gray-900 dark:!text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700/30 dark:hover:!text-gray-200'
                }`}
                type="button"
                variant="ghost"
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.label}
              </Button>
            );
          })}
        </nav>
      )}

      {/* Модальное окно настроек */}
      <SettingsModal
        activeMainPage={activeMainPage}
        activeSprintTab={activeTab}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
