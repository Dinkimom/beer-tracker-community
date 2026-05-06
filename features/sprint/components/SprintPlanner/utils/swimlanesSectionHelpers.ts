import type { Task, TaskPosition } from '@/types';
import type { BoardAvailabilityEvent, QuarterlyAvailability } from '@/types/quarterly';

import { normalizeQuarterlyAvailabilityToBoardEvents } from '@/features/sprint/utils/quarterlyAvailabilityNormalize';

export interface DeveloperAvailabilityRow {
  boardEvents: BoardAvailabilityEvent[];
}

export function buildDeveloperAvailabilityMap(
  availability: QuarterlyAvailability | null | undefined,
  developers: Array<{ id: string }>
): Map<string, DeveloperAvailabilityRow> {
  const empty = new Map<string, DeveloperAvailabilityRow>();
  if (!availability) return empty;

  const allEvents = normalizeQuarterlyAvailabilityToBoardEvents(availability);
  const map = new Map<string, DeveloperAvailabilityRow>();
  for (const dev of developers) {
    const boardEvents = allEvents.filter((e) => e.memberId === dev.id);
    if (boardEvents.length > 0) {
      map.set(dev.id, { boardEvents });
    }
  }
  return map;
}

export interface TaskLinkLike {
  fromTaskId: string;
  toTaskId: string;
}

/**
 * При наведении на карточку — ID задач, связанных с ней (сама карточка + связи + dev→QA только если обе в свимлейне).
 */
export function computeHoverConnectedTaskIds(
  hoveredTaskId: string | null,
  filteredTaskLinks: TaskLinkLike[],
  qaTasksMap: Map<string, Task> | undefined,
  taskPositions: Map<string, TaskPosition> | undefined
): Set<string> | null {
  if (!hoveredTaskId) return null;
  const set = new Set<string>([hoveredTaskId]);
  for (const link of filteredTaskLinks) {
    if (link.fromTaskId === hoveredTaskId || link.toTaskId === hoveredTaskId) {
      set.add(link.fromTaskId);
      set.add(link.toTaskId);
    }
  }
  if (qaTasksMap && taskPositions) {
    const qaId = qaTasksMap.get(hoveredTaskId)?.id;
    if (qaId && taskPositions.has(hoveredTaskId) && taskPositions.has(qaId)) {
      set.add(qaId);
    }
    for (const [devTaskId, qaTask] of qaTasksMap) {
      if (
        qaTask.id === hoveredTaskId &&
        taskPositions.has(devTaskId) &&
        taskPositions.has(hoveredTaskId)
      ) {
        set.add(devTaskId);
      }
    }
  }
  return set;
}
