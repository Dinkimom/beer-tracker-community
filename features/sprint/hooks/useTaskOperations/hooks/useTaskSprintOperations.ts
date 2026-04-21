/**
 * Хук для операций переноса и удаления задач из спринта
 */

import type { Task, TaskLink, TaskPosition } from '@/types';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

import {
  addIssueToSprint,
  removeIssueFromSprint,
  deleteTaskPosition,
} from '@/lib/beerTrackerApi';

import { findTaskById, getActualTaskId } from '../utils/taskUtils';

interface UseTaskSprintOperationsProps {
  selectedSprintId: number | null;
  sprints: Array<{ id: number; name: string }>;
  taskLinks: TaskLink[];
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  deleteLink: (linkId: string) => Promise<void>;
  deletePosition: (taskId: string) => Promise<void>;
  onTasksReload?: () => Promise<void> | void;
  setTaskLinks: (updater: (prev: TaskLink[]) => TaskLink[]) => void;
  setTaskPositions: (updater: (prev: Map<string, TaskPosition>) => Map<string, TaskPosition>) => void;
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
  updateXarrow?: () => void;
}

export function useTaskSprintOperations({
  tasks,
  taskPositions,
  taskLinks,
  selectedSprintId,
  sprints,
  setTasks,
  setTaskPositions,
  setTaskLinks,
  deletePosition,
  deleteLink,
  onTasksReload,
  updateXarrow,
}: UseTaskSprintOperationsProps) {
  /**
   * Перенос задачи в другой спринт
   */
  const moveToSprint = useCallback(
    async (taskId: string, sprintId: number): Promise<void> => {
      const taskToMove = findTaskById(tasks, taskId);
      const actualTaskId = getActualTaskId(tasks, taskId);
      const positionToRemove = taskPositions.get(actualTaskId);
      const linksToDelete = taskLinks.filter(
        (link) => link.fromTaskId === actualTaskId || link.toTaskId === actualTaskId
      );

      // Если задача переносится в другой спринт, оптимистично удаляем её из текущего
      if (selectedSprintId && selectedSprintId !== sprintId) {
        setTasks((prev) => prev.filter((task) => task.id !== actualTaskId && task.originalTaskId !== taskId));
        setTaskPositions((prev) => {
          const newPositions = new Map(prev);
          newPositions.delete(actualTaskId);
          return newPositions;
        });
        setTaskLinks((prev) =>
          prev.filter((link) => link.fromTaskId !== actualTaskId && link.toTaskId !== actualTaskId)
        );
        updateXarrow?.();
      }

      try {
        const success = await addIssueToSprint(taskId, sprintId);

        if (!success) {
          throw new Error('Failed to move task to sprint');
        }

        const targetSprint = sprints.find((s) => s.id === sprintId);
        const sprintName = targetSprint?.name || `спринт ${sprintId}`;
        toast.success(`Задача перенесена в спринт ${sprintName}`);

        // Если задача перенесена в текущий спринт, обновляем список задач
        if (selectedSprintId === sprintId && onTasksReload) {
          await onTasksReload();
        }

        // Если задача перенесена в другой спринт, удаляем позицию и связи через API
        if (selectedSprintId && selectedSprintId !== sprintId) {
          if (positionToRemove) {
            try {
              await deletePosition(actualTaskId);
            } catch (error) {
              console.error('Error deleting position:', error);
            }
          }

          await Promise.all(
            linksToDelete.map((link) =>
              deleteLink(link.id).catch((error) => {
                console.error('Error deleting link:', error);
              })
            )
          );

          // Удаляем позицию задачи в целевом спринте
          try {
            await deleteTaskPosition(sprintId, actualTaskId);
          } catch (error) {
            console.error('Error deleting position in target sprint:', error);
          }
        }
      } catch (error) {
        console.error('Error moving task to sprint:', error);
        // Откатываем изменения
        if (selectedSprintId && selectedSprintId !== sprintId && taskToMove) {
          setTasks((prev) => [...prev, taskToMove]);
        }
        if (positionToRemove) {
          setTaskPositions((prev) => {
            const newPositions = new Map(prev);
            newPositions.set(actualTaskId, positionToRemove);
            return newPositions;
          });
        }
        if (linksToDelete.length > 0) {
          setTaskLinks((prev) => [...prev, ...linksToDelete]);
        }
        updateXarrow?.();
        throw error;
      }
    },
    [
      tasks,
      taskPositions,
      taskLinks,
      selectedSprintId,
      sprints,
      setTasks,
      setTaskPositions,
      setTaskLinks,
      deletePosition,
      deleteLink,
      onTasksReload,
      updateXarrow,
    ]
  );

  /**
   * Удаление задачи из спринта
   */
  const removeFromSprint = useCallback(
    async (taskId: string): Promise<void> => {
      if (!selectedSprintId) {
        console.error('No selected sprint ID');
        return;
      }

      const sprintId = selectedSprintId;
      const taskToRemove = findTaskById(tasks, taskId);
      const actualTaskId = getActualTaskId(tasks, taskId);
      const positionToRemove = taskPositions.get(actualTaskId);
      const linksToDelete = taskLinks.filter(
        (link) => link.fromTaskId === actualTaskId || link.toTaskId === actualTaskId
      );

      // Оптимистично удаляем задачу из локального состояния
      setTasks((prev) => prev.filter((task) => task.id !== actualTaskId && task.originalTaskId !== taskId));
      setTaskPositions((prev) => {
        const newPositions = new Map(prev);
        newPositions.delete(actualTaskId);
        return newPositions;
      });
      setTaskLinks((prev) =>
        prev.filter((link) => link.fromTaskId !== actualTaskId && link.toTaskId !== actualTaskId)
      );
      updateXarrow?.();

      try {
        const success = await removeIssueFromSprint(taskId, sprintId);

        if (!success) {
          throw new Error('Failed to remove task from sprint');
        }

        toast.success('Задача убрана в бэклог');

        // Удаляем позицию и связи через API
        try {
          await deletePosition(actualTaskId);
        } catch (error) {
          console.error('Error deleting position:', error);
        }

        await Promise.all(
          linksToDelete.map((link) =>
            deleteLink(link.id).catch((error) => {
              console.error('Error deleting link:', error);
            })
          )
        );
      } catch (error) {
        console.error('Error removing task from sprint:', error);
        // Откатываем изменения
        if (taskToRemove) {
          setTasks((prev) => [...prev, taskToRemove]);
        }
        if (positionToRemove) {
          setTaskPositions((prev) => {
            const newPositions = new Map(prev);
            newPositions.set(actualTaskId, positionToRemove);
            return newPositions;
          });
        }
        if (linksToDelete.length > 0) {
          setTaskLinks((prev) => [...prev, ...linksToDelete]);
        }
        updateXarrow?.();
      }
    },
    [
      tasks,
      taskPositions,
      taskLinks,
      selectedSprintId,
      setTasks,
      setTaskPositions,
      setTaskLinks,
      deletePosition,
      deleteLink,
      updateXarrow,
    ]
  );

  return {
    moveToSprint,
    removeFromSprint,
  };
}

