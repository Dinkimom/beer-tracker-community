import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import type { MutableRefObject } from 'react';

/**
 * Получает позицию мыши из различных источников
 */
export function getMouseX(
  mousePositionRef: MutableRefObject<{ x: number; y: number } | null>,
  event?: DragEndEvent | DragOverEvent
): number | null {
  if (mousePositionRef.current) {
    return mousePositionRef.current.x;
  }

  if (event?.activatorEvent instanceof MouseEvent) {
    return event.activatorEvent.clientX;
  }

  if (event?.over?.rect) {
    return event.over.rect.left + event.over.rect.width / 2;
  }

  return null;
}
