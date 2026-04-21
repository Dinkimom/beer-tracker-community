'use client';

import type { SidebarMainTab } from '@/features/sidebar/hooks/useSidebarTabsState';
import type { ReactNode } from 'react';

import { SidebarTabButton } from '@/features/sidebar/components/SidebarHeader/SidebarTabButton';

interface TaskSidebarHeaderProps {
  mainTab: SidebarMainTab;
  tabs: Array<{
    id: SidebarMainTab;
    label: string;
    variant: 'amber' | 'blue' | 'emerald' | 'purple' | 'red' | 'violet';
    badge?: ReactNode;
    title?: string;
  }>;
  setMainTab: (tab: SidebarMainTab) => void;
}

export function SidebarHeader({
  mainTab,
  setMainTab,
  tabs,
}: TaskSidebarHeaderProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <div className="bg-white dark:bg-gray-800">
        <div className="flex h-[40px] border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <SidebarTabButton
              key={tab.id}
              badge={tab.badge}
              isActive={mainTab === tab.id}
              label={tab.label}
              title={tab.title}
              variant={tab.variant}
              onClick={() => setMainTab(tab.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
