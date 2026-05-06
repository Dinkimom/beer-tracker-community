'use client';

import type { AssigneePointsStats } from '@/features/sprint/utils/assigneePointsStats';
import type { Developer, Task, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';
import type { CSSProperties } from 'react';

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { WORKING_DAYS, ZIndex } from '@/constants';
import {
  normalizeQuarterlyAvailabilityToBoardEvents,
  quarterlyAvailabilityHasBlockingSegments,
} from '@/features/sprint/utils/quarterlyAvailabilityNormalize';
import { getSegmentsForDeveloper } from '@/features/swimlane/utils/availabilitySegments';
import { taskHasEstimateForAssignee } from '@/lib/trackerIntegration/plannerThresholds';

const PICKER_MAX_HEIGHT = 280;
const TOTAL_STORY_POINTS = 20;
const TOTAL_TEST_POINTS = 25;
const PICKER_MIN_WIDTH = 220;
const PICKER_OFFSET = 4;
const VIEWPORT_PADDING = 8;

const AVAILABILITY_LABELS: Record<string, string> = {
  vacation: 'Отпуск',
  sick_leave: 'Больничный',
  duty: 'Дежурство',
  'tech-sprint-web': 'Техспринт (Web)',
  'tech-sprint-back': 'Техспринт (Back)',
  'tech-sprint-qa': 'Техспринт (QA)',
};

const PLATFORM_LABELS: Record<string, string> = {
  QA: 'QA',
  Back: 'Back',
  Web: 'Web',
  DevOps: 'DevOps',
  Other: 'Без платформы',
};

type PlatformKey = 'Back' | 'Other' | 'QA' | 'Web';

function getDeveloperPlatformKey(d: Developer): PlatformKey {
  if (d.role === 'tester') return 'QA';
  const platforms = d.platforms ?? [];
  if (platforms.includes('back')) return 'Back';
  if (platforms.includes('web')) return 'Web';
  return 'Other';
}

/** Порядок платформ в пикере: подходящая платформе задачи — первой */
function getPlatformOrder(taskTeam: string | undefined): PlatformKey[] {
  const t = (taskTeam ?? '').toLowerCase();
  if (t === 'qa') return ['QA', 'Back', 'Web', 'Other'];
  if (t === 'back') return ['Back', 'Web', 'QA', 'Other'];
  if (t === 'web') return ['Web', 'Back', 'QA', 'Other'];
  return ['Back', 'Web', 'QA', 'Other'];
}

function formatAvailabilityLine(segments: Array<{ kind: string; dateRangeLabel: string }>): string {
  return segments.map((s) => `${AVAILABILITY_LABELS[s.kind] ?? s.kind} ${s.dateRangeLabel}`).join('; ');
}

interface OccupancyAssigneePickerProps {
  anchorRect: DOMRect;
  assigneePointsStats: AssigneePointsStats;
  /** Отпуска и техспринты из квартального планирования — для подсказки в пикере */
  availability?: QuarterlyAvailability | null;
  developers: Developer[];
  /** Минимум оценки (из validationThresholds.occupancy), чтобы показывать «Подходит: …» */
  minStoryPointsForAssignee?: number;
  minTestPointsForAssignee?: number;
  position: TaskPosition;
  sprintStartDate: Date;
  task: Task;
  onClose: () => void;
  onSelect: (assigneeId: string) => void;
}

export function OccupancyAssigneePicker({
  anchorRect,
  assigneePointsStats,
  availability,
  developers,
  minStoryPointsForAssignee = 0,
  minTestPointsForAssignee = 0,
  onClose,
  onSelect,
  position,
  sprintStartDate,
  task,
}: OccupancyAssigneePickerProps) {
  const developerSegments = useMemo(() => {
    if (!availability || !quarterlyAvailabilityHasBlockingSegments(availability)) {
      return new Map<string, Array<{ kind: string; dateRangeLabel: string }>>();
    }
    const boardEvents = normalizeQuarterlyAvailabilityToBoardEvents(availability);
    const map = new Map<string, Array<{ kind: string; dateRangeLabel: string }>>();
    developers.forEach((d) => {
      const segments = getSegmentsForDeveloper(
        d.id,
        sprintStartDate,
        boardEvents,
        WORKING_DAYS
      );
      if (segments.length > 0) map.set(d.id, segments);
    });
    return map;
  }, [availability, developers, sprintStartDate]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const pickerStyle = useMemo((): CSSProperties => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const spaceBelow = vh - anchorRect.bottom - PICKER_OFFSET - VIEWPORT_PADDING;
    const spaceAbove = anchorRect.top - PICKER_OFFSET - VIEWPORT_PADDING;
    const showAbove = spaceBelow < PICKER_MAX_HEIGHT && spaceAbove >= Math.min(spaceBelow, PICKER_MAX_HEIGHT);

    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    let left = anchorCenterX - PICKER_MIN_WIDTH / 2;
    if (left + PICKER_MIN_WIDTH > vw - VIEWPORT_PADDING) {
      left = vw - PICKER_MIN_WIDTH - VIEWPORT_PADDING;
    }
    left = Math.max(VIEWPORT_PADDING, left);

    if (showAbove) {
      const bottomPx = vh - (anchorRect.top - PICKER_OFFSET);
      const maxHeightPx = anchorRect.top - PICKER_OFFSET - VIEWPORT_PADDING;
      return {
        left,
        bottom: bottomPx,
        maxHeight: Math.max(100, maxHeightPx),
        zIndex: ZIndex.modalBackdrop + 10,
      };
    }

    return {
      left,
      top: anchorRect.bottom + PICKER_OFFSET,
      zIndex: ZIndex.modalBackdrop + 10,
    };
  }, [anchorRect]);

  const pickerBody = useMemo(() => {
    if (developers.length === 0) {
      return <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Нет участников</div>;
    }
    const hasEstimate = taskHasEstimateForAssignee(task, {
      minStoryPointsForAssignee,
      minTestPointsForAssignee,
    });
    const byPlatform = new Map<PlatformKey, Developer[]>();
    developers.forEach((d) => {
      const key = getDeveloperPlatformKey(d);
      const list = byPlatform.get(key) ?? [];
      list.push(d);
      byPlatform.set(key, list);
    });
    const platformOrder = getPlatformOrder(task.team);

    return (
      <>
        {platformOrder.map((platformKey, orderIndex) => {
          const list = byPlatform.get(platformKey) ?? [];
          if (list.length === 0) return null;
          const label = PLATFORM_LABELS[platformKey] ?? platformKey;
          const isFirst = orderIndex === 0;
          return (
            <div key={platformKey}>
              <div
                className={`px-3 py-1.5 ${!isFirst ? 'mt-0.5 border-t border-gray-100 dark:border-gray-700' : ''}`}
              >
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {hasEstimate && isFirst ? `Подходит: ${label}` : label}
                </p>
              </div>
              {list.map((d) => {
                const entry = assigneePointsStats.byAssignee.get(d.id);
                const isQaPicker = task.team === 'QA';
                const total = isQaPicker ? TOTAL_TEST_POINTS : TOTAL_STORY_POINTS;
                const points = isQaPicker ? (entry?.testPoints ?? 0) : (entry?.storyPoints ?? 0);
                const suffix = isQaPicker ? 'tp' : 'sp';
                const pointsLabel = `${points} из ${total} ${suffix}`;
                const segments = developerSegments.get(d.id);
                const availabilityLine = segments ? formatAvailabilityLine(segments) : null;
                return (
                  <Button
                    key={d.id}
                    aria-selected={d.id === position.assignee}
                    className={`h-auto min-h-0 w-full rounded-none border-0 !items-start !justify-start !gap-2 !px-3 !py-2 text-left text-sm shadow-none ${
                      d.id === position.assignee
                        ? 'cursor-pointer !bg-blue-50 !text-blue-700 hover:!bg-blue-50 dark:!bg-blue-900/30 dark:!text-blue-300 dark:hover:!bg-blue-900/30'
                        : 'cursor-pointer text-gray-900 hover:!bg-gray-50 dark:text-gray-100 dark:hover:!bg-gray-700'
                    }`}
                    role="option"
                    type="button"
                    variant="ghost"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(d.id);
                    }}
                  >
                    <Avatar
                      avatarUrl={d.avatarUrl}
                      className="mt-0.5"
                      initials={d.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate">{d.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {pointsLabel}
                        </span>
                      </div>
                      {availabilityLine && (
                        <p
                          className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 line-clamp-2"
                          title={availabilityLine}
                        >
                          {availabilityLine}
                        </p>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          );
        })}
      </>
    );
  }, [
    developers,
    task,
    position.assignee,
    assigneePointsStats,
    developerSegments,
    minStoryPointsForAssignee,
    minTestPointsForAssignee,
    onSelect,
  ]);

  const content = (
    <>
      {/* Бэкдроп */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-transparent"
        style={{ zIndex: ZIndex.modalBackdrop }}
        onClick={onClose}
      />
      {/* Пикер */}
      <div
        ref={containerRef}
        aria-label="Выберите исполнителя"
        className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[240px] overflow-auto"
        role="listbox"
        style={pickerStyle}
      >
      <div className="py-1">{pickerBody}</div>
    </div>
    </>
  );

  return createPortal(content, document.body);
}
