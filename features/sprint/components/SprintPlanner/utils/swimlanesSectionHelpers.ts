import type { Task, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';

export interface DeveloperAvailabilityRow {
  techSprints: QuarterlyAvailability['techSprints'];
  vacations: QuarterlyAvailability['vacations'];
}

export function buildDeveloperAvailabilityMap(
  availability: QuarterlyAvailability | null | undefined,
  developers: Array<{ id: string }>
): Map<string, DeveloperAvailabilityRow> {
  const empty = new Map<string, DeveloperAvailabilityRow>();
  if (!availability) return empty;

  const map = new Map<string, DeveloperAvailabilityRow>();
  for (const dev of developers) {
    const vacations = availability.vacations.filter((v) => v.memberId === dev.id);
    const techSprints = availability.techSprints.filter((t) => t.memberId === dev.id);
    if (vacations.length > 0 || techSprints.length > 0) {
      map.set(dev.id, { vacations, techSprints });
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
