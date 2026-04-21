'use client';

import { useEffect, useRef } from 'react';

import { ZIndex } from '@/constants';
import { useResize } from '@/features/sidebar/hooks/useResize';

import { SidebarResizeHandle } from './SidebarResizeHandle';

interface ResizableSidebarProps {
  /**
   * Содержимое сайдбара
   */
  children: React.ReactNode;
  /**
   * Дополнительные классы для контейнера сайдбара
   */
  className?: string;
  /**
   * Дополнительные классы для контента сайдбара
   */
  contentClassName?: string;
  /**
   * Дополнительные элементы в заголовке (например, кнопки)
   */
  headerActions?: React.ReactNode;
  /**
   * Открыт ли сайдбар (для управления видимостью)
   */
  isOpen?: boolean;
  /**
   * Максимальная ширина
   * @default 800
   */
  maxWidth?: number;
  /**
   * Минимальная ширина
   * @default 250
   */
  minWidth?: number;
  /**
   * С какой стороны находится resize handle
   * @default 'left'
   */
  resizeHandleSide?: 'left' | 'right';
  /**
   * Дополнительные стили для контейнера сайдбара
   */
  style?: React.CSSProperties;
  /**
   * Заголовок сайдбара (отображается в верхней части)
   */
  title?: string;
  /**
   * Текущая ширина сайдбара
   */
  width: number;
  /**
   * Функция для вычисления ширины на основе позиции мыши
   * Если не указана, используется стандартная логика для правого сайдбара
   */
  calculateWidth?: (event: MouseEvent) => number;
  /**
   * Ref для контейнера сайдбара (например, для droppable)
   */
  containerRef?: (el: HTMLDivElement | null) => void;
  /**
   * Callback для переключения состояния открыт/закрыт
   */
  onToggle?: () => void;
  /**
   * Callback при изменении ширины
   */
  onWidthChange?: (width: number) => void;
}

/**
 * Переиспользуемая компонента сайдбара с поддержкой resize
 */
export function ResizableSidebar({
  children,
  width,
  onWidthChange,
  minWidth = 250,
  maxWidth = 800,
  resizeHandleSide = 'left',
  calculateWidth,
  isOpen = true,
  onToggle,
  className = '',
  style,
  containerRef,
  contentClassName = '',
  title,
  headerActions,
}: ResizableSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const wasOpenOnResizeStart = useRef<boolean>(isOpen);

  // Порог для закрытия сайдбара при перетаскивании
  const closeThreshold = Math.min(minWidth / 2, 50);

  // Функция для вычисления ширины
  const defaultCalculateWidth = (e: MouseEvent) => {
    if (resizeHandleSide === 'left') {
      // Для сайдбара справа с handle слева
      return window.innerWidth - e.clientX;
    } else {
      // Для сайдбара слева с handle справа
      return e.clientX;
    }
  };

  // Обработчик завершения ресайза
  const handleResizeEnd = (finalWidth: number) => {
    if (!wasOpenOnResizeStart.current) {
      if (onWidthChange && finalWidth > 0) {
        onWidthChange(Math.max(finalWidth, minWidth));
      }
    } else {
      if (finalWidth < closeThreshold && onToggle) {
        onToggle();
      } else if (onWidthChange) {
        onWidthChange(Math.max(finalWidth, minWidth));
      }
    }
  };

  const { isResizing, setIsResizing } = useResize({
    calculateValue: calculateWidth || defaultCalculateWidth,
    onValueChange: (newWidth) => {
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
      if (!isOpen && newWidth > 0 && onToggle) {
        onToggle();
      }
    },
    onResizeEnd: handleResizeEnd,
    min: 0, // Разрешаем перетаскивание до нуля
    max: maxWidth,
    clamp: true,
  });

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  const handleRef = (el: HTMLDivElement | null) => {
    sidebarRef.current = el;
    if (containerRef) {
      containerRef(el);
    }
  };

  const baseClasses = 'relative border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col self-stretch';
  const combinedClassName = `${baseClasses} ${className}`.trim();

  return (
    <>
      {/* Resize handle (всегда видимый, даже когда сайдбар закрыт) */}
      {!isOpen && (
        <div
          className={`absolute top-0 bottom-0 ${resizeHandleSide === 'left' ? 'right-0' : 'left-0'} w-1.5 ${ZIndex.class('stickyLeftColumn')}`}
          style={{
            [resizeHandleSide === 'left' ? 'right' : 'left']: '0px',
          }}
        >
          <SidebarResizeHandle
            isResizing={isResizing}
            linesCount={3}
            side={resizeHandleSide}
            onMouseDown={(e) => {
              e.preventDefault();
              wasOpenOnResizeStart.current = isOpen;
              setIsResizing(true);
            }}
          />
        </div>
      )}

      {/* Сайдбар */}
      {isOpen && (
        <div
          ref={handleRef}
          className={combinedClassName}
          style={{
            width: `${width}px`,
            minWidth: `${minWidth}px`,
            ...style,
          }}
        >
          {/* Resize handle */}
          <SidebarResizeHandle
            isResizing={isResizing}
            linesCount={3}
            side={resizeHandleSide}
            onMouseDown={(e) => {
              e.preventDefault();
              wasOpenOnResizeStart.current = isOpen;
              setIsResizing(true);
            }}
          />

          {/* Заголовок сайдбара */}
          {(title || headerActions) && (
            <div className={`relative flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${title ? 'px-5 py-2.5' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                {title && (
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </h3>
                )}
                {!title && headerActions && (
                  <div className="flex-1 w-full">
                    {headerActions}
                  </div>
                )}
                {title && (
                  <div className="flex items-center gap-2">
                    {headerActions}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Контент сайдбара */}
          <div className={`flex-1 min-h-0 ${contentClassName}`.trim()}>
            {children}
          </div>
        </div>
      )}

    </>
  );
}

