/**
 * Общая логика маршрутизации dnd-kit в планере спринта (свимлейн + сайдбар).
 * Используется в `SprintPlannerDndShell`; не дублировать в других обработчиках DnD планера.
 */

import type { DragEndEvent } from '@dnd-kit/core';

import { isActiveDeveloperRowDrag } from '@/features/swimlane/utils/swimlaneDragIds';

/**
 * Перестановка строки разработчика: оба id дропа — `swimlane-${developerId}`.
 */
export function runDeveloperRowDragEndIfApplicable(
  event: DragEndEvent,
  onReorder: (developerId: string, overDeveloperId: string) => void
): void {
  const activeId = event.active.id.toString();
  const overId = event.over?.id?.toString();
  if (overId?.startsWith('swimlane-')) {
    const developerId = activeId.replace('swimlane-', '');
    const overDeveloperId = overId.replace('swimlane-', '');
    onReorder(developerId, overDeveloperId);
  }
}

export { isActiveDeveloperRowDrag };
