/**
 * Хук для обработки событий клавиатуры и мыши
 */

import type { TaskLink, TaskPosition } from '@/types';

import { useEffect } from 'react';

interface UseKeyboardAndMouseHandlersProps {
  filteredTaskLinks: TaskLink[];
  filteredTaskPositions: Map<string, TaskPosition>;
  selectedSprintId: number | null;
  deleteLink: (linkId: string) => Promise<void>;
  deletePosition: (taskId: string) => Promise<void>;
  setTaskLinks: (updater: (prev: TaskLink[]) => TaskLink[]) => void;
  setTaskPositions: (updater: (prev: Map<string, TaskPosition>) => Map<string, TaskPosition>) => void;
}

/**
 * Хук для обработки событий клавиатуры и мыши
 */
export function useKeyboardAndMouseHandlers({
  filteredTaskPositions,
  selectedSprintId,
  setTaskPositions,
  setTaskLinks,
  deletePosition,
  deleteLink,
  filteredTaskLinks,
}: UseKeyboardAndMouseHandlersProps) {
  // Обработчик клавиши Delete для возврата задачи в сайдбар
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Проверяем, что нажата клавиша Delete и что задача выбрана
      if (e.key === 'Delete' || e.key === 'Backspace') {
        void filteredTaskPositions;
        // selection logic for delete is handled elsewhere
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredTaskPositions]);

  // The previous implementation depended on legacy swimlane link-editing selection state.
  // Deleting tasks/links via keyboard will be reintroduced when a new selection model exists.
  void selectedSprintId;
  void setTaskPositions;
  void setTaskLinks;
  void deletePosition;
  void deleteLink;
  void filteredTaskLinks;
}
