/**
 * Хук для управления логикой DraggableTask
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

import { CARD_MARGIN, DEVELOPER_COLUMN_WIDTH, ZIndex } from '@/constants';
import { getWidthPercent } from '@/features/swimlane/utils/positionUtils';
import { useParticipantsColumnWidthStorage } from '@/hooks/useLocalStorage';

interface UseDraggableTaskProps {
  activeTaskDuration?: number | null;
  activeTaskId?: string | null;
  sidebarWidth?: number;
  taskId: string;
  viewMode?: 'compact' | 'full';
}

export function useDraggableTask({
  taskId,
  activeTaskId,
  activeTaskDuration,
  viewMode,
  sidebarWidth,
}: UseDraggableTaskProps) {
  const [participantsColumnWidth] = useParticipantsColumnWidthStorage(DEVELOPER_COLUMN_WIDTH);
  const [initialRect, setInitialRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: taskId,
    data: { source: 'sidebar' as const },
  });

  // Отслеживаем позицию мыши при перетаскивании
  useEffect(() => {
    if (!isDragging) {
      setMousePosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging]);

  // Сохраняем начальную позицию при начале перетаскивания
  useEffect(() => {
    if (isDragging && !initialRect) {
      const updateRect = () => {
        // Используем только ref, так как setNodeRef должен правильно устанавливать его
        const element = elementRef.current;
        if (element && element.isConnected) {
          // Проверяем, что элемент все еще в DOM
          // getBoundingClientRect возвращает позицию относительно viewport
          // Это правильно для position: fixed
          const rect = element.getBoundingClientRect();
          // Проверяем, что rect валидный (не все нули)
          if (rect.width > 0 || rect.height > 0) {
            setInitialRect({ left: rect.left, top: rect.top, width: rect.width });
            return true;
          }
        }
        return false;
      };

      // Пытаемся сразу
      if (!updateRect()) {
        // Если не получилось, пробуем через requestAnimationFrame
        const rafId = requestAnimationFrame(() => {
          updateRect();
        });
        return () => cancelAnimationFrame(rafId);
      }
    } else if (!isDragging) {
      // Очищаем состояние при остановке перетаскивания
      setInitialRect(null);
      setMouseOffset(null);
    }
  }, [isDragging, taskId, initialRect]);

  // Вычисляем ширину карточки
  const isActiveTask = activeTaskId === taskId;
  const widthPercent = useMemo(() => {
    return isActiveTask && activeTaskDuration !== null && activeTaskDuration !== undefined
      ? getWidthPercent(activeTaskDuration)
      : 10; // Маленькое значение для сайдбара
  }, [isActiveTask, activeTaskDuration]);

  // Используем state для принудительного обновления previewWidth при resize
  const [resizeTrigger, setResizeTrigger] = useState(0);

  // Вычисляем реальную ширину в пикселях для превью при перетаскивании
  // Важно: для карточек из сайдбара и бэклога не пересчитываем ширину - используем исходную
  const previewWidth = useMemo(() => {
    // Для компактного режима (бэклог) всегда используем исходную ширину
    if (viewMode === 'compact') {
      return undefined;
    }

    if (!isDragging || !isActiveTask || activeTaskDuration === null || activeTaskDuration === undefined) {
      return undefined;
    }

    // Если карточка из сайдбара (widthPercent === 10 - маленькое значение для сайдбара),
    // не пересчитываем ширину - используем исходную
    if (widthPercent === 10) {
      return undefined; // Используем исходную ширину из initialRect
    }

    try {
      // Пытаемся найти элемент свимлейна для вычисления его ширины
      // Используем document.querySelector, так как swimlane находится в другом компоненте
      const swimlaneElement = document.querySelector('[data-swimlane]') as HTMLElement | null;
      if (swimlaneElement) {
        const swimlaneRect = swimlaneElement.getBoundingClientRect();
        const swimlaneWidth = swimlaneRect.width;
        if (swimlaneWidth > 0) {
          const widthPercent = getWidthPercent(activeTaskDuration);
          // Вычисляем ширину в пикселях: widthPercent% от ширины свимлейна минус отступы
          return (swimlaneWidth * widthPercent / 100) - (CARD_MARGIN * 2);
        }
      }

      // Fallback: вычисляем на основе viewport
      const widthPercent = getWidthPercent(activeTaskDuration);
      if (viewMode === 'full') {
        // В режиме full ширина свимлейна = calc(200vw - participantsColumnWidth)
        const vw = window.innerWidth;
        const swimlaneWidth = (200 * vw / 100) - participantsColumnWidth - (sidebarWidth || 0) * 2;
        return Math.max(0, (swimlaneWidth * widthPercent / 100) - (CARD_MARGIN * 2));
      } else {
        // В режиме compact ширина свимлейна = 100% контейнера
        const containerWidth = window.innerWidth - (sidebarWidth || 0) - participantsColumnWidth;
        return Math.max(0, (containerWidth * widthPercent / 100) - (CARD_MARGIN * 2));
      }
    } catch (error) {
      // В случае ошибки возвращаем undefined, будет использован fallback
      console.warn('Error calculating preview width:', error);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, isActiveTask, activeTaskDuration, viewMode, sidebarWidth, participantsColumnWidth, resizeTrigger]);

  // Обновляем previewWidth при изменении размеров окна
  useEffect(() => {
    if (!isDragging || !isActiveTask) {
      return;
    }

    const handleResize = () => {
      setResizeTrigger(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isDragging, isActiveTask]);

  // Вычисляем стили для перетаскивания
  const style: React.CSSProperties = useMemo(() => {
    if (!isDragging) {
      return {
        transform: CSS.Translate.toString(transform),
      };
    }

    // Когда используется DragOverlay (спринт-планер: сайдбар и бэклог), не применяем position: fixed
    // к оригинальному элементу. Иначе dnd-kit измеряет уже смещённый узел и overlay = rect + transform
    // даёт двойное смещение — карточка уезжает (например вниз страницы). Оригинал остаётся на месте
    // (скрыт через opacity: 0), превью рисует DragOverlay по rect исходной позиции + transform.
    if (viewMode === 'compact' || viewMode === 'full') {
      return {
        transform: CSS.Translate.toString(transform),
      };
    }

    const width = previewWidth !== undefined ? previewWidth : initialRect?.width;

    // Приоритет 1: Если есть все необходимые данные и mousePosition обновлен, позиционируем под курсором
    if (initialRect && mouseOffset && mousePosition) {
      return {
        position: 'fixed',
        left: `${mousePosition.x - mouseOffset.x}px`,
        top: `${mousePosition.y - mouseOffset.y}px`,
        width: width !== undefined ? `${width}px` : `${initialRect.width}px`,
        zIndex: ZIndex.dragPreview,
        pointerEvents: 'none',
      };
    }

    // Приоритет 2: transform из dnd-kit с начальной позицией
    if (initialRect && mouseOffset) {
      const transformValue = CSS.Translate.toString(transform);
      if (transformValue) {
        return {
          position: 'fixed',
          left: `${initialRect.left}px`,
          top: `${initialRect.top}px`,
          width: width !== undefined ? `${width}px` : `${initialRect.width}px`,
          transform: transformValue,
          zIndex: ZIndex.dragPreview,
          pointerEvents: 'none',
        };
      }
      return {
        position: 'fixed',
        left: `${initialRect.left}px`,
        top: `${initialRect.top}px`,
        width: width !== undefined ? `${width}px` : `${initialRect.width}px`,
        zIndex: ZIndex.dragPreview,
        pointerEvents: 'none',
      };
    }

    return {
      position: 'fixed',
      transform: CSS.Translate.toString(transform),
      zIndex: ZIndex.dragPreview,
      pointerEvents: 'none',
      width: width !== undefined ? `${width}px` : '200px',
    };
  }, [isDragging, initialRect, mouseOffset, mousePosition, previewWidth, transform, viewMode]);

  // Комбинируем ref для получения элемента и для dnd-kit
  const combinedRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  // Обработчик для сохранения смещения мыши при начале перетаскивания
  // Важно: вызывается ДО начала перетаскивания, поэтому можем синхронно получить позицию
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (elementRef.current) {
      // getBoundingClientRect возвращает позицию относительно viewport
      const rect = elementRef.current.getBoundingClientRect();
      // Вычисляем смещение курсора от левого верхнего угла элемента
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setMouseOffset({ x: offsetX, y: offsetY });

      // Также сохраняем начальную позицию синхронно при mousedown
      // Это гарантирует, что initialRect будет установлен до начала перетаскивания
      setInitialRect({ left: rect.left, top: rect.top, width: rect.width });
    }
  }, []);

  // При начале перетаскивания используем сохраненный offset или вычисляем fallback
  // Это fallback на случай, если handleMouseDown не сработал
  useEffect(() => {
    if (isDragging && !mouseOffset && initialRect) {
      // Fallback: используем центр карточки по горизонтали и небольшую позицию сверху
      setMouseOffset({ x: initialRect.width / 2, y: 20 });
    }
  }, [isDragging, mouseOffset, initialRect]);

  return {
    attributes,
    listeners,
    combinedRef,
    isDragging,
    style,
    widthPercent,
    handleMouseDown,
  };
}
