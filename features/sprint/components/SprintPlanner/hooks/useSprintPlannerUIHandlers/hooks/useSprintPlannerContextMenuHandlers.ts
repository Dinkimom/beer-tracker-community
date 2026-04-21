/**
 * Хук для обработчиков контекстного меню в SprintPlanner
 */

import type { SprintPlannerContextMenuState } from '@/lib/layers';
import type { Task } from '@/types';

import { useCallback } from 'react';

import { useRootStore } from '@/lib/layers';

export function useSprintPlannerContextMenuHandlers() {
  const { sprintPlannerUi } = useRootStore();

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, task: Task, isBacklogTask?: boolean, hideRemoveFromPlan?: boolean) => {
      e.preventDefault();
      e.stopPropagation();

      sprintPlannerUi.setContextMenuTaskId(task.id);

      const startEl = e.currentTarget as HTMLElement | null;
      // Кнопка «⋯» в строке занятости — currentTarget = button; якорим меню к строке задачи.
      const anchoredEl =
        startEl?.closest<HTMLElement>('[data-context-menu-source="task-card"]') ??
        startEl?.closest<HTMLElement>('[data-context-menu-source="occupancy-phase"]') ??
        startEl?.closest<HTMLElement>('[data-context-menu-source="occupancy-task-row"]') ??
        startEl;
      const menuSource = anchoredEl?.getAttribute('data-context-menu-source');
      const fromAnchoredElement =
        menuSource === 'task-card' ||
        menuSource === 'occupancy-phase' ||
        menuSource === 'occupancy-task-row';
      let anchorRect: SprintPlannerContextMenuState['anchorRect'];
      let position = { x: e.clientX, y: e.clientY };
      if (fromAnchoredElement && anchoredEl) {
        const r = anchoredEl.getBoundingClientRect();
        anchorRect = {
          bottom: r.bottom,
          height: r.height,
          left: r.left,
          right: r.right,
          top: r.top,
          width: r.width,
        };
        position = { x: r.right + 8, y: r.top };
      }

      const fromOccupancyRowMenuButton = Boolean(
        startEl?.closest<HTMLElement>('[data-occupancy-row-context-menu-trigger="true"]')
      );
      const dimPeerUi =
        !(menuSource === 'occupancy-task-row' && fromOccupancyRowMenuButton);

      sprintPlannerUi.setContextMenu({
        task,
        position,
        anchorRect,
        dimPeerUi,
        isBacklogTask: isBacklogTask || false,
        hideRemoveFromPlan: hideRemoveFromPlan || false,
      });
    },
    [sprintPlannerUi]
  );

  return {
    handleContextMenu,
  };
}
