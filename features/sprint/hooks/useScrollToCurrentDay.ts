/**
 * Хук для автоматической прокрутки к текущей ячейке при первой загрузке
 */

import type { SprintInfo, SprintListItem } from '@/types/tracker';

import { useEffect, useRef } from 'react';

import { DELAYS } from '@/utils/constants';

interface UseScrollToCurrentDayProps {
  isMounted: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedSprintId: number | null;
  sprintInfo: SprintInfo | null;
  sprints: SprintListItem[];
  viewMode: 'compact' | 'full' | 'kanban' | 'occupancy';
}

/**
 * Хук для автоматической прокрутки к текущей ячейке
 */
export function useScrollToCurrentDay({
  isMounted,
  viewMode,
  sprintInfo,
  selectedSprintId,
  sprints,
  scrollContainerRef,
}: UseScrollToCurrentDayProps) {
  const hasScrolledRef = useRef<boolean>(false);

  useEffect(() => {
    // Прокручиваем только один раз при первой загрузке
    if (!isMounted || hasScrolledRef.current) return;

    // Проверяем, нужно ли прокручивать
    // Не прокручиваем, если спринт archived или draft
    const selectedSprint = sprints.find((s) => s.id === selectedSprintId);
    if (selectedSprint && (selectedSprint.archived || selectedSprint.status === 'draft')) {
      hasScrolledRef.current = true;
      return;
    }

    // Проверяем, находится ли текущая дата в пределах спринта
    if (sprintInfo?.startDate && sprintInfo?.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(sprintInfo.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(sprintInfo.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Если текущая дата вне спринта, не прокручиваем
      if (today < startDate || today > endDate) {
        hasScrolledRef.current = true;
        return;
      }
    }

    const scrollToCurrentCell = (attempt = 0) => {
      const container = scrollContainerRef.current;
      if (!container || hasScrolledRef.current) return;

      // Прокрутка нужна только в режиме full (в compact/occupancy overflow-x-hidden или другая вёрстка)
      if (viewMode !== 'full') {
        hasScrolledRef.current = true;
        return;
      }

      // Ищем элемент с текущей ячейкой
      const currentCellElement = container.querySelector('[data-current-cell="true"]') as HTMLElement;

      if (!currentCellElement) {
        // Если элемент еще не найден, пробуем еще раз
        if (attempt < DELAYS.MAX_RETRIES) {
          setTimeout(() => scrollToCurrentCell(attempt + 1), DELAYS.SCROLL_ATTEMPT);
          return;
        }
        hasScrolledRef.current = true;
        return;
      }

      // Получаем позицию элемента относительно контейнера
      const containerRect = container.getBoundingClientRect();
      const elementRect = currentCellElement.getBoundingClientRect();

      // Вычисляем позицию элемента относительно контейнера
      const elementLeft = elementRect.left - containerRect.left + container.scrollLeft;
      const elementWidth = elementRect.width;
      const containerWidth = container.clientWidth;

      // Прокручиваем так, чтобы центр ячейки был в центре видимой области
      const scrollOffset = Math.max(
        0,
        Math.min(elementLeft + elementWidth / 2 - containerWidth / 2, container.scrollWidth - containerWidth)
      );

      // Сначала устанавливаем позицию напрямую для немедленной прокрутки
      container.scrollLeft = scrollOffset;

      // Затем используем smooth scroll для плавной анимации
      requestAnimationFrame(() => {
        if (container && !hasScrolledRef.current) {
          container.scrollTo({
            left: scrollOffset,
            behavior: 'smooth',
          });
        }
      });

      // Помечаем, что прокрутка уже выполнена
      hasScrolledRef.current = true;
    };

    // Прокручиваем после небольшой задержки, чтобы контейнер успел отрендериться
    const timeoutId = setTimeout(() => scrollToCurrentCell(), DELAYS.INITIAL_SCROLL);
    return () => clearTimeout(timeoutId);
  }, [isMounted, viewMode, sprintInfo, selectedSprintId, sprints, scrollContainerRef]);
}

