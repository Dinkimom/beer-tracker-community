'use client';

import type { PositionPreview } from './OccupancyPhaseBar';
import type { Task, TaskPosition } from '@/types';
import type { ChangelogEntry } from '@/types/tracker';

import { ZIndex } from '@/constants';
import { occupancyPlanEndCell } from '@/features/sprint/utils/occupancyUtils';
import { dateTimeToFractionalCellInRange } from '@/lib/planner-timeline';

import {
  PHASE_BAR_HEIGHT_PX,
  PHASE_BAR_TOP_OFFSET_PX,
  PHASE_ROW_INSET_PX,
} from './occupancyPhaseBarConstants';

/**
 * Находит время перехода в статус readyForTest из changelog
 */
function findReadyForTestTransition(changelog: ChangelogEntry[]): string | null {
  for (const entry of changelog) {
    const statusField = entry.fields?.find((f) => f.field.id === 'status');
    if (!statusField?.to) continue;

    const toStatusKey = statusField.to.key?.toLowerCase();
    if (toStatusKey === 'readyfortest' || toStatusKey === 'readyfortesting') {
      return entry.updatedAt;
    }
  }
  return null;
}

interface OccupancyBaselineBarProps {
  /** Высота и отступ полосы (в компактном режиме строк — меньше) */
  barHeight?: number;
  barTopOffset?: number;
  changelog?: ChangelogEntry[];
  position: TaskPosition;
  positionPreviews: Map<string, PositionPreview>;
  sprintStartDate: Date;
  task?: Task;
  taskId: string;
  totalParts: number;
}

/** Бейзлайн от конца плана до факта (readyForTest для разработки) или до «сейчас» (полосатая зона просрочки); при перетаскивании используем превью. «Сейчас» — по текущему времени (9:00–18:00, с 18:00 на всю ширину дня). */
export function OccupancyBaselineBar({
  barHeight = PHASE_BAR_HEIGHT_PX,
  barTopOffset = PHASE_BAR_TOP_OFFSET_PX,
  changelog,
  position,
  positionPreviews,
  sprintStartDate,
  task,
  taskId,
  totalParts,
}: OccupancyBaselineBarProps) {
  const preview = positionPreviews.get(taskId);
  const effective: TaskPosition = preview ? { ...position, ...preview } : position;
  const plannedEndCell = occupancyPlanEndCell(effective);

  // Конец бейзлайна по текущему времени (та же логика, что у контейнера фаз факта: 9–18, с 18:00 — вся ширина дня)
  let baselineEndCell = Math.min(
    dateTimeToFractionalCellInRange(sprintStartDate, new Date(), totalParts),
    totalParts
  );

  // Для задачи разработки ищем переход в readyForTest
  if (changelog && task && task.team !== 'QA') {
    const readyForTestTime = findReadyForTestTransition(changelog);
    if (readyForTestTime) {
      const readyForTestDate = new Date(readyForTestTime);
      const readyForTestCell = dateTimeToFractionalCellInRange(
        sprintStartDate,
        readyForTestDate,
        totalParts
      );
      // Используем переход в readyForTest, если он после планового окончания
      if (readyForTestCell > plannedEndCell) {
        baselineEndCell = Math.min(readyForTestCell, totalParts);
      }
    }
  }

  if (plannedEndCell >= baselineEndCell) return null;

  const baselineStart = plannedEndCell;
  const baselineWidth = baselineEndCell - plannedEndCell;

  return (
    <div
      key={`baseline-${taskId}`}
      className={`absolute pointer-events-none overflow-hidden rounded-lg ${ZIndex.class('baselineOverBar')}`}
      style={{
        left: `calc(${(baselineStart / totalParts) * 100}% - ${PHASE_ROW_INSET_PX}px)`,
        width: `${(baselineWidth / totalParts) * 100}%`,
        height: barHeight,
        top: barTopOffset,
        background:
          'repeating-linear-gradient(45deg, rgb(254 226 226), rgb(254 226 226) 8px, rgb(252 165 165) 8px, rgb(252 165 165) 16px)',
      }}
    >
      <div
        className="absolute inset-0 dark:block hidden"
        style={{
          background:
            'repeating-linear-gradient(45deg, rgb(127 29 29), rgb(127 29 29) 8px, rgb(153 27 27) 8px, rgb(153 27 27) 16px)',
        }}
      />
    </div>
  );
}
