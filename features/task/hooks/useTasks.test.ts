import type { Task } from '@/types';

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { patchSprintInfoInTasksQueries, patchSprintTasksQuery, sprintTasksQueryKey } from './useTasks';

describe('sprintTasksQueryKey', () => {
  it('нормализует boardId: undefined → null в ключе', () => {
    expect(sprintTasksQueryKey(10, undefined)).toEqual(['tasks', 10, null]);
  });

  it('сохраняет числовой boardId', () => {
    expect(sprintTasksQueryKey(10, 5)).toEqual(['tasks', 10, 5]);
  });

  it('добавляет сегмент demo для демо-планера', () => {
    expect(sprintTasksQueryKey(10, 5, true)).toEqual(['tasks', 'demo', 10, 5]);
  });
});

describe('patchSprintTasksQuery', () => {
  it('обновляет только tasks в кэше', () => {
    const qc = new QueryClient();
    const bundle = {
      developers: [{ id: 'd1', name: 'A' }],
      sprintInfo: { id: 1, name: 'S', status: 'in_progress' as const, version: 1 },
      tasks: [{ id: 't1', name: 'X' } as Task],
    };
    qc.setQueryData(sprintTasksQueryKey(5, 1), bundle);

    patchSprintTasksQuery(qc, 5, 1, (prev) => [...prev, { id: 't2', name: 'Y' } as Task]);

    const next = qc.getQueryData<typeof bundle>(sprintTasksQueryKey(5, 1));
    expect(next?.tasks).toHaveLength(2);
    expect(next?.developers).toEqual(bundle.developers);
    expect(next?.sprintInfo).toEqual(bundle.sprintInfo);
  });

  it('при пустом кэше ничего не пишет', () => {
    const qc = new QueryClient();
    patchSprintTasksQuery(qc, 5, 1, () => []);
    expect(qc.getQueryData(sprintTasksQueryKey(5, 1))).toBeUndefined();
  });

  it('пишет в демо-ключ при forDemoPlanner', () => {
    const qc = new QueryClient();
    const bundle = {
      developers: [],
      sprintInfo: null,
      tasks: [{ id: 't1', name: 'X' } as Task],
    };
    qc.setQueryData(sprintTasksQueryKey(5, 1, true), bundle);
    patchSprintTasksQuery(qc, 5, 1, (prev) => [...prev, { id: 't2', name: 'Y' } as Task], true);
    const after = qc.getQueryData<{ tasks: Task[] }>(sprintTasksQueryKey(5, 1, true));
    expect(after?.tasks).toHaveLength(2);
  });
});

describe('patchSprintInfoInTasksQueries', () => {
  it('обновляет sprintInfo во всех query текущего спринта', () => {
    const qc = new QueryClient();
    const currentBundle = {
      developers: [],
      sprintInfo: { id: 5, name: 'Sprint 5', status: 'draft', version: 1 },
      tasks: [{ id: 't1', name: 'X' } as Task],
    };
    const otherBundle = {
      developers: [],
      sprintInfo: { id: 6, name: 'Sprint 6', status: 'draft', version: 1 },
      tasks: [{ id: 't2', name: 'Y' } as Task],
    };
    qc.setQueryData(sprintTasksQueryKey(5, 1), currentBundle);
    qc.setQueryData(sprintTasksQueryKey(5, 1, true), currentBundle);
    qc.setQueryData(sprintTasksQueryKey(6, 1), otherBundle);

    patchSprintInfoInTasksQueries(qc, {
      id: 5,
      name: 'Sprint 5',
      status: 'in_progress',
      startDate: '2026-05-01',
      startDateTime: '2026-05-01T00:00:00.000+0000',
      endDate: '2026-05-14',
      endDateTime: '2026-05-14T00:00:00.000+0000',
      version: 2,
    });

    expect(qc.getQueryData<typeof currentBundle>(sprintTasksQueryKey(5, 1))?.sprintInfo).toMatchObject({
      status: 'in_progress',
      version: 2,
    });
    expect(qc.getQueryData<typeof currentBundle>(sprintTasksQueryKey(5, 1, true))?.sprintInfo).toMatchObject({
      status: 'in_progress',
      version: 2,
    });
    expect(qc.getQueryData<typeof otherBundle>(sprintTasksQueryKey(6, 1))?.sprintInfo).toEqual(
      otherBundle.sprintInfo
    );
  });
});
