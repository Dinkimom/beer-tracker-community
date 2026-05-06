import type { Task } from '@/types';

import { describe, expect, it } from 'vitest';

import {
  getTasksToMoveOnSprintFinish,
  isTaskClosedForSprintFinish,
} from './useFinishSprintModal';

function task(overrides: Partial<Task>): Task {
  return {
    id: 'TASK-1',
    link: '',
    name: 'Task',
    team: 'Back',
    ...overrides,
  };
}

describe('finish sprint task transfer', () => {
  it('treats only closed tasks as non-transferable', () => {
    expect(isTaskClosedForSprintFinish(task({ originalStatus: 'closed' }))).toBe(true);
    expect(isTaskClosedForSprintFinish(task({ originalStatus: 'Closed' }))).toBe(true);
    expect(isTaskClosedForSprintFinish(task({ originalStatus: 'rc' }))).toBe(false);
  });

  it('moves rc tasks and skips only goal and closed tasks', () => {
    const tasks = [
      task({ id: 'GOAL-1', originalStatus: 'open' }),
      task({ id: 'TASK-2', originalStatus: 'closed' }),
      task({ id: 'TASK-3', originalStatus: 'rc' }),
      task({ id: 'TASK-4', originalStatus: 'inProgress' }),
    ];

    expect(getTasksToMoveOnSprintFinish(tasks, new Set(['GOAL-1'])).map(t => t.id)).toEqual([
      'TASK-3',
      'TASK-4',
    ]);
  });
});
