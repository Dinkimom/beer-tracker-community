/**
 * Компонент ручки изменения размера TaskBar
 */

'use client';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { useI18n } from '@/contexts/LanguageContext';
import { ZIndex } from '@/constants';
import { getResizeHandleColors } from '@/utils/statusColors';

interface TaskBarResizeHandleProps {
  isHovering: boolean;
  isQATask: boolean;
  isResizing: boolean;
  originalStatus?: string;
  resizeSide: 'left' | 'right' | null;
  side: 'left' | 'right';
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function TaskBarResizeHandle({
  isHovering,
  isResizing,
  isQATask,
  originalStatus,
  resizeSide,
  side,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: TaskBarResizeHandleProps) {
  const { t } = useI18n();
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const resizeHandleColors = getResizeHandleColors(
    originalStatus,
    isQATask,
    phaseCardColorScheme
  );
  const hoverBgClass = resizeHandleColors.bg.replace('/60', '/20');
  const hoverBgClassDark = resizeHandleColors.bgDark ? resizeHandleColors.bgDark.replace('/60', '/20') : '';
  const isActive = isResizing && resizeSide === side;

  if (!isHovering && !isActive) {
    return (
      <div
        className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-6 ${ZIndex.class('stickyElevated')}`}
        // Inline zIndex: гарантирует корректное наложение в swimlane,
        // т.к. z-[...] классы иногда не попадают в Tailwind build.
        style={{ pointerEvents: 'auto', zIndex: ZIndex.value('stickyElevated') }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  return (
    <div
      className={`absolute ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-6 cursor-ew-resize group ${ZIndex.class('arrowsHovered')} transition-opacity`}
      // Inline zIndex: гарантирует корректное наложение в swimlane.
      style={{
        touchAction: 'none',
        pointerEvents: 'auto',
        zIndex: ZIndex.value('arrowsHovered'),
      }}
      title={
        side === 'right'
          ? t('task.taskBar.resizeRightTitle')
          : t('task.taskBar.resizeLeftTitle')
      }
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={`absolute inset-0 ${side === 'left' ? 'rounded-l' : 'rounded-r'} transition-all ${
          isActive
            ? `${resizeHandleColors.bg} ${resizeHandleColors.bgDark}`
            : `${hoverBgClass} ${hoverBgClassDark}`
        }`}
      />

      <div className={`absolute ${side === 'left' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 flex flex-col gap-0.5`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-0.5 h-3 rounded transition-all ${
              isActive
                ? `${resizeHandleColors.line} ${resizeHandleColors.lineDark}`
                : `${resizeHandleColors.line} ${resizeHandleColors.lineDark} opacity-40 group-hover:opacity-100`
            }`}
          />
        ))}
      </div>

      <div className={`absolute inset-0 ${side === 'left' ? '-left-2' : '-right-2'}`} />
    </div>
  );
}

