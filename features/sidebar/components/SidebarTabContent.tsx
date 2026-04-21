'use client';

import type { SidebarMainTab } from '@/features/sidebar/hooks/useSidebarTabsState';

import { BacklogTab } from '@/features/sidebar/components/tabs/BacklogTab';
import { GoalsTab } from '@/features/sidebar/components/tabs/GoalsTab';
import { InvalidTab } from '@/features/sidebar/components/tabs/InvalidTab';
import { MetricsTab } from '@/features/sidebar/components/tabs/MetricsTab';
import { ReleasesTab } from '@/features/sidebar/components/tabs/ReleasesTab';
import { TasksTab } from '@/features/sidebar/components/tabs/TasksTab';

const SCROLLABLE_MAIN_TABS: SidebarMainTab[] = [
  'invalid',
  'tasks',
  'backlog',
  'goals',
  'metrics',
  'releases',
];

interface SidebarTabContentProps {
  hideBacklogTab?: boolean;
  hideReleasesTab?: boolean;
  mainTab: SidebarMainTab;
}

export function SidebarTabContent({
  hideBacklogTab = false,
  hideReleasesTab = false,
  mainTab,
}: SidebarTabContentProps) {
  const isScrollable = SCROLLABLE_MAIN_TABS.includes(mainTab);
  const contentClassName = `flex-1 bg-white dark:bg-gray-800 min-h-0 ${
    isScrollable ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
  }`;

  return (
    <div className={contentClassName}>
      {mainTab === 'tasks' && <TasksTab />}
      {mainTab === 'metrics' && <MetricsTab />}
      {mainTab === 'goals' && <GoalsTab />}
      {mainTab === 'invalid' && <InvalidTab />}
      {mainTab === 'backlog' && !hideBacklogTab && <BacklogTab />}
      {mainTab === 'releases' && !hideReleasesTab && <ReleasesTab />}
    </div>
  );
}
