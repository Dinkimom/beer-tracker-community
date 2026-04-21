'use client';

import type { SidebarTabSettings } from '@/hooks/useLocalStorage';
import type { DragEndEvent } from '@dnd-kit/core';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo } from 'react';

import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { useSidebarTabsSettingsStorage } from '@/hooks/useLocalStorage';
import { usePlannerIntegrationRules } from '@/hooks/usePlannerIntegrationRules';
import { useProductTenantOrganizations } from '@/hooks/useProductTenantOrganizations';
import { isPlannerReleasesTabOffered } from '@/lib/trackerIntegration/plannerReleasesTabOffered';

import { CheckboxOption } from './CheckboxOption';

const SIDEBAR_TAB_IDS: Record<string, true> = {
  tasks: true,
  invalid: true,
  goals: true,
  metrics: true,
  releases: true,
  backlog: true,
};

const DEFAULT_SIDEBAR_TAB_IDS = [
  'tasks',
  'invalid',
  'goals',
  'metrics',
  'releases',
  'backlog',
] as const;

function defaultSidebarTabItems(): SidebarTabSettings[] {
  return DEFAULT_SIDEBAR_TAB_IDS.map((id) => ({ id, visible: true }));
}

function normalizeSidebarTabsSettings(prev: SidebarTabSettings[]): SidebarTabSettings[] {
  const filtered = prev.filter((t) => t.id in SIDEBAR_TAB_IDS);
  return filtered.length > 0 ? filtered : defaultSidebarTabItems();
}

interface SidebarTabsSettingsListProps {
  setSidebarTabsSettings: ReturnType<typeof useSidebarTabsSettingsStorage>[1];
  sidebarTabsSettings: ReturnType<typeof useSidebarTabsSettingsStorage>[0];
}

interface SortableSidebarTabItemProps {
  id: string;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  visible: boolean;
  onToggleVisible: () => void;
}

function SortableSidebarTabItem({
  id,
  isFirst: _isFirst,
  isLast: _isLast,
  label,
  visible,
  onToggleVisible,
}: SortableSidebarTabItemProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    opacity: isDragging ? 0.6 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40"
      style={style}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          {...attributes}
          {...listeners}
          aria-label={t('settings.sidebarTabList.dragReorderAria')}
          className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-200/60 dark:hover:bg-gray-600/60"
          type="button"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="w-3.5 h-3.5" name="drag-handle" />
        </button>
        <span className="text-sm text-gray-800 dark:text-gray-100 truncate">
          {label}
        </span>
      </div>
      <CheckboxOption
        checked={visible}
        label={t('settings.sidebarTabList.showToggle')}
        onChange={onToggleVisible}
      />
    </div>
  );
}

export function SidebarTabsSettingsList({
  sidebarTabsSettings,
  setSidebarTabsSettings,
}: SidebarTabsSettingsListProps) {
  const { t } = useI18n();
  const { activeOrganizationId } = useProductTenantOrganizations({ pollIntervalMs: 30_000 });
  const { data: plannerRules, isFetched: plannerRulesFetched } =
    usePlannerIntegrationRules(activeOrganizationId);
  const releasesOffered = isPlannerReleasesTabOffered(
    activeOrganizationId,
    plannerRulesFetched,
    plannerRules
  );

  const items = useMemo(() => {
    const normalized = normalizeSidebarTabsSettings(sidebarTabsSettings);
    if (releasesOffered) {
      return normalized;
    }
    return normalized.filter((t) => t.id !== 'releases');
  }, [releasesOffered, sidebarTabsSettings]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSidebarTabsSettings((prev) => {
      const current = normalizeSidebarTabsSettings(prev).filter(
        (t) => t.id !== 'releases' || releasesOffered
      );
      const oldIndex = current.findIndex((t) => t.id === active.id);
      const newIndex = current.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = [...current];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const handleToggleVisible = (id: string) => {
    setSidebarTabsSettings((prev) => {
      const current = normalizeSidebarTabsSettings(prev);
      if (id === 'releases' && !releasesOffered) {
        return prev;
      }
      return current.map((tab) =>
        tab.id === id ? { ...tab, visible: !tab.visible } : tab
      );
    });
  };

  return (
    <div className="mt-2 space-y-1.5">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((tab, index) => (
            <SortableSidebarTabItem
              key={tab.id}
              id={tab.id}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              label={t(`sidebar.tabs.${tab.id}`)}
              visible={tab.visible}
              onToggleVisible={() => handleToggleVisible(tab.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
