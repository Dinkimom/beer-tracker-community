/**
 * Утилиты для вычисления якорей стрелок связей между карточками на свимлейне
 */

import type { Anchor, Developer, Task, TaskPosition } from '@/types';

import { positionToEndCell, positionToStartCell } from '@/features/sprint/utils/occupancyUtils';

export type { Anchor };

export interface AnchorPair {
  fromAnchor: Anchor;
  toAnchor: Anchor;
}

function cellStart(p: TaskPosition): number {
  return positionToStartCell(p);
}

function cellEnd(p: TaskPosition): number {
  return positionToEndCell(p);
}

/** Индекс строки свимлейна (порядок как в developers). Нет в списке — -1. */
function swimlaneRowIndex(assignee: string, developers: Developer[]): number {
  const i = developers.findIndex((d) => d.id === assignee);
  return i >= 0 ? i : -1;
}

/**
 * Якоря стрелки по позициям на таймлайне и порядку строк (без учёта типа задачи).
 * Для задач на разных строках, идущих друг за другом по времени, даёт вертикальные якоря
 * (низ источника → верх цели и т.д.), а не право→лево.
 */
export function resolveSwimlaneLinkAnchors(
  fromPosition: TaskPosition,
  toPosition: TaskPosition,
  developers: Developer[]
): AnchorPair {
  if (developers.length === 0) {
    return { fromAnchor: 'right', toAnchor: 'left' };
  }

  const fromRow = swimlaneRowIndex(fromPosition.assignee, developers);
  const toRow = swimlaneRowIndex(toPosition.assignee, developers);
  const s0 = cellStart(fromPosition);
  const s1 = cellEnd(fromPosition);
  const t0 = cellStart(toPosition);
  const t1 = cellEnd(toPosition);

  const sameSwimlaneRow =
    fromRow >= 0 && toRow >= 0 && fromRow === toRow;

  if (sameSwimlaneRow) {
    if (t0 >= s1) {
      return { fromAnchor: 'right', toAnchor: 'left' };
    }
    if (t1 <= s0) {
      return { fromAnchor: 'left', toAnchor: 'right' };
    }
    const sm = (s0 + s1) / 2;
    const tm = (t0 + t1) / 2;
    return tm >= sm
      ? { fromAnchor: 'right', toAnchor: 'left' }
      : { fromAnchor: 'left', toAnchor: 'right' };
  }

  const sequentialInTime = t0 >= s1;
  const overlaps = t0 < s1 && t1 > s0;
  const bothRowsKnown = fromRow >= 0 && toRow >= 0;

  if (bothRowsKnown && toRow > fromRow) {
    if (sequentialInTime || overlaps) {
      return { fromAnchor: 'bottom', toAnchor: 'top' };
    }
    return { fromAnchor: 'right', toAnchor: 'left' };
  }

  if (bothRowsKnown && toRow < fromRow) {
    if (sequentialInTime || overlaps) {
      return { fromAnchor: 'top', toAnchor: 'bottom' };
    }
    return { fromAnchor: 'right', toAnchor: 'left' };
  }

  // Неизвестная строка или оба вне списка — горизонталь по таймлайну
  if (t0 >= s1) {
    return { fromAnchor: 'right', toAnchor: 'left' };
  }
  if (t1 <= s0) {
    return { fromAnchor: 'left', toAnchor: 'right' };
  }
  const sm = (s0 + s1) / 2;
  const tm = (t0 + t1) / 2;
  return tm >= sm
    ? { fromAnchor: 'right', toAnchor: 'left' }
    : { fromAnchor: 'left', toAnchor: 'right' };
}

/**
 * Якоря для произвольной связи между задачами на свимлейне (сохранение в state, восстановление после drag).
 */
export function calculateLinkAnchors(
  _fromTask: Task,
  fromPosition: TaskPosition,
  _toTask: Task,
  toPosition: TaskPosition,
  developers: Developer[]
): AnchorPair {
  return resolveSwimlaneLinkAnchors(fromPosition, toPosition, developers);
}

/**
 * Обратная совместимость: размещение QA и автосвязи dev→QA используют ту же геометрию, что и остальные стрелки.
 */
export function getQALinkAnchors(
  devTask: Task,
  devPosition: TaskPosition,
  qaTask: Task,
  qaPosition: TaskPosition,
  developers: Developer[]
): AnchorPair {
  return calculateLinkAnchors(devTask, devPosition, qaTask, qaPosition, developers);
}
