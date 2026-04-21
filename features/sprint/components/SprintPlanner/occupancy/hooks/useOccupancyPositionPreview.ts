import type { PositionPreview } from '../components/task-row/plan/OccupancyPhaseBar';
import type { TaskPosition } from '@/types';

import { useCallback, useEffect, useState, startTransition } from 'react';

export function useOccupancyPositionPreview(taskPositions: Map<string, TaskPosition>) {
  const [positionPreviews, setPositionPreviews] = useState<Map<string, PositionPreview>>(
    new Map()
  );

  const handlePositionPreview = useCallback((taskId: string, preview: PositionPreview | null) => {
    setPositionPreviews((prev) => {
      const next = new Map(prev);
      if (preview === null) next.delete(taskId);
      else next.set(taskId, preview);
      return next;
    });
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPositionPreviews((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Map(prev);
        for (const [taskId, preview] of next) {
          const saved = taskPositions.get(taskId);
          if (
            saved &&
            saved.startDay === preview.startDay &&
            saved.startPart === preview.startPart &&
            saved.duration === preview.duration
          ) {
            next.delete(taskId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }, [taskPositions]);

  return {
    positionPreviews,
    handlePositionPreview,
  };
}
