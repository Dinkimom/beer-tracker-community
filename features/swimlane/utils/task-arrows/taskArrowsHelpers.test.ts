import type { Task, TaskLink, TaskPosition } from '@/types';

import { describe, expect, it } from 'vitest';

import {
  buildDevToQaSyntheticLinks,
  buildTasksMapById,
  filterTaskLinksByVisibleDevelopers,
  filterTaskLinksForActiveDrag,
  filterTaskLinksForSegmentEdit,
  mergeTaskLinksWithDevQa,
  partitionTaskArrowLinks,
  TASK_ARROWS_DEV_QA_LINK_PREFIX,
} from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';

function task(id: string, assignee?: string): Task {
  return { assignee, id } as Task;
}

function pos(assignee: string): TaskPosition {
  return { assignee } as TaskPosition;
}

describe('buildTasksMapById', () => {
  it('indexes tasks by id', () => {
    const m = buildTasksMapById([task('a'), task('b')]);
    expect(m.get('a')?.id).toBe('a');
    expect(m.size).toBe(2);
  });
});

describe('buildDevToQaSyntheticLinks', () => {
  it('adds synthetic link when both tasks on board and pair not in taskLinks', () => {
    const taskLinks: TaskLink[] = [];
    const qaMap = new Map<string, Task>([['dev1', { id: 'qa1' } as Task]]);
    const positions = new Map<string, TaskPosition>([
      ['dev1', pos('u1')],
      ['qa1', pos('u1')],
    ]);
    const out = buildDevToQaSyntheticLinks(taskLinks, qaMap, positions);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(`${TASK_ARROWS_DEV_QA_LINK_PREFIX}dev1`);
    expect(out[0]!.fromTaskId).toBe('dev1');
    expect(out[0]!.toTaskId).toBe('qa1');
  });

  it('skips when user link already exists', () => {
    const taskLinks: TaskLink[] = [
      { fromTaskId: 'dev1', id: 'x', toTaskId: 'qa1' },
    ];
    const qaMap = new Map<string, Task>([['dev1', { id: 'qa1' } as Task]]);
    const positions = new Map<string, TaskPosition>([
      ['dev1', pos('u1')],
      ['qa1', pos('u1')],
    ]);
    expect(buildDevToQaSyntheticLinks(taskLinks, qaMap, positions)).toHaveLength(0);
  });
});

describe('mergeTaskLinksWithDevQa', () => {
  it('returns only user links when qa map missing', () => {
    const links: TaskLink[] = [{ fromTaskId: 'a', id: '1', toTaskId: 'b' }];
    expect(mergeTaskLinksWithDevQa(links, undefined, undefined)).toEqual(links);
  });
});

describe('filterTaskLinksForActiveDrag', () => {
  it('removes links touching active task', () => {
    const links: TaskLink[] = [
      { fromTaskId: 'a', id: '1', toTaskId: 'b' },
      { fromTaskId: 'c', id: '2', toTaskId: 'd' },
    ];
    expect(filterTaskLinksForActiveDrag(links, 'a')).toEqual([links[1]]);
  });
});

describe('filterTaskLinksForSegmentEdit', () => {
  it('removes links touching edited task', () => {
    const links: TaskLink[] = [
      { fromTaskId: 'a', id: '1', toTaskId: 'b' },
      { fromTaskId: 'c', id: '2', toTaskId: 'd' },
    ];
    expect(filterTaskLinksForSegmentEdit(links, 'b')).toEqual([links[1]]);
  });
});

describe('filterTaskLinksByVisibleDevelopers', () => {
  const tasksMap = buildTasksMapById([task('t1', 'u1'), task('t2', 'u2')]);
  const positions = new Map<string, TaskPosition>([
    ['t1', pos('u1')],
    ['t2', pos('u2')],
  ]);
  const visible = new Set(['u1']);

  it('keeps link when both assignees visible', () => {
    const links: TaskLink[] = [{ fromTaskId: 't1', id: '1', toTaskId: 't1' }];
    expect(
      filterTaskLinksByVisibleDevelopers(links, tasksMap, positions, visible)
    ).toHaveLength(1);
  });

  it('drops link when an endpoint is hidden', () => {
    const links: TaskLink[] = [{ fromTaskId: 't1', id: '1', toTaskId: 't2' }];
    expect(
      filterTaskLinksByVisibleDevelopers(links, tasksMap, positions, visible)
    ).toHaveLength(0);
  });
});

describe('partitionTaskArrowLinks', () => {
  const links: TaskLink[] = [
    { fromTaskId: 'a', id: 'L1', toTaskId: 'b' },
    { fromTaskId: 'b', id: 'L2', toTaskId: 'c' },
    { fromTaskId: 'x', id: 'L3', toTaskId: 'y' },
  ];

  it('splits hovered link and task-related links', () => {
    const p = partitionTaskArrowLinks(links, 'L2', 'b');
    expect(p.hoveredLink?.id).toBe('L2');
    // L2 сама в верхнем слое; сюда — только остальные стрелки, затрагивающие ту же задачу
    expect(p.hoveredTaskLinks.map((l) => l.id)).toEqual(['L1']);
    expect(p.regularLinks.map((l) => l.id)).toEqual(['L3']);
  });

  it('puts all in regular when no hover task', () => {
    const p = partitionTaskArrowLinks(links, null, null);
    expect(p.hoveredLink).toBeUndefined();
    expect(p.hoveredTaskLinks).toHaveLength(0);
    expect(p.regularLinks).toHaveLength(3);
  });
});
