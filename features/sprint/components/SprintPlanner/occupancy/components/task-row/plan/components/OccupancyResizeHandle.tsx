'use client';

import { ZIndex } from '@/constants';

interface OccupancyResizeHandleProps {
  /** Узкая полоса фазы (компактные строки занятости) — короткие засечки, чтобы не вылезали за высоту фазы */
  compact?: boolean;
  handleColors: {
    bg: string;
    bgDark: string;
    line: string;
    lineDark: string;
  };
  isActive: boolean;
  isHovering: boolean;
  side: 'left' | 'right';
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** Ручка ресайза по краю полосы — цвета как в карточке задачи (TaskBarResizeHandle) */
export function OccupancyResizeHandle({
  handleColors,
  isActive,
  isHovering,
  compact = false,
  side,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: OccupancyResizeHandleProps) {
  const showGrip = isHovering || isActive;
  const hoverBgClass = handleColors.bg.replace('/60', '/20');
  const hoverBgClassDark = handleColors.bgDark
    ? handleColors.bgDark.replace('/60', '/20')
    : '';
  const isActiveClass = isActive
    ? `${handleColors.bg} ${handleColors.bgDark}`
    : `${hoverBgClass} ${hoverBgClassDark}`;

  const hitW = compact ? 'w-4' : 'w-5';
  const gripOffset = compact ? (side === 'left' ? 'left-0.5' : 'right-0.5') : side === 'left' ? 'left-1' : 'right-1';

  if (!showGrip) {
    return (
      <div
        className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 ${hitW} ${ZIndex.class('stickyElevated')}`}
        style={{ pointerEvents: 'auto' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return (
    <div
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 ${hitW} cursor-ew-resize group ${ZIndex.class('arrowsHovered')} transition-opacity ${isActiveClass}`}
      style={{ touchAction: 'none', pointerEvents: 'auto' }}
      title={
        side === 'right'
          ? 'Изменить длительность (перетащите вправо)'
          : 'Изменить начало (перетащите влево)'
      }
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={`absolute ${gripOffset} top-1/2 -translate-y-1/2 flex flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            className={`w-0.5 rounded transition-all ${compact ? 'h-2' : 'h-3'} ${
              isActive
                ? `${handleColors.line} ${handleColors.lineDark}`
                : `${handleColors.line} ${handleColors.lineDark} opacity-40 group-hover:opacity-100`
            }`}
          />
        ))}
      </div>
    </div>
  );
}
