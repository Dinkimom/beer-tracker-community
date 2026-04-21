/**
 * Хук для управления изменением размера TaskBar
 */

import { useState, useEffect } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';

interface UseTaskBarResizeProps {
  duration: number;
  /** Всего ячеек в таймлайне свимлейна */
  timelineTotalCells?: number;
  onResize: (params: { newDuration: number; newStartCell?: number }) => void;
}

export function useTaskBarResize({
  duration,
  onResize,
  timelineTotalCells = WORKING_DAYS * PARTS_PER_DAY,
}: UseTaskBarResizeProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizePreviewDuration, setResizePreviewDuration] = useState<number | null>(null);
  const [resizePreviewStartCell, setResizePreviewStartCell] = useState<number | null>(null);
  const [isHoveringResizeHandle, setIsHoveringResizeHandle] = useState(false);
  const [isHoveringLeftResizeHandle, setIsHoveringLeftResizeHandle] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeSide(side);

    const cardElement = e.currentTarget.closest('[data-task-id]') as HTMLElement;
    if (!cardElement) return;

    const container = cardElement.closest('[data-swimlane]') as HTMLElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    const totalCells = Math.max(PARTS_PER_DAY, timelineTotalCells);
    const cellWidth = containerRect.width / totalCells;

    const cardLeftX = cardRect.left - containerRect.left;
    const cardWidth = cardRect.width;

    const currentStartCellIndex = Math.max(
      0,
      Math.min(totalCells - 1, Math.floor(cardLeftX / cellWidth))
    );
    const cardRightX = cardLeftX + cardWidth;
    const currentEndCellIndex = Math.max(
      currentStartCellIndex,
      Math.min(totalCells - 1, Math.ceil(cardRightX / cellWidth) - 1)
    );

    let currentPreviewDuration = duration;
    let currentPreviewStartCell = currentStartCellIndex;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const mouseX = moveEvent.clientX - containerRect.left;
      const targetCellIndex = Math.max(0, Math.min(totalCells - 1, Math.floor(mouseX / cellWidth)));

      if (side === 'right') {
        // При изменении справа: конечная ячейка должна быть не меньше начальной
        // Длительность = конечная ячейка - начальная ячейка + 1
        const newEndCellIndex = Math.max(currentStartCellIndex, targetCellIndex);
        const newDuration = Math.max(1, newEndCellIndex - currentStartCellIndex + 1);
        const finalDuration = Math.min(newDuration, totalCells - currentStartCellIndex);

        currentPreviewDuration = finalDuration;
        setResizePreviewDuration(finalDuration);
        setResizePreviewStartCell(null);
      } else {
        // При изменении слева: сохраняем конечную позицию (currentEndCellIndex)
        // Новая начальная позиция не должна быть больше текущей конечной
        const newStartCellIndex = Math.min(currentEndCellIndex, targetCellIndex);
        const finalStartCell = Math.max(0, newStartCellIndex);
        // Длительность = конечная ячейка - новая начальная ячейка + 1
        // Это сохраняет конечную позицию задачи
        const finalDuration = Math.max(1, currentEndCellIndex - finalStartCell + 1);

        currentPreviewStartCell = finalStartCell;
        currentPreviewDuration = finalDuration;
        setResizePreviewStartCell(finalStartCell);
        setResizePreviewDuration(finalDuration);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeSide(null);

      const durationChanged = currentPreviewDuration !== duration;
      const startChanged = side === 'left' && currentPreviewStartCell !== currentStartCellIndex;

      if (durationChanged || startChanged) {
        onResize({
          newDuration: currentPreviewDuration,
          newStartCell: side === 'left' ? currentPreviewStartCell : undefined,
        });
      }

      setResizePreviewDuration(null);
      setResizePreviewStartCell(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return {
    isResizing,
    resizePreviewDuration,
    resizePreviewStartCell,
    isHoveringResizeHandle,
    setIsHoveringResizeHandle,
    isHoveringLeftResizeHandle,
    setIsHoveringLeftResizeHandle,
    resizeSide,
    handleResizeStart,
  };
}

