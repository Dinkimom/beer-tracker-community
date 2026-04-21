/**
 * Хук для обработчиков комментариев в SprintPlanner
 */

import type { Comment as CommentType } from '@/types';

import { useCallback } from 'react';

interface UseSprintPlannerCommentHandlersProps {
  selectedSprintId: number | null;
  deleteComment: (commentId: string) => Promise<void>;
  setComments: (updater: (prev: CommentType[]) => CommentType[]) => void;
}

export function useSprintPlannerCommentHandlers({
  setComments,
  deleteComment,
  selectedSprintId,
}: UseSprintPlannerCommentHandlersProps) {
  const handleCommentCreate = useCallback(
    (comment: CommentType) => {
      setComments((prev: CommentType[]) => [...prev, comment]);
    },
    [setComments]
  );

  const handleCommentDelete = useCallback(
    (id: string) => {
      // Обновляем локальное состояние сразу (оптимистичное обновление)
      setComments((prev: CommentType[]) => prev.filter((c: CommentType) => c.id !== id));
      // Отправляем запрос на удаление через API
      if (selectedSprintId) {
        deleteComment(id).catch((error) => {
          console.error('Error deleting comment:', error);
        });
      }
    },
    [setComments, deleteComment, selectedSprintId]
  );

  const handleCommentPositionUpdate = useCallback(
    (id: string, x: number, y: number, assigneeId?: string) => {
      setComments((prev: CommentType[]) =>
        prev.map((c: CommentType) => (c.id === id ? { ...c, x, y, ...(assigneeId && { assigneeId }) } : c))
      );
    },
    [setComments]
  );

  /** Перемещение заметки в другую ячейку/строку (day, part, taskId, assigneeId, x, y) */
  const handleCommentMove = useCallback(
    (
      id: string,
      payload: Partial<{
        assigneeId: string;
        day: number;
        part: number;
        taskId: string | null;
        x: number;
        y: number;
      }>
    ) => {
      setComments((prev: CommentType[]) =>
        prev.map((c: CommentType) => (c.id === id ? { ...c, ...payload } : c))
      );
    },
    [setComments]
  );

  const handleCommentUpdate = useCallback(
    (id: string, text: string) => {
      setComments((prev: CommentType[]) =>
        prev.map((c: CommentType) => (c.id === id ? { ...c, text } : c))
      );
    },
    [setComments]
  );

  return {
    handleCommentCreate,
    handleCommentDelete,
    handleCommentMove,
    handleCommentPositionUpdate,
    handleCommentUpdate,
  };
}

