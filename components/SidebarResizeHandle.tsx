'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

interface SidebarResizeHandleProps {
  /**
   * Высота колонки для ограничения высоты рукоятки
   * Используется только если fixedIconInViewport === true
   */
  columnHeight?: number;
  /**
   * Левая позиция колонки для расчета позиции fixed иконки
   * Используется только если fixedIconInViewport === true
   */
  columnLeft?: number;
  /**
   * Верхняя позиция колонки для ограничения высоты рукоятки
   * Используется только если fixedIconInViewport === true
   */
  columnTop?: number;
  /**
   * Ширина колонки для расчета позиции fixed иконки
   * Используется только если fixedIconInViewport === true и side === 'right'
   */
  columnWidth?: number;
  /**
   * Зафиксировать иконку по центру вьюпорта по вертикали
   * @default false
   */
  fixedIconInViewport?: boolean;
  /**
   * Активен ли процесс ресайза
   */
  isResizing?: boolean;
  /**
   * Количество линий в индикаторе
   * @default 3
   */
  linesCount?: 2 | 3;
  /**
   * С какой стороны находится resize handle
   * @default 'left'
   */
  side?: 'left' | 'right';
  /**
   * Текст подсказки
   */
  title?: string;
  /**
   * Обработчик начала ресайза
   */
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Переиспользуемый компонент для resize handle сайдбара
 */
export function SidebarResizeHandle({
  side = 'left',
  isResizing = false,
  onMouseDown,
  title: titleProp,
  linesCount = 3,
  fixedIconInViewport = false,
  columnHeight,
  columnLeft,
  columnTop,
  columnWidth,
}: SidebarResizeHandleProps) {
  const { t } = useI18n();
  const title = titleProp ?? t('common.resizePanelWidth');
  const positionClass = side === 'left' ? 'left-0' : 'right-0';
  const translateClass = side === 'left' ? '-translate-x-1/2' : 'translate-x-1/2';

  const HANDLE_WIDTH = 6;
  const HANDLE_CENTER_OFFSET = HANDLE_WIDTH / 2;

  const [mounted] = useState(() => typeof document !== 'undefined');
  const [handlePosition, setHandlePosition] = useState<{ left: number; centerX: number } | null>(null);

  useEffect(() => {
    if (!fixedIconInViewport) return;

    const updatePosition = () => {
      if (side === 'right' && columnLeft !== undefined && columnWidth !== undefined) {
        const handleLeft = columnLeft + columnWidth - HANDLE_WIDTH;
        const handleCenterX = columnLeft + columnWidth - HANDLE_CENTER_OFFSET;
        setHandlePosition({ left: handleLeft, centerX: handleCenterX });
      } else if (side === 'left' && columnLeft !== undefined) {
        const handleLeft = columnLeft;
        const handleCenterX = columnLeft + HANDLE_CENTER_OFFSET;
        setHandlePosition({ left: handleLeft, centerX: handleCenterX });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
    // HANDLE_WIDTH и HANDLE_CENTER_OFFSET - константы, не требуют включения в зависимости
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedIconInViewport, side, columnLeft, columnWidth, columnTop, columnHeight]);

  let iconPositionStyle: React.CSSProperties | undefined;
  let handlePositionStyle: React.CSSProperties | undefined;

  if (fixedIconInViewport && handlePosition) {
    // Позиция иконки - центр рукоятки (иконка центрируется через translateX(-50%))
    iconPositionStyle = {
      left: `${handlePosition.centerX}px`,
      top: '50vh',
      transform: 'translateX(-50%) translateY(-50%)',
      zIndex: ZIndex.sidebarResize,
    };

    // Делаем саму рукоятку fixed, чтобы она не скроллилась
    // Ограничиваем высоту рукоятки высотой колонки
    if (columnTop !== undefined && columnHeight !== undefined) {
      handlePositionStyle = {
        position: 'fixed',
        left: `${handlePosition.left}px`,
        top: `${columnTop}px`,
        height: `${columnHeight}px`,
        width: `${HANDLE_WIDTH}px`,
      };
    } else {
      handlePositionStyle = {
        position: 'fixed',
        left: `${handlePosition.left}px`,
        top: '0',
        bottom: '0',
        width: `${HANDLE_WIDTH}px`,
      };
    }
  }

  // Иконка для портала (только когда fixed и mounted)
  const iconElement = fixedIconInViewport && mounted && iconPositionStyle ? (
    <div
      className="fixed flex flex-col gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-200 cursor-col-resize pointer-events-none"
      style={iconPositionStyle}
    >
      {Array.from({ length: linesCount }, (_, i) => (
        <div
          key={`line-${i}`}
          className={`w-0.5 ${linesCount === 3 ? 'h-5' : 'h-4'} rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-600 transition-colors duration-200`}
        />
      ))}
    </div>
  ) : null;

  return (
    <div
      className={`${fixedIconInViewport ? '' : `absolute top-0 bottom-0 ${positionClass}`} w-1.5 cursor-col-resize ${fixedIconInViewport ? ZIndex.class('stickyLeftColumn') : ZIndex.class('stickyElevated')} group ${
        isResizing ? 'bg-blue-500' : ''
      }`}
      style={handlePositionStyle}
      title={title}
      onMouseDown={onMouseDown}
    >
      {/* Фон при наведении */}
      <div className="absolute inset-0 bg-transparent group-hover:bg-blue-100/60 dark:group-hover:bg-blue-900/40 transition-colors duration-200 cursor-col-resize" />

      {/* Визуальный индикатор - вертикальные линии */}
      {!fixedIconInViewport && (
        <div
          className={`absolute ${side === 'left' ? 'left-1/2' : 'right-1/2'} top-1/2 ${translateClass} -translate-y-1/2 flex flex-col gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-200 cursor-col-resize pointer-events-none`}
        >
          {Array.from({ length: linesCount }, (_, i) => (
            <div
              key={`line-${i}`}
              className={`w-0.5 ${linesCount === 3 ? 'h-5' : 'h-4'} rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-600 transition-colors duration-200`}
            />
          ))}
        </div>
      )}

      {/* Иконка через портал для fixed режима */}
      {mounted && iconElement && createPortal(iconElement, document.body)}
    </div>
  );
}

