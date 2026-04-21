import type { Task, TaskPosition } from '@/types';

import { getTaskPoints } from '@/features/task/utils/taskUtils';
import { storyPointsToTimeslots } from '@/lib/pointsUtils';

function getPositionEffectiveDuration(position: TaskPosition): number {
  if (position.segments && position.segments.length > 0) {
    return position.segments.reduce((sum, s) => sum + s.duration, 0);
  }
  return position.duration;
}

/**
 * Длительность задачи в частях дня для DnD (позиция или story points).
 */
export function getTaskDuration(
  taskId: string,
  taskPositions: Map<string, TaskPosition>,
  tasks: Task[]
): number {
  const existingPosition = taskPositions.get(taskId);
  if (existingPosition) {
    return getPositionEffectiveDuration(existingPosition);
  }

  const task = tasks.find((t) => t.id === taskId);
  return task ? Math.max(1, storyPointsToTimeslots(getTaskPoints(task))) : 1;
}
