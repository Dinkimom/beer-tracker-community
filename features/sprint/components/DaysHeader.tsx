'use client';

import type { DayErrorDetail } from '@/features/sprint/utils/occupancyValidation';
import type { Developer } from '@/types';

import { useState, useRef, useCallback, useEffect } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SidebarResizeHandle } from '@/components/SidebarResizeHandle';
import { WORKING_DAYS, ZIndex } from '@/constants';
import {
  sprintPlannerDaysHeaderContentWidthCss,
  sprintPlannerSwimlaneTimelineWidthCss,
} from '@/features/sprint/components/SprintPlanner/layout/sprintPlannerSwimlaneLayoutWidths';

import { DaysRow } from './DaysHeader/components/DaysRow';
import { ParticipantsSettingsPopup } from './DaysHeader/components/ParticipantsSettingsPopup';

const PARTICIPANTS_COLUMN_MIN_WIDTH = 200;
const PARTICIPANTS_COLUMN_MAX_WIDTH = 420;

interface DaysHeaderProps {
  developers?: Developer[];
  developersManagement?: {
    handleDragEnd: (activeId: string, overId: string) => void;
    hiddenIds: Set<string>;
    hideAllDevelopers: () => void;
    setSortBy: (sort: 'custom' | 'name' | 'sp' | 'tasks' | 'tp') => void;
    showAllDevelopers: () => void;
    sortBy: 'custom' | 'name' | 'sp' | 'tasks' | 'tp';
    sortedDevelopers: Developer[];
    toggleDeveloperVisibility: (id: string) => void;
  };
  /** По каждому дню — список проблемных задач и причин для тултипа иконки ошибки */
  errorDayDetails?: Map<number, DayErrorDetail[]>;
  /** Индексы дней (0..9), в которых есть ошибки планирования — в шапке показывается иконка ошибки */
  errorDayIndices?: Set<number>;
  /** Индексы дней (0..9), которые являются нерабочими/праздничными */
  holidayDayIndices?: Set<number>;
  participantsColumnWidth: number;
  sidebarOpen?: boolean;
  sidebarWidth: number;
  sprintStartDate: Date;
  /** Рабочих дней в таймлайне (длина спринта) */
  sprintTimelineWorkingDays?: number;
  viewMode: 'compact' | 'full';
  onParticipantsColumnWidthChange?: (width: number) => void;
}

export function DaysHeader({
  sprintStartDate,
  sprintTimelineWorkingDays = WORKING_DAYS,
  viewMode,
  sidebarWidth,
  sidebarOpen,
  developers = [],
  developersManagement,
  errorDayDetails,
  errorDayIndices,
  holidayDayIndices,
  participantsColumnWidth,
  onParticipantsColumnWidthChange,
}: DaysHeaderProps) {
  const actualSidebarWidth = sidebarOpen ? sidebarWidth : 0;

  // Ширина контента = колонка участников + таймлайн (ограничено), чтобы скролл заканчивался у конца контента
  const contentWidth = sprintPlannerDaysHeaderContentWidthCss(
    viewMode,
    participantsColumnWidth,
    actualSidebarWidth,
    sprintTimelineWorkingDays
  );

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; width: number } | null>(null);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeStart || !onParticipantsColumnWidthChange) return;
      const delta = e.clientX - resizeStart.x;
      const newWidth = Math.min(
        PARTICIPANTS_COLUMN_MAX_WIDTH,
        Math.max(PARTICIPANTS_COLUMN_MIN_WIDTH, resizeStart.width + delta)
      );
      onParticipantsColumnWidthChange(newWidth);
    },
    [resizeStart, onParticipantsColumnWidthChange]
  );

  const handleResizeEnd = useCallback(() => {
    setResizeStart(null);
  }, []);

  useEffect(() => {
    if (!resizeStart) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizeStart, handleResizeMove, handleResizeEnd]);

  const handleSettingsClick = () => {
    if (settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
      setIsPopupOpen(true);
    }
  };

  // Внешняя ширина шапки = той же ширине контента, что и блок свимлейнов (скролл до конца контента)
  const outerContainerWidth = contentWidth;

  // Ширина области дней (таймлайн) внутри шапки — как у таймлайна в строке свимлейна
  const containerWidth = sprintPlannerSwimlaneTimelineWidthCss(
    viewMode,
    participantsColumnWidth,
    actualSidebarWidth,
    sprintTimelineWorkingDays
  );

  /** Высота шапки колонки участников — как в колонке «Задачи» занятости (41px), чтобы рукоятка не выходила за пределы */
  const HEADER_ROW_HEIGHT = 41;

  return (
    <>
      <div
        className="bg-white dark:bg-gray-800 sticky top-0 overflow-visible"
        style={{ width: outerContainerWidth, zIndex: ZIndex.stickyMainHeader }}
      >
        {/* Days row */}
        <div
          className="flex min-w-max bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-visible"
          style={{ height: HEADER_ROW_HEIGHT, minHeight: HEADER_ROW_HEIGHT }}
        >
          <div
            className="relative flex-shrink-0 sticky left-0 border-r border-b border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 py-2 px-4 flex items-center justify-between gap-3 overflow-hidden"
            style={{
              width: participantsColumnWidth,
              minWidth: participantsColumnWidth,
              height: HEADER_ROW_HEIGHT,
              minHeight: HEADER_ROW_HEIGHT,
              zIndex: ZIndex.stickyMainHeader,
            }}
          >
            {/* Участники с кнопкой настроек */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Участники</span>
              {developersManagement && developers.length > 0 && (
                <Button
                  ref={settingsButtonRef}
                  className="!h-6 !w-6 !min-h-0 !min-w-0 shrink-0 !justify-center !rounded-md !p-0 hover:!bg-gray-200 dark:hover:!bg-gray-700"
                  title="Настройки участников"
                  type="button"
                  variant="ghost"
                  onClick={handleSettingsClick}
                >
                  <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" name="settings" />
                </Button>
              )}
            </div>
            {/* Ручка ресайза колонки участников — как в колонке задач занятости */}
            {onParticipantsColumnWidthChange && (
              <SidebarResizeHandle
                isResizing={!!resizeStart}
                side="right"
                title="Изменить ширину колонки участников"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setResizeStart({ x: e.clientX, width: participantsColumnWidth });
                }}
              />
            )}
          </div>
        <DaysRow
          containerWidth={containerWidth}
          errorDayDetails={errorDayDetails}
          errorDayIndices={errorDayIndices}
          holidayDayIndices={holidayDayIndices}
          sprintStartDate={sprintStartDate}
          variant="swimlanes"
          workingDaysCount={sprintTimelineWorkingDays}
        />
      </div>
    </div>

    {/* Попап настроек участников */}
    {developersManagement && developers.length > 0 && (
      <ParticipantsSettingsPopup
        developers={developers}
        developersManagement={developersManagement}
        isOpen={isPopupOpen}
        position={popupPosition}
        onClose={() => setIsPopupOpen(false)}
      />
    )}
    </>
  );
}

