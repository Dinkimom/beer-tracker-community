'use client';

import type { Task } from '@/types';

import { useRef, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import {
  CONTEXT_MENU_GHOST_BUTTON_RESET,
  CONTEXT_MENU_ITEM_ROW_ACTIVE,
  CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER,
  CONTEXT_MENU_ITEM_ROW_SUBMENU,
} from '@/features/context-menu/contextMenuClasses';
import { calculateSubmenuPosition } from '@/features/context-menu/utils/submenuPositioning';
import { getTaskTrackerDisplayKey } from '@/features/task/utils/taskUtils';
import { type TransitionItem, getIssueTransitions } from '@/lib/beerTrackerApi';
import { DELAYS } from '@/utils/constants';
import { getStatusColors } from '@/utils/statusColors';

interface StatusSubmenuProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isLoading: boolean;
  isOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  task: Task;
  taskIdForActions: string;
  onSelect: (transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => void;
  onToggle: () => void;
}

export function StatusSubmenu({
  task,
  taskIdForActions,
  isOpen,
  menuRef,
  buttonRef,
  isLoading,
  onToggle,
  onSelect,
}: StatusSubmenuProps) {
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [statusTransitions, setStatusTransitions] = useState<TransitionItem[]>([]);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState(false);
  const loadedForTaskIdRef = useRef<string | null>(null);

  // Загружаем доступные переходы статусов при открытии меню
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Повторно не запрашиваем для того же taskId (защита от цикла: не держим isLoading/statusTransitions в deps)
    if (loadedForTaskIdRef.current === taskIdForActions) {
      return;
    }
    loadedForTaskIdRef.current = taskIdForActions;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoadingTransitions(true);
    });

    const loadTransitions = async () => {
      try {
        const transitions = await getIssueTransitions(getTaskTrackerDisplayKey(task));
        if (!cancelled) {
          const transitionsArray = Array.isArray(transitions) ? transitions : [];
          setStatusTransitions(transitionsArray);
          setIsLoadingTransitions(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load status transitions:', error);
          setStatusTransitions([]);
          setIsLoadingTransitions(false);
        }
      }
    };

    loadTransitions();

    return () => {
      cancelled = true;
      loadedForTaskIdRef.current = null;
    };
  }, [isOpen, taskIdForActions]);

  // Сбрасываем состояния при закрытии меню статусов
  useEffect(() => {
    if (!isOpen) {
      loadedForTaskIdRef.current = null;
      setTimeout(() => {
        setStatusTransitions([]);
        setIsLoadingTransitions(false);
      }, 0);
    }
  }, [isOpen]);

  // Позиционируем меню статусов
  useEffect(() => {
    if (isOpen && statusMenuRef.current && buttonRef.current && menuRef.current) {
      const menuElement = menuRef.current;

      const updatePosition = () => {
        if (!statusMenuRef.current || !buttonRef.current || !menuElement) return;

        const menuRect = menuElement.getBoundingClientRect();
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const subMenuRect = statusMenuRef.current.getBoundingClientRect();
        const statusMenuParent = statusMenuRef.current.parentElement;
        if (!statusMenuParent) return;
        const parentRect = statusMenuParent.getBoundingClientRect();

        const { left, top } = calculateSubmenuPosition(menuRect, buttonRect, subMenuRect, parentRect);

        statusMenuRef.current.style.left = `${left}px`;
        statusMenuRef.current.style.top = `${top}px`;
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updatePosition();
          setTimeout(updatePosition, DELAYS.POSITIONING);
        });
      });
    }
  }, [isOpen, statusTransitions.length, isLoadingTransitions, menuRef, buttonRef]);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        className={`${CONTEXT_MENU_ITEM_ROW_SUBMENU} ${CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER} ${
          isOpen ? CONTEXT_MENU_ITEM_ROW_ACTIVE : ''
        } ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
        disabled={isLoading}
        type="button"
        variant="ghost"
        onClick={onToggle}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon
            aria-hidden
            className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
            name="refresh"
          />
          <span className="min-w-0 truncate font-medium">Изменить статус</span>
        </div>
        <Icon
          aria-hidden
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
          name="chevron-right"
        />
      </Button>
      {isOpen && (
        <div
          ref={statusMenuRef}
          className={`absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl py-2 px-1.5 min-w-[240px] max-h-[400px] overflow-y-auto ${ZIndex.class('submenu')}`}
          data-submenu="true"
        >
          {isLoadingTransitions ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center gap-2">
              <Icon className="animate-spin h-6 w-6 text-gray-400" name="spinner" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Загрузка переходов...</span>
            </div>
          ) : statusTransitions.length > 0 ? (
            statusTransitions.map((transition) => {
              const targetStatus = transition.to?.key ?? transition.key ?? '';
              const statusColors = getStatusColors(targetStatus);
              const isSelected = targetStatus.toLowerCase() === task.originalStatus?.toLowerCase();

              // Используем цвета как у карточек задач
              const bgColor = `${statusColors.bg} ${statusColors.bgDark || ''}`;
              const textColor = `${statusColors.text} ${statusColors.textDark || ''}`;
              const borderColor = `${statusColors.border} ${statusColors.borderDark || ''}`;

              return (
                <Button
                  key={transition.id}
                  className={`mb-1.5 flex w-full items-center gap-2 rounded-md border-2 px-3 py-2 text-left text-sm shadow-none last:mb-0 ${bgColor} ${borderColor} ${
                    isSelected
                      ? `${textColor} font-medium ring-2 ring-blue-500 ring-offset-1 dark:ring-blue-400 dark:ring-offset-gray-800`
                      : `${textColor} hover:opacity-90 hover:shadow-sm`
                  }`}
                  disabled={isLoading}
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onSelect(transition.id, transition.to?.key, transition.to?.display, transition.screen?.id)
                  }
                >
                  <span className="flex-1 font-medium">{transition.to?.display || transition.display}</span>
                  {isSelected ? (
                    <Icon className={`h-4 w-4 shrink-0 ${textColor}`} name="check" />
                  ) : null}
                </Button>
              );
            })
          ) : (
            <div className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
              Нет доступных переходов
            </div>
          )}
        </div>
      )}
    </div>
  );
}
