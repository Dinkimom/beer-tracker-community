import type { CSSProperties } from 'react';

interface OccupancyPhaseBarDimmedBackgroundProps {
  estimatedPercent: number;
  extraPercent: number;
  isQa: boolean;
  phaseFillClass: string;
  qaBaseColor?: string;
  qaStripedStyle?: CSSProperties;
  showExtraPlanDuration: boolean;
}

export function OccupancyPhaseBarDimmedBackground({
  showExtraPlanDuration,
  isQa,
  qaStripedStyle,
  qaBaseColor,
  estimatedPercent,
  extraPercent,
  phaseFillClass,
}: OccupancyPhaseBarDimmedBackgroundProps) {
  if (showExtraPlanDuration && isQa && qaStripedStyle && qaBaseColor) {
    return (
      <>
        <div
          className="absolute left-0 top-0 bottom-0 rounded-l-lg"
          style={{ width: `${estimatedPercent}%`, ...qaStripedStyle }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 rounded-r-lg"
          style={{
            width: `${extraPercent}%`,
            backgroundColor: qaBaseColor,
          }}
        />
      </>
    );
  }

  if (showExtraPlanDuration && !isQa) {
    return <div className={`absolute inset-0 rounded-lg ${phaseFillClass}`} />;
  }

  return (
    <div
      className={`absolute inset-0 rounded-lg ${qaStripedStyle ? '' : phaseFillClass}`}
      style={qaStripedStyle ?? undefined}
    />
  );
}
