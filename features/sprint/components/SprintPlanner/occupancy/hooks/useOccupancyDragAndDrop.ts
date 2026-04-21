import type { FlattenedRow } from '../utils/buildFlattenedRows';
import type { OccupancyTaskOrder } from '@/lib/beerTrackerApi';
import type { DragEndEvent } from '@dnd-kit/core';

import { useCallback, useMemo } from 'react';

export function useOccupancyDragAndDrop({
  visibleRows,
  onTaskOrderChange,
}: {
  visibleRows: FlattenedRow[];
  onTaskOrderChange?: (order: OccupancyTaskOrder) => void;
}) {
  const getRowId = useCallback((row: FlattenedRow): string => {
    if (row.type === 'parent') return `parent:${row.id}`;
    return `task:${row.task.id}`;
  }, []);

  const sortableRowIds = useMemo(() => {
    return visibleRows.map(getRowId);
  }, [visibleRows, getRowId]);

  const handleOccupancyDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onTaskOrderChange) return;

      const activeStr = String(active.id);
      const overStr = String(over.id);
      const activeIsParent = activeStr.startsWith('parent:');
      const overIsParent = overStr.startsWith('parent:');
      const activeId = activeIsParent ? activeStr.slice(7) : activeStr.slice(5);
      const overId = overIsParent ? overStr.slice(7) : overStr.slice(5);

      const currentParentIds = visibleRows
        .filter((r): r is Extract<typeof r, { type: 'parent' }> => r.type === 'parent')
        .map((r) => r.id);
      const currentTaskOrders: Record<string, string[]> = {};
      let currentParent: string | '__root__' = '__root__';
      visibleRows.forEach((r) => {
        if (r.type === 'parent') {
          currentParent = r.id;
          currentTaskOrders[currentParent] = [];
        } else {
          (currentTaskOrders[currentParent] ??= []).push(r.task.id);
        }
      });

      const baseOrder: OccupancyTaskOrder = {
        parentIds: currentParentIds,
        taskOrders: currentTaskOrders,
      };

      if (activeIsParent && overIsParent) {
        const idxA = currentParentIds.indexOf(activeId);
        const idxB = currentParentIds.indexOf(overId);
        if (idxA === -1 || idxB === -1) return;
        const next = [...currentParentIds];
        const [moved] = next.splice(idxA, 1);
        next.splice(idxB, 0, moved);
        onTaskOrderChange({ ...baseOrder, parentIds: next });
        return;
      }

      if (!activeIsParent && !overIsParent) {
        const parentOf = (taskId: string) => {
          let p: string | '__root__' = '__root__';
          for (const r of visibleRows) {
            if (r.type === 'parent') p = r.id;
            else if (r.task.id === taskId) return p;
          }
          return p;
        };
        const pActive = parentOf(activeId);
        const pOver = parentOf(overId);
        if (pActive !== pOver) return;
        const order = currentTaskOrders[pActive] ?? [];
        const idxA = order.indexOf(activeId);
        const idxB = order.indexOf(overId);
        if (idxA === -1 || idxB === -1) return;
        const next = [...order];
        const [moved] = next.splice(idxA, 1);
        next.splice(idxB, 0, moved);
        onTaskOrderChange({
          ...baseOrder,
          taskOrders: { ...currentTaskOrders, [pActive]: next },
        });
      }
    },
    [visibleRows, onTaskOrderChange]
  );

  return {
    getRowId,
    sortableRowIds,
    handleOccupancyDragEnd,
  };
}
