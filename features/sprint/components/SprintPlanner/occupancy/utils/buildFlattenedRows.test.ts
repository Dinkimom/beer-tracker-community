import type { OccupancyTaskOrder } from '@/lib/beerTrackerApi';
import type { Task, TaskPosition } from '@/types';

import { describe, expect, it } from 'vitest';

import { buildFlattenedRows } from './buildFlattenedRows';

function task(partial: Partial<Task> & { id: string; name: string }): Task {
  const { id, name, ...rest } = partial;
  return {
    id,
    name,
    link: rest.link ?? '#',
    team: rest.team ?? 'Web',
    ...rest,
  } as Task;
}

function pos(overrides: Partial<TaskPosition> & Pick<TaskPosition, 'assignee'>): TaskPosition {
  const { assignee, ...rest } = overrides;
  return {
    taskId: overrides.taskId ?? 'tp',
    assignee,
    duration: overrides.duration ?? 1,
    startDay: overrides.startDay ?? 0,
    startPart: overrides.startPart ?? 0,
    ...rest,
  };
}

describe('buildFlattenedRows', () => {
  it('falls back to extracting issue key from parent.self when parent.key is missing', () => {
    const parent = {
      id: 'p1',
      display: 'Parent',
      // intentionally omit key; buildFlattenedRows should fallback to extracting it from `self`
      self: 'https://tracker.yandex.ru/issues/PROJ-123',
    } as any;

    const t1 = task({ id: 't1', name: 'T1', parent: parent as any });
    const t2 = task({ id: 't2', name: 'T2', parent: parent as any });

    const taskPositions = new Map<string, TaskPosition>([
      ['t1', pos({ assignee: 'u1', taskId: 't1' })],
      ['t2', pos({ assignee: 'u1', taskId: 't2' })],
    ]);

    const rows = buildFlattenedRows(
      [t1, t2],
      taskPositions,
      '',
      undefined,
      undefined as OccupancyTaskOrder | undefined
    );

    const parentRow = rows.find((r) => r.type === 'parent' && r.id === 'p1');
    expect(parentRow && parentRow.type).toBe('parent');
    expect(parentRow && 'key' in parentRow && parentRow.key).toBe('PROJ-123');
  });
});

