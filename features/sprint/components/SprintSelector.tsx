'use client';

import type { SprintListItem } from '@/types/tracker';

import * as Popover from '@radix-ui/react-popover';
import { useState, useRef, useLayoutEffect } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { StatusTag } from '@/components/StatusTag';
import { ZIndex } from '@/constants';
import { translateSprintStatus } from '@/utils/translations';

interface SprintSelectorProps {
  className?: string;
  /** true — поповер поверх модалки (z-index выше modal) */
  inModal?: boolean;
  loading?: boolean;
  selectedSprintId: number | null;
  sprints: SprintListItem[];
  sprintsLoading?: boolean;
  onSprintChange: (sprintId: number | null) => void;
}

export function SprintSelector({
  className,
  inModal = false,
  sprints,
  selectedSprintId,
  onSprintChange,
  loading = false,
  sprintsLoading = false,
}: SprintSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Устанавливаем ширину dropdown равной ширине кнопки
  // Используем useLayoutEffect для синхронного вычисления перед отрисовкой
  useLayoutEffect(() => {
    if (buttonRef.current) {
      const buttonWidth = buttonRef.current.getBoundingClientRect().width;
      setDropdownWidth(buttonWidth);
    }
  }, [isOpen]);

  // Сортируем спринты по номеру в обратном порядке (от большего к меньшему)
  const sortedSprints = [...sprints].sort((a, b) => {
    // Извлекаем номер из названия (например, "Booking 2525" -> 2525)
    const getNumber = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return getNumber(b.name) - getNumber(a.name);
  });

  const selectedSprint = sortedSprints.find((s) => s.id === selectedSprintId);

  const mapSprintStatusToTaskStatus = (sprintStatus: string): string => {
    const statusMap: Record<string, string> = {
      'in_progress': 'inprogress',
      'closed': 'closed',
      'draft': 'readyfortest',
    };
    return statusMap[sprintStatus] || sprintStatus;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const handleSelect = (sprintId: number | null) => {
    onSprintChange(sprintId);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          ref={buttonRef}
          className={`!h-8 !min-h-0 w-full min-w-0 !justify-between !gap-1.5 !rounded-lg !border-gray-300 !bg-white !px-2.5 !py-0 hover:!border-gray-400 focus-visible:!border-blue-500 focus-visible:!ring-2 focus-visible:!ring-blue-500 data-[state=open]:!border-gray-400 disabled:!cursor-not-allowed dark:!border-gray-600 dark:!bg-gray-700 dark:hover:!border-gray-500 dark:data-[state=open]:!border-gray-500 dark:disabled:!border-gray-600 dark:disabled:!bg-gray-800 ${className ?? ''}`}
          disabled={sprintsLoading || sprints.length === 0 || loading}
          type="button"
          variant="outline"
        >
          <div className="flex-1 text-left min-w-0 overflow-hidden">
            {sprintsLoading ? (
              <div className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0 animate-spin text-gray-400 dark:text-gray-500" name="spinner" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</span>
              </div>
            ) : sprints.length === 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Нет спринтов</span>
            ) : selectedSprint ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                <span className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {selectedSprint.name}
                </span>
                {selectedSprint.startDate && selectedSprint.endDate && (
                  <div className="flex-shrink-0 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    <span>{formatDate(selectedSprint.startDate)} - {formatDate(selectedSprint.endDate)}</span>
                  </div>
                )}
                {!selectedSprint.archived && selectedSprint.status && (
                  <StatusTag
                    label={translateSprintStatus(selectedSprint.status)}
                    status={mapSprintStatusToTaskStatus(selectedSprint.status)}
                  />
                )}
                {selectedSprint.archived && (
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-sm font-medium leading-none text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    Архив
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">Выберите спринт</span>
            )}
          </div>

          <Icon
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${
              isOpen ? 'rotate-180' : ''
            }`}
            name="chevron-down"
          />
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-[600px] overflow-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 ${inModal ? 'z-[2010]' : ZIndex.class('dropdownContent')}`}
          side="bottom"
          sideOffset={4}
          style={{
            width: dropdownWidth ? `${dropdownWidth}px` : 'auto',
            minWidth: dropdownWidth ? `${dropdownWidth}px` : 'auto'
          }}
        >
          <div className="py-1">
            {sortedSprints.map((sprint) => {
              const isSelected = sprint.id === selectedSprintId;
              return (
                <Button
                  key={sprint.id}
                  className={`h-auto min-h-0 w-full cursor-pointer rounded-none border-b border-gray-100 !px-2 !py-1.5 text-left shadow-none last:border-b-0 dark:border-gray-700 ${
                    isSelected
                      ? '!border-blue-100 !bg-blue-50 dark:!border-blue-800 dark:!bg-blue-900/30'
                      : 'hover:!bg-gray-50 dark:hover:!bg-gray-700'
                  }`}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelect(sprint.id)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {sprint.name}
                    </span>
                    {sprint.startDate && sprint.endDate && (
                      <div
                        className={`whitespace-nowrap text-sm ${
                          isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <span>{formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}</span>
                      </div>
                    )}
                    {!sprint.archived && sprint.status && (
                      <StatusTag
                        label={translateSprintStatus(sprint.status)}
                        status={mapSprintStatusToTaskStatus(sprint.status)}
                      />
                    )}
                    {sprint.archived && (
                      <span className="shrink-0 whitespace-nowrap rounded-md border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-sm font-medium leading-none text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Архив
                      </span>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

