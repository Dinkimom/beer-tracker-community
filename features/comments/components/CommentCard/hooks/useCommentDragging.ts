/**
 * Хук для управления перетаскиванием комментария
 */

import type { Comment } from '@/types';

import { useState, useEffect } from 'react';

interface UseCommentDraggingProps {
  comment: Comment;
  isEditing: boolean;
  onPositionUpdate: (id: string, x: number, y: number, assigneeId?: string) => void;
}

export function useCommentDragging({
  comment,
  isEditing,
  onPositionUpdate,
}: UseCommentDraggingProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Обработка перетаскивания мышью с оптимизацией через requestAnimationFrame
  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;
    let lastUpdateTime = 0;
    const throttleDelay = 16; // ~60fps

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos) return;
      e.preventDefault();

      const now = performance.now();
      if (now - lastUpdateTime < throttleDelay) return;
      lastUpdateTime = now;

      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        // Находим все swimlanes
        // Используем document.querySelectorAll, так как swimlanes находятся в других компонентах
        const allSwimlanes = document.querySelectorAll(`[data-swimlane]`);
        let targetSwimlane: Element | null = null;
        let targetRect: DOMRect | null = null;

        // Определяем, над каким swimlane находится курсор (используем глобальные координаты)
        for (const swimlane of allSwimlanes) {
          const rect = swimlane.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            targetSwimlane = swimlane;
            targetRect = rect;
            break;
          }
        }

        if (targetRect && targetSwimlane && dragStartPos) {
          // Вычисляем новую позицию относительно найденного swimlane
          // Используем глобальные координаты курсора минус позицию swimlane и смещение от начала перетаскивания
          const newX = e.clientX - targetRect.left - dragStartPos.x;
          const newY = e.clientY - targetRect.top - dragStartPos.y;

          // Ограничиваем перемещение в пределах swimlane
          const maxX = targetRect.width - comment.width;
          const maxY = targetRect.height - comment.height;

          const finalX = Math.max(0, Math.min(newX, maxX));
          const finalY = Math.max(0, Math.min(newY, maxY));

          // Вычисляем смещение для визуального отображения
          // Если это другой swimlane, нужно пересчитать позицию относительно текущего swimlane комментария
          // Используем document.querySelector, так как swimlane находится в другом компоненте
          const currentSwimlane = document.querySelector(`[data-swimlane="${comment.assigneeId}"]`);
          if (currentSwimlane) {
            const currentRect = currentSwimlane.getBoundingClientRect();

            if (targetSwimlane !== currentSwimlane) {
              // Перемещаемся в другой swimlane
              // Вычисляем глобальную позицию комментария
              const globalCommentX = currentRect.left + comment.x;
              const globalCommentY = currentRect.top + comment.y;

              // Вычисляем новую глобальную позицию
              const newGlobalX = targetRect.left + finalX;
              const newGlobalY = targetRect.top + finalY;

              // Вычисляем смещение относительно текущего swimlane
              setDragOffset({
                x: newGlobalX - globalCommentX,
                y: newGlobalY - globalCommentY,
              });
            } else {
              // Позиция относительно текущего swimlane
              setDragOffset({
                x: finalX - comment.x,
                y: finalY - comment.y,
              });
            }
          }
        }
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);

      // Находим swimlane, над которым находится курсор в момент отпускания
      // Используем document.querySelectorAll, так как swimlanes находятся в других компонентах
      const allSwimlanes = document.querySelectorAll(`[data-swimlane]`);
      let targetSwimlane: Element | null = null;
      let targetRect: DOMRect | null = null;

      // Определяем, над каким swimlane находится курсор (используем глобальные координаты)
      for (const swimlane of allSwimlanes) {
        const rect = swimlane.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          targetSwimlane = swimlane;
          targetRect = rect;
          break;
        }
      }

      if (targetRect && targetSwimlane && dragStartPos) {
        // Вычисляем финальную позицию относительно найденного swimlane
        const finalX = e.clientX - targetRect.left - dragStartPos.x;
        const finalY = e.clientY - targetRect.top - dragStartPos.y;

        const maxX = targetRect.width - comment.width;
        const maxY = targetRect.height - comment.height;

        const clampedX = Math.max(0, Math.min(finalX, maxX));
        const clampedY = Math.max(0, Math.min(finalY, maxY));

        const newAssigneeId = targetSwimlane.getAttribute('data-swimlane')?.replace('swimlane-', '') || comment.assigneeId;

        onPositionUpdate(
          comment.id,
          clampedX,
          clampedY,
          newAssigneeId !== comment.assigneeId ? newAssigneeId : undefined
        );
      } else if (dragOffset) {
        // Fallback: если не нашли swimlane, обновляем позицию в текущем
        onPositionUpdate(
          comment.id,
          comment.x + dragOffset.x,
          comment.y + dragOffset.y
        );
      }

      setIsDragging(false);
      setDragStartPos(null);
      setDragOffset(null);
    };

    // Предотвращаем выделение текста при перетаскивании
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isDragging, dragStartPos, dragOffset, comment.id, comment.width, comment.height, comment.x, comment.y, comment.assigneeId, onPositionUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || e.detail === 2) return; // Не начинаем drag при двойном клике или редактировании

    e.preventDefault(); // Предотвращаем выделение текста
    e.stopPropagation();
    // Находим swimlane, в котором находится комментарий
    // Используем document.querySelector, так как swimlane находится в другом компоненте
    // и передача ref через пропсы/контекст была бы избыточной для этого случая
    const swimlaneElement = document.querySelector(`[data-swimlane="${comment.assigneeId}"]`);
    const swimlaneRect = swimlaneElement?.getBoundingClientRect();
    if (swimlaneRect) {
      setIsDragging(true);
      // Вычисляем смещение курсора относительно позиции комментария в его текущем swimlane
      setDragStartPos({
        x: e.clientX - swimlaneRect.left - comment.x,
        y: e.clientY - swimlaneRect.top - comment.y,
      });
    }
  };

  // Вычисляем текущую позицию с учетом drag offset
  const currentX = dragOffset ? comment.x + dragOffset.x : comment.x;
  const currentY = dragOffset ? comment.y + dragOffset.y : comment.y;

  return {
    isDragging,
    currentX,
    currentY,
    handleMouseDown,
  };
}

