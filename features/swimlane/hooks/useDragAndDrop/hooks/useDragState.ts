/**
 * Превью DnD свимлейна: React state + ref для синхронных чтений в обработчиках dnd-kit.
 *
 * Перфоманс: `setHoveredCell` не вызывает setState, если ячейка та же (`areCellPositionsEqual`);
 * `beginDragSession` — один setState на старт вместо трёх.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  areCellPositionsEqual,
  type CellPosition,
  type SwimlaneDragStateApi,
} from '@/lib/layers/application/swimlaneDrag';

export interface DragUiSnapshot {
  activeDraggableId: string | null;
  activeTaskId: string | null;
  hoveredCell: CellPosition | null;
  isDraggingTask: boolean;
}

function emptyDragUi(): DragUiSnapshot {
  return {
    activeDraggableId: null,
    activeTaskId: null,
    hoveredCell: null,
    isDraggingTask: false,
  };
}

export function useDragState(taskPositionsSize: number): {
  dragUi: DragUiSnapshot;
  dragStateApi: SwimlaneDragStateApi;
} {
  const snapshotRef = useRef<DragUiSnapshot>(emptyDragUi());
  const [dragUi, setDragUi] = useState<DragUiSnapshot>(() => emptyDragUi());
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  const resetDragState = useCallback(() => {
    const next = emptyDragUi();
    snapshotRef.current = next;
    mousePositionRef.current = null;
    setDragUi(next);
  }, []);

  const beginDragSession = useCallback((activeDraggableId: string, activeTaskId: string) => {
    setDragUi((prev) => {
      const next: DragUiSnapshot = {
        ...prev,
        activeDraggableId,
        activeTaskId,
        isDraggingTask: true,
        hoveredCell: null,
      };
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const setHoveredCell = useCallback((cell: CellPosition | null) => {
    setDragUi((prev) => {
      if (areCellPositionsEqual(prev.hoveredCell, cell)) {
        return prev;
      }
      const next = { ...prev, hoveredCell: cell };
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const dragStateApi = useMemo<SwimlaneDragStateApi>(
    () => ({
      get activeDraggableId() {
        return snapshotRef.current.activeDraggableId;
      },
      get activeTaskId() {
        return snapshotRef.current.activeTaskId;
      },
      get hoveredCell() {
        return snapshotRef.current.hoveredCell;
      },
      get isDraggingTask() {
        return snapshotRef.current.isDraggingTask;
      },
      mousePositionRef,
      resetDragState,
      beginDragSession,
      setHoveredCell,
    }),
    [resetDragState, beginDragSession, setHoveredCell],
  );

  useEffect(() => {
    const isEmpty = taskPositionsSize === 0;
    if (isEmpty && !dragUi.isDraggingTask && (dragUi.activeTaskId !== null || dragUi.hoveredCell !== null)) {
      setTimeout(() => {
        resetDragState();
      }, 0);
    }
  }, [taskPositionsSize, dragUi.isDraggingTask, dragUi.activeTaskId, dragUi.hoveredCell, resetDragState]);

  useEffect(() => {
    if (!dragUi.isDraggingTask) {
      mousePositionRef.current = null;
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragUi.isDraggingTask]);

  return { dragUi, dragStateApi };
}
