'use client';

import type { SidebarTasksTab } from '@/types';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';

import { hrefWithSearchParams } from '@/features/sidebar/utils/hrefWithSearchParams';

export type SidebarMainTab =
  | 'backlog'
  | 'goals'
  | 'invalid'
  | 'metrics'
  | 'releases'
  | 'tasks';

interface UseSidebarTabsStateProps {
  hideBacklogTab?: boolean;
  hideTasksTab?: boolean;
}

function getMainTabFromSearchParams(
  searchParams: URLSearchParams
): SidebarMainTab {
  const tabParam = searchParams.get('sidebarTab');
  if (
    tabParam === 'backlog' ||
    tabParam === 'goals' ||
    tabParam === 'invalid' ||
    tabParam === 'metrics' ||
    tabParam === 'releases' ||
    tabParam === 'tasks'
  ) {
    return tabParam;
  }
  return 'tasks';
}

function getActiveTabFromSearchParams(
  searchParams: URLSearchParams
): SidebarTasksTab {
  const tabParam = searchParams.get('sidebarSubTab');
  if (tabParam === 'all' || tabParam === 'dev' || tabParam === 'qa') {
    return tabParam;
  }
  return 'all';
}

export function useSidebarTabsState({
  hideBacklogTab = false,
  hideTasksTab = false,
}: UseSidebarTabsStateProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const getMainTabFromUrl = useCallback(
    () => getMainTabFromSearchParams(searchParams),
    [searchParams]
  );
  const getActiveTabFromUrl = useCallback(
    () => getActiveTabFromSearchParams(searchParams),
    [searchParams]
  );

  const [mainTab, setMainTabState] = useState<SidebarMainTab>(getMainTabFromUrl);
  const [activeTab, setActiveTabState] = useState<SidebarTasksTab>(
    getActiveTabFromUrl
  );
  const isUserChangingTabRef = useRef(false);

  useEffect(() => {
    if (hideTasksTab && mainTab === 'tasks') {
      isUserChangingTabRef.current = true;
      const fallbackTab = hideBacklogTab ? 'goals' : 'backlog';
      const params = new URLSearchParams(searchParams.toString());
      params.set('sidebarTab', fallbackTab);
      router.replace(hrefWithSearchParams(pathname, params), { scroll: false });
      startTransition(() => setMainTabState(fallbackTab));
    }
  }, [hideTasksTab, hideBacklogTab, mainTab, pathname, router, searchParams]);

  useEffect(() => {
    if (hideBacklogTab && mainTab === 'backlog') {
      isUserChangingTabRef.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.set('sidebarTab', 'tasks');
      router.replace(hrefWithSearchParams(pathname, params), { scroll: false });
      startTransition(() => setMainTabState('tasks'));
    }
  }, [hideBacklogTab, mainTab, pathname, router, searchParams]);

  useEffect(() => {
    if (isUserChangingTabRef.current) {
      isUserChangingTabRef.current = false;
      return;
    }

    const mainTabFromUrl = getMainTabFromUrl();
    const activeTabFromUrl = getActiveTabFromUrl();

    startTransition(() => {
      if (mainTabFromUrl !== mainTab) {
        setMainTabState(mainTabFromUrl);
      }
      if (activeTabFromUrl !== activeTab) {
        setActiveTabState(activeTabFromUrl);
      }
    });
  }, [searchParams, getMainTabFromUrl, getActiveTabFromUrl, mainTab, activeTab]);

  const setMainTab = useCallback(
    (tab: SidebarMainTab) => {
      isUserChangingTabRef.current = true;
      setMainTabState(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('sidebarTab', tab);
      router.replace(hrefWithSearchParams(pathname, params), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setActiveTab = useCallback(
    (tab: SidebarTasksTab) => {
      isUserChangingTabRef.current = true;
      setActiveTabState(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('sidebarSubTab', tab);
      router.replace(hrefWithSearchParams(pathname, params), { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return {
    activeTab,
    mainTab,
    setActiveTab,
    setMainTab,
  };
}
