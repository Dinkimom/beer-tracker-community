'use client';

import type { OccupancyViewProps } from '../occupancy/OccupancyView.types';
import type { BoardViewMode } from '@/hooks/useLocalStorage';
import type { StatusFilter } from '@/types';
import type { ComponentProps } from 'react';

import { ZIndex } from '@/constants';

import { SwimlanesSection } from '../components/SwimlanesSection';
import { KanbanView } from '../kanban';
import { OccupancyView } from '../occupancy';

type KanbanViewProps = ComponentProps<typeof KanbanView>;

export type SprintPlannerSwimlanesViewProps = Omit<
  ComponentProps<typeof SwimlanesSection>,
  'viewMode'
>;

export interface SprintPlannerBoardViewsProps {
  kanban: KanbanViewProps;
  occupancy: OccupancyViewProps;
  occupancyStatusFilter: StatusFilter;
  occupancyTasksLoading: boolean;
  swimlanes: SprintPlannerSwimlanesViewProps;
  viewMode: BoardViewMode;
}

/**
 * Основная область доски: занятость, канбан или свимлейны в зависимости от режима.
 */
export function SprintPlannerBoardViews({
  viewMode,
  occupancyStatusFilter,
  occupancyTasksLoading,
  occupancy,
  kanban,
  swimlanes,
}: SprintPlannerBoardViewsProps) {
  if (viewMode === 'occupancy') {
    return (
      <>
        {occupancyStatusFilter !== 'all' && occupancyTasksLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80"
            style={{ zIndex: ZIndex.overlay }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Загрузка задач…
              </span>
            </div>
          </div>
        )}
        <OccupancyView {...occupancy} />
      </>
    );
  }

  if (viewMode === 'kanban') {
    return <KanbanView {...kanban} />;
  }

  const swimlaneViewMode: 'compact' | 'full' =
    viewMode === 'compact' || viewMode === 'full' ? viewMode : 'full';

  return <SwimlanesSection {...swimlanes} viewMode={swimlaneViewMode} />;
}
