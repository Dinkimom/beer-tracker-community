'use client';

import type { Developer } from '@/types';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';

interface SortableDeveloperItemProps {
  developer: Developer;
  isHidden: boolean;
  onToggleVisibility: () => void;
}

function SortableDeveloperItem({
  developer,
  isHidden,
  onToggleVisibility,
}: SortableDeveloperItemProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: developer.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 pr-2.5 py-1.5 rounded transition-colors ${
        isDragging ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' : ''
      }`}
      style={style}
    >
      {/* Иконка для перетаскивания */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 transition-colors"
        title={t('sidebar.developersManagement.dragReorderTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="text-gray-400 dark:text-gray-500 w-3.5 h-3.5" name="drag-handle" />
      </div>

      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
        <input
          checked={!isHidden}
          className="w-3.5 h-3.5 accent-blue-500 dark:accent-blue-400 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-400 dark:focus:ring-blue-400 flex-shrink-0"
          type="checkbox"
          onChange={onToggleVisibility}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
          {developer.name}
        </span>
      </label>
    </div>
  );
}

interface DevelopersManagementContentProps {
  developers: Developer[];
  developersManagement: {
    handleDragEnd: (activeId: string, overId: string) => void;
    hiddenIds: Set<string>;
    hideAllDevelopers: () => void;
    setSortBy: (sort: 'custom' | 'name' | 'sp' | 'tasks' | 'tp') => void;
    showAllDevelopers: () => void;
    sortBy: 'custom' | 'name' | 'sp' | 'tasks' | 'tp';
    sortedDevelopers: Developer[];
    toggleDeveloperVisibility: (id: string) => void;
  };
}

export function DevelopersManagementContent({
  developers,
  developersManagement,
}: DevelopersManagementContentProps) {
  const developersToShow = developersManagement.sortedDevelopers || developers;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    developersManagement.handleDragEnd(active.id as string, over.id as string);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        <SortableContext
          items={developersToShow.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {developersToShow.map((dev) => {
            const isHidden = developersManagement.hiddenIds.has(dev.id);
            return (
              <SortableDeveloperItem
                key={dev.id}
                developer={dev}
                isHidden={isHidden}
                onToggleVisibility={() => developersManagement.toggleDeveloperVisibility(dev.id)}
              />
            );
          })}
        </SortableContext>
      </div>
    </DndContext>
  );
}
