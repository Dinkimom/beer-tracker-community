import React from 'react';

interface OccupancyPhaseDragSourceGhostProps {
  barHeightPx: number;
  barTopOffsetPx: number;
  barZIndex: number;
  endCell: number;
  planRowInsetPx: number;
  resolvedTotalParts: number;
  startCell: number;
}

export function OccupancyPhaseDragSourceGhost({
  barHeightPx,
  barTopOffsetPx,
  barZIndex,
  resolvedTotalParts,
  startCell,
  endCell,
  planRowInsetPx,
}: OccupancyPhaseDragSourceGhostProps) {
  const leftPercent = (startCell / resolvedTotalParts) * 100;
  const rightPercent = ((resolvedTotalParts - endCell) / resolvedTotalParts) * 100;

  return (
    <div
      aria-hidden
      className="absolute rounded-lg border-2 border-dashed border-gray-400/70 dark:border-white/30 bg-transparent pointer-events-none"
      style={{
        left: `calc(${leftPercent}% + ${planRowInsetPx}px)`,
        right: `calc(${rightPercent}% + ${planRowInsetPx}px)`,
        height: barHeightPx,
        opacity: 0.9,
        top: barTopOffsetPx,
        zIndex: Math.max(0, barZIndex - 1),
      }}
    />
  );
}

