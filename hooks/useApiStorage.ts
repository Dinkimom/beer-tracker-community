/**
 * Хуки для работы с данными через API вместо localStorage
 * (общие для пользователей спринта, не локальный storage).
 *
 * Два паттерна отложенной записи — см. **«Локальный стейт + API»** в [ARCHITECTURE.md](../ARCHITECTURE.md):
 * - **useDebouncedApiSync** — списки (связи, комментарии) через `useTaskLinksApi` / `useCommentsApi`.
 * - **useOccupancyTaskOrderApi** — один объект порядка строк занятости; отдельная реализация, не generic-список.
 */

import type { Comment, TaskLink } from '@/types';

import { useEffect, useRef, useState } from 'react';

import {
  type OccupancyTaskOrder,
  fetchOccupancyTaskOrder,
  saveOccupancyTaskOrder,
  fetchSprintLinks,
  saveTaskLink,
  saveTaskLinksBatch,
  deleteTaskLink,
  fetchSprintComments,
  saveComment as apiSaveComment,
  deleteComment as apiDeleteComment,
} from '@/lib/beerTrackerApi';
import { isValidSprintId } from '@/lib/layers/data/mappers/taskPositionToApi';
import { DELAYS } from '@/utils/constants';

import { useDebouncedApiSync } from './useDebouncedApiSync';

// ==================== Хуки для связей ====================

/**
 * Хук для работы со связями задач через API
 */
export function useTaskLinksApi(
  sprintId: number | null
): [TaskLink[], (links: TaskLink[] | ((prev: TaskLink[]) => TaskLink[])) => void, (link: TaskLink) => Promise<void>, (linkId: string) => Promise<void>] {
  const [links, setLinksWithSave, saveLink, deleteLink] = useDebouncedApiSync<TaskLink, string, {
    id: string;
    fromTaskId: string;
    toTaskId: string;
    fromAnchor: string | null;
    toAnchor: string | null;
  }>({
    sprintId,
    fetchFn: fetchSprintLinks,
    saveFn: (sprintId, data) => saveTaskLink(sprintId, data),
    batchSaveFn: (sprintId, items) => saveTaskLinksBatch(sprintId, items),
    deleteFn: deleteTaskLink,
    getId: (link) => link.id,
    toApiFormat: (link) => ({
      id: link.id,
      fromTaskId: link.fromTaskId,
      toTaskId: link.toTaskId,
      fromAnchor: link.fromAnchor || null,
      toAnchor: link.toAnchor || null,
    }),
  });

  return [links, setLinksWithSave, saveLink, deleteLink];
}

// ==================== Хуки для комментариев ====================

/**
 * Хук для работы с комментариями через API
 */
export function useCommentsApi(
  sprintId: number | null
): [
  Comment[],
  (comments: Comment[] | ((prev: Comment[]) => Comment[])) => void,
  (comment: Comment) => Promise<void>,
  (commentId: string) => Promise<void>
] {
  const [comments, setCommentsWithSave, saveCommentLocal, deleteCommentLocal] = useDebouncedApiSync<Comment, string, {
    id: string;
    assigneeId: string;
    text: string;
    taskId: string | null;
    x: number | null;
    y: number | null;
    day: number | null;
    part: number | null;
    width: number;
    height: number;
  }>({
    sprintId,
    debounceDelay: 600,
    mergeSavedItem: (previous, saved) => ({
      ...saved,
      clientInstanceId: previous.clientInstanceId,
    }),
    fetchFn: fetchSprintComments,
    saveFn: (sprintId, data, isUpdate = false) => {
      return apiSaveComment(sprintId, {
        id: data.id,
        assigneeId: data.assigneeId,
        text: data.text,
        taskId: data.taskId ?? null,
        x: data.x,
        y: data.y,
        day: data.day,
        part: data.part,
        width: data.width,
        height: data.height,
      }, isUpdate);
    },
    deleteFn: apiDeleteComment,
    getId: (comment) => comment.id,
    toApiFormat: (comment, isUpdate) => ({
      id: isUpdate && comment.id ? comment.id : comment.id ?? '',
      assigneeId: comment.assigneeId,
      text: comment.text,
      taskId: comment.taskId ?? null,
      x: comment.x || null,
      y: comment.y || null,
      day: comment.day || null,
      part: comment.part || null,
      width: comment.width,
      height: comment.height,
    }),
  });

  return [comments, setCommentsWithSave, saveCommentLocal, deleteCommentLocal];
}

// ==================== Хук порядка занятости ====================

/**
 * Порядок строк «Занятость» на спринт: один документ в API, дебаунс сохранения.
 * Не использовать `useDebouncedApiSync` — там модель «массив элементов + save/delete по id».
 */
export function useOccupancyTaskOrderApi(sprintId: number | null): [
  OccupancyTaskOrder | undefined,
  (updater: (prev: OccupancyTaskOrder | undefined) => OccupancyTaskOrder) => void
] {
  const [taskOrder, setTaskOrderState] = useState<OccupancyTaskOrder | undefined>(undefined);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<OccupancyTaskOrder | null>(null);

  // Загрузка при изменении спринта
  useEffect(() => {
    if (!isValidSprintId(sprintId)) {
      queueMicrotask(() => setTaskOrderState(undefined));
      return;
    }

    let cancelled = false;
    fetchOccupancyTaskOrder(sprintId!)
      .then((order) => {
        if (!cancelled) {
          setTaskOrderState(order ?? undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error loading occupancy task order:', error);
          setTaskOrderState(undefined);
        }
      });

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [sprintId]);

  const setTaskOrder = (updater: (prev: OccupancyTaskOrder | undefined) => OccupancyTaskOrder) => {
    if (!isValidSprintId(sprintId)) return;

    setTaskOrderState((prev) => {
      const next = updater(prev);
      pendingOrderRef.current = next;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        saveTimerRef.current = null;
        const toSave = pendingOrderRef.current;
        if (toSave && isValidSprintId(sprintId)) {
          try {
            await saveOccupancyTaskOrder(sprintId!, toSave);
          } catch (error) {
            console.error('Error saving occupancy task order:', error);
          }
        }
      }, DELAYS.DEBOUNCE);

      return next;
    });
  };

  return [taskOrder, setTaskOrder];
}

export type { GetTaskInfoFn } from './useTaskPositionsApi';
export { useTaskPositionsApi } from './useTaskPositionsApi';
