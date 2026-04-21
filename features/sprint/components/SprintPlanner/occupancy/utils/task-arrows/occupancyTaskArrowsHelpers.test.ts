import type { Task, TaskPosition } from '@/types';

import { describe, expect, it } from 'vitest';

import { PARTS_PER_DAY } from '@/constants';
import {
  buildOccupancyDevToQaLinks,
  filterOccupancyUserTaskLinks,
  getLeftmostTaskIdInRow,
  getOccupancyRowTaskIds,
  getOccupancyTaskPositionsSignature,
  getRightmostTaskIdInRow,
  resolveOccupancyArrowEndpoints,
} from '@/features/sprint/components/SprintPlanner/occupancy/utils/task-arrows/occupancyTaskArrowsHelpers';
import { TASK_ARROWS_DEV_QA_LINK_PREFIX } from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';

/** Упрощённая позиция по диапазону ячеек (для тестов хелперов стрелок). */
function posFromCells(startCell: number, endCell: number): TaskPosition {
  const duration = endCell - startCell;
  return {
    assignee: 'u',
    duration,
    startDay: Math.floor(startCell / PARTS_PER_DAY),
    startPart: startCell % PARTS_PER_DAY,
    taskId: 't',
  };
}

describe('getOccupancyTaskPositionsSignature', () => {
  it('is stable for same positions', () => {
    const m = new Map<string, TaskPosition>([
      ['b', posFromCells(1, 3)],
      ['a', posFromCells(0, 2)],
    ]);
    expect(getOccupancyTaskPositionsSignature(m)).toBe(getOccupancyTaskPositionsSignature(m));
  });
});

describe('filterOccupancyUserTaskLinks', () => {
  it('drops links whose endpoints are not in order', () => {
    const links = [{ fromTaskId: 'a', id: '1', toTaskId: 'b' }];
    expect(filterOccupancyUserTaskLinks(links, ['a'], new Map())).toHaveLength(0);
  });

  it('drops redundant dev–QA pair as user link', () => {
    const devToQa = new Map([['dev1', 'qa1']]);
    const links = [{ fromTaskId: 'dev1', id: '1', toTaskId: 'qa1' }];
    expect(filterOccupancyUserTaskLinks(links, ['dev1', 'qa1'], devToQa)).toHaveLength(0);
  });
});

describe('buildOccupancyDevToQaLinks', () => {
  it('adds synthetic link when both in plan and ordered', () => {
    const taskLinks: Array<{ fromTaskId: string; toTaskId: string }> = [];
    const devToQa = new Map([['d1', 'q1']]);
    const positions = new Map<string, TaskPosition>([
      ['d1', posFromCells(0, 1)],
      ['q1', posFromCells(2, 3)],
    ]);
    const out = buildOccupancyDevToQaLinks(taskLinks, devToQa, positions, ['d1', 'q1']);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(`${TASK_ARROWS_DEV_QA_LINK_PREFIX}d1`);
  });
});

describe('getOccupancyRowTaskIds', () => {
  const tasksMap = new Map<string, Task>([
    ['qa1', { id: 'qa1', originalTaskId: 'dev1' } as Task],
  ]);
  const positions = new Map<string, TaskPosition>([
    ['dev1', posFromCells(0, 1)],
    ['qa1', posFromCells(2, 3)],
  ]);

  it('returns dev+qa for dev row', () => {
    const devToQa = new Map([['dev1', 'qa1']]);
    expect(getOccupancyRowTaskIds('dev1', devToQa, positions, tasksMap).sort()).toEqual([
      'dev1',
      'qa1',
    ]);
  });

  it('returns dev+qa for qa card via originalTaskId', () => {
    const devToQa = new Map<string, string>();
    expect(getOccupancyRowTaskIds('qa1', devToQa, positions, tasksMap).sort()).toEqual([
      'dev1',
      'qa1',
    ]);
  });
});

describe('getRightmostTaskIdInRow / getLeftmostTaskIdInRow', () => {
  const positions = new Map<string, TaskPosition>([
    ['a', posFromCells(0, 2)],
    ['b', posFromCells(5, 8)],
  ]);

  it('picks rightmost by end cell', () => {
    expect(getRightmostTaskIdInRow(['a', 'b'], positions)).toBe('b');
  });

  it('picks leftmost by start cell', () => {
    expect(getLeftmostTaskIdInRow(['a', 'b'], positions)).toBe('a');
  });
});

describe('resolveOccupancyArrowEndpoints', () => {
  const taskIdsOrder = ['a', 'b'];
  const positions = new Map<string, TaskPosition>([
    ['a', posFromCells(0, 2)],
    ['b', posFromCells(10, 12)],
  ]);
  const getRow = (id: string) => [id];

  it('uses occupancy-start for non-adjacent user links', () => {
    const r = resolveOccupancyArrowEndpoints(
      { fromTaskId: 'a', id: 'L1', toTaskId: 'b' },
      false,
      taskIdsOrder,
      positions,
      getRow
    );
    expect(r.endElement).toBe('occupancy-start-b');
    expect(r.endAnchor).toBe('left');
  });

  it('uses dev-qa straight endpoints', () => {
    const r = resolveOccupancyArrowEndpoints(
      { fromTaskId: 'd', id: `${TASK_ARROWS_DEV_QA_LINK_PREFIX}d`, toTaskId: 'q' },
      true,
      taskIdsOrder,
      positions,
      getRow
    );
    expect(r.endElement).toBe('occupancy-start-q');
    expect(r.arrowStartTaskId).toBe('d');
    expect(r.arrowEndTaskId).toBe('q');
  });
});
