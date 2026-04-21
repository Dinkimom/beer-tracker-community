'use client';

import type { SidebarMainTab } from './useSidebarTabsState';
import type { SidebarTabSettings } from '@/hooks/useLocalStorage';
import type { ReactNode } from 'react';

import { useI18n } from '@/contexts/LanguageContext';

export type SidebarHeaderTabVariant =
  | 'amber'
  | 'blue'
  | 'emerald'
  | 'purple'
  | 'red'
  | 'violet';

export interface SidebarHeaderTab {
  badge?: ReactNode;
  id: SidebarMainTab;
  label: string;
  title?: string;
  variant: SidebarHeaderTabVariant;
}

const SIDEBAR_TAB_VARIANTS: Record<SidebarMainTab, SidebarHeaderTabVariant> = {
  tasks: 'blue',
  invalid: 'red',
  goals: 'blue',
  metrics: 'emerald',
  releases: 'violet',
  backlog: 'blue',
};

const DEFAULT_SIDEBAR_ORDER: SidebarMainTab[] = [
  'tasks',
  'invalid',
  'goals',
  'metrics',
  'releases',
  'backlog',
];

function sidebarTabBadge(
  tabId: SidebarMainTab,
  counts: {
    allTasksCount: number;
    checklistDone: number;
    checklistTotal: number;
    invalidTasksCount: number;
  }
): ReactNode | undefined {
  if (tabId === 'tasks') {
    return counts.allTasksCount > 0 ? counts.allTasksCount : undefined;
  }
  if (tabId === 'invalid') {
    return counts.invalidTasksCount > 0 ? counts.invalidTasksCount : undefined;
  }
  if (tabId === 'goals') {
    return counts.checklistTotal > 0
      ? `${counts.checklistDone}/${counts.checklistTotal}`
      : undefined;
  }
  return undefined;
}

function sidebarTabTitle(
  tabId: SidebarMainTab,
  t: (key: string) => string
): string | undefined {
  if (tabId === 'metrics') {
    return t('sidebar.tabTitles.metrics');
  }
  if (tabId === 'releases') {
    return t('sidebar.tabTitles.releases');
  }
  return undefined;
}

interface UseSidebarHeaderTabsProps {
  allTasksCount: number;
  checklistDone: number;
  checklistTotal: number;
  hideBacklogTab?: boolean;
  /** Скрыть таб «Релизы» (настройка организации в интеграции трекера). */
  hideReleasesTab?: boolean;
  hideTasksTab?: boolean;
  invalidTasksCount: number;
  sidebarTabsSettings: SidebarTabSettings[];
  sprintInfo: { id: number; status: string; version?: number } | null;
}

export function useSidebarHeaderTabs({
  allTasksCount,
  checklistDone,
  checklistTotal,
  hideBacklogTab = false,
  hideReleasesTab = false,
  hideTasksTab = false,
  invalidTasksCount,
  sidebarTabsSettings,
  sprintInfo,
}: UseSidebarHeaderTabsProps): SidebarHeaderTab[] {
  const { t } = useI18n();
  const configuredSidebarIds =
    sidebarTabsSettings.length > 0
      ? (sidebarTabsSettings.map((t) => t.id) as SidebarMainTab[])
      : DEFAULT_SIDEBAR_ORDER;

  const visibilityMap = new Map(
    sidebarTabsSettings.map((s) => [s.id, s.visible])
  );

  return configuredSidebarIds
    .filter((id) => SIDEBAR_TAB_VARIANTS[id])
    .map((id) => {
      const visible = visibilityMap.get(id) ?? true;
      return {
        id,
        label: t(`sidebar.tabs.${id}`),
        variant: SIDEBAR_TAB_VARIANTS[id],
        visible,
      };
    })
    .filter((tab) => {
      if (!tab.visible) return false;
      if (tab.id === 'tasks' && hideTasksTab) return false;
      if (tab.id === 'backlog' && hideBacklogTab) return false;
      if (tab.id === 'releases' && hideReleasesTab) return false;
      if (
        (tab.id === 'goals' ||
          tab.id === 'metrics' ||
          tab.id === 'releases') &&
        !sprintInfo
      ) {
        return false;
      }
      return true;
    })
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      variant: tab.variant,
      badge: sidebarTabBadge(tab.id, {
        allTasksCount,
        checklistDone,
        checklistTotal,
        invalidTasksCount,
      }),
      title: sidebarTabTitle(tab.id, t),
    }));
}
