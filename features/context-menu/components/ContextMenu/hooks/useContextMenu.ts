/**
 * Хук для управления логикой ContextMenu
 */

import type { Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import { useConfirmDialog } from '@/components/ConfirmDialog';

type ContextMenuAnchorRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

function isScrollTargetInsideSubmenu(e: Event): boolean {
  const target = e.target as HTMLElement;
  return target.closest('[data-submenu="true"]') !== null;
}

interface UseContextMenuProps {
  anchorRect?: ContextMenuAnchorRect | null;
  currentSprintId: number | null;
  isBacklogTask?: boolean;
  position: { x: number; y: number };
  sprints: SprintListItem[];
  task: Task;
  onClose: () => void;
  onCloseByClickOutside?: () => void;
  onMoveToSprint: (taskId: string, sprintId: number) => Promise<void>;
  onRemoveFromPlan?: (taskId: string) => void;
  onRemoveFromSprint: (taskId: string) => Promise<void>;
  onStatusChange: (taskId: string, transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => Promise<void>;
}

export function useContextMenu({
  task,
  sprints,
  currentSprintId,
  position,
  anchorRect = null,
  onClose,
  onCloseByClickOutside,
  onStatusChange,
  onMoveToSprint,
  onRemoveFromPlan,
  onRemoveFromSprint,
  isBacklogTask = false,
}: UseContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const sprintButtonRef = useRef<HTMLButtonElement>(null);
  const estimateButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoading] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isSprintMenuOpen, setIsSprintMenuOpen] = useState(false);
  const [isEstimateMenuOpen, setIsEstimateMenuOpen] = useState(false);
  const { confirm, DialogComponent } = useConfirmDialog();

  // Перенос/удаление из спринта: для синтетической QA-строки с привязкой к dev и ненулевым объёмом
  // двигаем dev-задачу в трекере; при 0 SP и TP≤0 — саму QA-задачу (отдельная фаза «чисто QA»).
  const sp = task.storyPoints ?? 0;
  const tp = task.testPoints ?? 0;
  const taskIdForActions =
    task.team === 'QA' && task.originalTaskId && (sp > 0 || tp > 0)
      ? task.originalTaskId
      : task.id;

  // Обработчики открытия меню - закрываем другие меню синхронно
  const handleStatusMenuToggle = () => {
    if (!isStatusMenuOpen) {
      setIsSprintMenuOpen(false);
      setIsEstimateMenuOpen(false);
    }
    setIsStatusMenuOpen(!isStatusMenuOpen);
  };

  const handleSprintMenuToggle = () => {
    if (!isSprintMenuOpen) {
      setIsStatusMenuOpen(false);
      setIsEstimateMenuOpen(false);
    }
    setIsSprintMenuOpen(!isSprintMenuOpen);
  };

  const handleEstimateMenuToggle = () => {
    if (!isEstimateMenuOpen) {
      setIsStatusMenuOpen(false);
      setIsSprintMenuOpen(false);
    }
    setIsEstimateMenuOpen(!isEstimateMenuOpen);
  };

  // Блокируем скролл страницы когда открыто контекстное меню
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const scrollY = window.scrollY;

    // Блокируем скролл
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    // Предотвращаем скролл через wheel события, но разрешаем внутри подменю
    const blockScrollOutsideSubmenu = (e: Event) => {
      if (isScrollTargetInsideSubmenu(e)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('wheel', blockScrollOutsideSubmenu, { passive: false });
    document.addEventListener('touchmove', blockScrollOutsideSubmenu, { passive: false });

    return () => {
      // Восстанавливаем скролл
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = '';
      const savedScrollY = document.body.style.top;
      document.body.style.top = '';
      if (savedScrollY) {
        window.scrollTo(0, parseInt(savedScrollY, 10) * -1);
      }

      document.removeEventListener('wheel', blockScrollOutsideSubmenu);
      document.removeEventListener('touchmove', blockScrollOutsideSubmenu);
    };
  }, []);

  // Закрываем меню при клике вне его (игнорируем клики по диалогу подтверждения)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMenu = menuRef.current?.contains(target) ?? false;

      const allSubmenus = document.querySelectorAll('[data-submenu="true"]');
      const clickedInsideSubmenu = Array.from(allSubmenus).some(submenu =>
        submenu.contains(target)
      );

      const clickedInsideConfirmDialog = (target as HTMLElement).closest?.('[data-confirm-dialog="true"]');

      if (!clickedInsideMenu && !clickedInsideSubmenu && !clickedInsideConfirmDialog) {
        onCloseByClickOutside?.();
        onClose();
        // Не вызываем preventDefault/stopPropagation — иначе после закрытия ломаются :hover и hover:shadow-lg на карточке под курсором (dnd-kit / синтетические события).
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusMenuOpen(false);
        setIsSprintMenuOpen(false);
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, onCloseByClickOutside]);

  // Позиционируем главное меню (от курсора или от якоря — карточки задачи)
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const pad = 10;
    const gap = 8;

    const apply = () => {
      const menuRect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left: number;
      let top: number;

      if (anchorRect) {
        const a = anchorRect;
        left = a.right + gap;
        top = a.top;
        if (left + menuRect.width > viewportWidth - pad) {
          const leftOfCard = a.left - menuRect.width - gap;
          if (leftOfCard >= pad) {
            left = leftOfCard;
          }
        }
      } else {
        left = position.x;
        top = position.y;
      }

      if (left + menuRect.width > viewportWidth - pad) {
        left = viewportWidth - menuRect.width - pad;
      }
      if (top + menuRect.height > viewportHeight - pad) {
        top = viewportHeight - menuRect.height - pad;
      }
      if (left < pad) left = pad;
      if (top < pad) top = pad;

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };

    apply();
    const raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [position, anchorRect]);

  const handleStatusSelect = (transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => {
    if (isLoading) return;

    // Меняем статус "реальной" задачи в Tracker: для синтетической QA-строки — dev-задача (originalTaskId),
    // иначе — сама задача.
    onStatusChange(taskIdForActions, transitionId, targetStatusKey, targetStatusDisplay, screenId).catch((error) => {
      console.error('Failed to change status:', error);
    });

    setIsStatusMenuOpen(false);
    onClose();
  };

  const handleSprintSelect = async (sprintId: number) => {
    if (isLoading || sprintId === currentSprintId) return;

    // Находим название спринта для подтверждения
    const targetSprint = sprints.find(s => s.id === sprintId);
    const sprintName = targetSprint?.name || `спринт ${sprintId}`;

    // Запрашиваем подтверждение
    const confirmed = await confirm(
      `Вы уверены, что хотите перенести задачу "${taskIdForActions}" в спринт "${sprintName}"?`,
      {
        title: 'Перенос задачи в спринт',
        variant: 'default',
      }
    );

    if (!confirmed) {
      return;
    }

    setIsSprintMenuOpen(false);
    onClose();

    try {
      await onMoveToSprint(taskIdForActions, sprintId);
    } catch (error) {
      console.error('Failed to move task to sprint:', error);
      toast.error('Не удалось перенести задачу в спринт. Попробуйте ещё раз.');
    }
  };

  const handleRemoveFromSprint = async () => {
    if (isLoading) return;

    // Используем диалог подтверждения
    const confirmed = await confirm(
      `Вы уверены, что хотите убрать задачу "${taskIdForActions}" из текущего спринта?`,
      {
        title: 'Удаление задачи из спринта',
        variant: 'default',
      }
    );

    if (!confirmed) {
      return;
    }

    // Вызываем onRemoveFromSprint, который оптимистично удалит задачу и отправит запрос асинхронно
    // Не ждем завершения, чтобы не блокировать UI
    if (!onRemoveFromSprint) {
      console.error('onRemoveFromSprint is not defined!');
      onClose();
      return;
    }

    try {
      const result = onRemoveFromSprint(taskIdForActions);
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          console.error('Failed to remove task from sprint:', error);
        });
      }
    } catch (error) {
      console.error('Error calling onRemoveFromSprint:', error);
    }

    onClose();
  };

  const handleRemoveFromPlan = () => {
    if (isLoading || !onRemoveFromPlan) return;
    // Используем task.id (не taskIdForActions) — удаляем позицию конкретной задачи (dev или QA)
    onRemoveFromPlan(task.id);
    onClose();
  };

  // Для задач бэклога показываем только активные спринты (in_progress) и спринты в статусе draft
  // Для обычных задач показываем все неархивные спринты, кроме текущего
  const availableSprints = isBacklogTask
    ? sprints.filter(s => !s.archived && (s.status === 'in_progress' || s.status === 'draft'))
    : sprints.filter(s => s.id !== currentSprintId && !s.archived);

  return {
    menuRef,
    statusButtonRef,
    sprintButtonRef,
    estimateButtonRef,
    isLoading,
    isStatusMenuOpen,
    isSprintMenuOpen,
    isEstimateMenuOpen,
    taskIdForActions,
    availableSprints,
    DialogComponent,
    handleStatusMenuToggle,
    handleSprintMenuToggle,
    handleEstimateMenuToggle,
    handleStatusSelect,
    handleSprintSelect,
    handleRemoveFromPlan,
    handleRemoveFromSprint,
  };
}

