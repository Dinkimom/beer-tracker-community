/**
 * Алгоритм размещения QA задач
 */

import type { TimeInterval } from '../types';
import type { Task, TaskPosition, TaskLink, Developer } from '@/types';

import { PARTS_PER_DAY } from '@/constants';

import { findQATaskPlacement } from '../utils/intervalUtils';
import { getQALinkAnchors } from '../utils/linkUtils';

interface QATaskPlacementResult {
  links: TaskLink[];
  positions: Map<string, TaskPosition>;
}

/**
 * Размещает QA задачи для размещенных dev задач
 */
export function placeQATasks(
  devTasks: Array<{ task: Task; position: TaskPosition }>,
  qaTasksMap: Map<string, Task>,
  developers: Developer[],
  existingPositions: Map<string, TaskPosition>,
  existingLinks: TaskLink[],
  occupiedIntervals: Map<string, TimeInterval[]>,
  currentCell: number
): QATaskPlacementResult {
  const newPositions = new Map<string, TaskPosition>(existingPositions);
  const newLinks: TaskLink[] = [...existingLinks];

  // Для каждой размещенной dev задачи размещаем соответствующую QA задачу
  devTasks.forEach(({ task: devTask, position: devPosition }) => {
    const qaTask = qaTasksMap.get(devTask.id);
    if (!qaTask) {
      return; // QA задача не найдена
    }

    // Проверяем, что QA задача еще не размещена
    if (newPositions.has(qaTask.id)) {
      // Если QA задача уже размещена, создаем связь если её еще нет
      const qaPosition = newPositions.get(qaTask.id)!;
      const existingLink = newLinks.find(
        link => link.fromTaskId === devTask.id && link.toTaskId === qaTask.id
      );

      if (!existingLink) {
        const anchors = getQALinkAnchors(devTask, devPosition, qaTask, qaPosition, developers);
        const newLink: TaskLink = {
          id: `link-qa-${devTask.id}-${qaTask.id}-${Date.now()}`,
          fromTaskId: devTask.id,
          toTaskId: qaTask.id,
          fromAnchor: anchors.fromAnchor,
          toAnchor: anchors.toAnchor,
        };
        newLinks.push(newLink);
      }
      return;
    }

    // QA задача не размещена - размещаем её
    const qaEngineerId = qaTask.assignee;
    if (!qaEngineerId) {
      return; // QA задача не имеет исполнителя
    }

    const qaTaskDuration = qaTask.testPoints || 1;
    const devTaskEndCell = (devPosition.startDay * PARTS_PER_DAY + devPosition.startPart) + devPosition.duration;

    // QA задача должна размещаться ПОСЛЕ соответствующей dev задачи
    // Минимальная позиция - после окончания dev задачи, но не раньше текущего времени спринта
    const minStartCell = Math.max(devTaskEndCell, currentCell);

    // Получаем занятые интервалы QA инженера
    const qaEngineerIntervals = occupiedIntervals.get(qaEngineerId) || [];

    // Находим свободное место для QA задачи
    const targetStartCell = findQATaskPlacement(qaEngineerIntervals, qaTaskDuration, minStartCell);

    // Если не нашли свободное место, пропускаем QA задачу
    if (targetStartCell === null) {
      return; // QA задача не помещается в спринт после dev задачи
    }

    const targetDay = Math.floor(targetStartCell / PARTS_PER_DAY);
    const targetPart = targetStartCell % PARTS_PER_DAY;

    const qaPosition: TaskPosition = {
      taskId: qaTask.id,
      assignee: qaEngineerId,
      startDay: targetDay,
      startPart: targetPart,
      duration: qaTaskDuration,
      plannedStartDay: targetDay,
      plannedStartPart: targetPart,
      plannedDuration: qaTaskDuration,
    };

    newPositions.set(qaTask.id, qaPosition);

    // Обновляем занятые интервалы для QA инженера
    qaEngineerIntervals.push({ start: targetStartCell, end: targetStartCell + qaTaskDuration });
    occupiedIntervals.set(qaEngineerId, qaEngineerIntervals);

    // Создаем связь между dev и QA задачами
    const anchors = getQALinkAnchors(devTask, devPosition, qaTask, qaPosition, developers);
    const newLink: TaskLink = {
      id: `link-qa-${devTask.id}-${qaTask.id}-${Date.now()}`,
      fromTaskId: devTask.id,
      toTaskId: qaTask.id,
      fromAnchor: anchors.fromAnchor,
      toAnchor: anchors.toAnchor,
    };
    newLinks.push(newLink);
  });

  return {
    positions: newPositions,
    links: newLinks,
  };
}

