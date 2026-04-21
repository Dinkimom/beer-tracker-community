import type { TaskPosition } from '@/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSprintPositions } from '@/lib/beerTrackerApi';

import { TaskPositionsStore } from './taskPositionsStore';

vi.mock('@/lib/beerTrackerApi', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    fetchSprintPositions: vi.fn(),
    saveTaskPosition: vi.fn().mockResolvedValue(undefined),
    saveTaskPositionsBatch: vi.fn().mockResolvedValue(undefined),
  });
});

const mockFetch = vi.mocked(fetchSprintPositions);

function pos(id: string, startDay = 0): TaskPosition {
  return {
    assignee: 'dev1',
    duration: 3,
    startDay,
    startPart: 0,
    taskId: id,
  };
}

describe('TaskPositionsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('устаревший ответ fetchSprintPositions после локального savePosition не затирает карту', async () => {
    let resolveFetch!: (value: TaskPosition[]) => void;
    const fetchPromise = new Promise<TaskPosition[]>((r) => {
      resolveFetch = r;
    });
    mockFetch.mockReturnValue(fetchPromise);

    const store = new TaskPositionsStore();
    const loadPromise = store.loadSprint(42);

    await Promise.resolve();

    store.savePosition(pos('after-drag', 5), false, undefined, true);

    expect(store.positions.get('after-drag')?.startDay).toBe(5);

    resolveFetch([pos('from-server', 0)]);

    await loadPromise;

    expect(store.positions.get('after-drag')?.startDay).toBe(5);
    expect(store.positions.has('from-server')).toBe(false);
  });

  it('устаревший ответ fetch после setPositionsWithSave не затирает карту', async () => {
    let resolveFetch!: (value: TaskPosition[]) => void;
    const fetchPromise = new Promise<TaskPosition[]>((r) => {
      resolveFetch = r;
    });
    mockFetch.mockReturnValue(fetchPromise);

    const store = new TaskPositionsStore();
    const loadPromise = store.loadSprint(42);

    await Promise.resolve();

    const m = new Map<string, TaskPosition>();
    m.set('t1', pos('t1', 7));
    store.setPositionsWithSave(m);

    expect(store.positions.get('t1')?.startDay).toBe(7);

    resolveFetch([pos('stale', 0)]);

    await loadPromise;

    expect(store.positions.get('t1')?.startDay).toBe(7);
    expect(store.positions.has('stale')).toBe(false);
  });

  it('актуальный ответ fetch применяется, если не было мутаций после старта загрузки', async () => {
    mockFetch.mockResolvedValue([pos('a', 1), pos('b', 2)]);

    const store = new TaskPositionsStore();
    await store.loadSprint(42);

    expect(store.positions.size).toBe(2);
    expect(store.positions.get('a')?.startDay).toBe(1);
  });

  it('positionsLoadPending и positionsSettledSprintId отражают завершение загрузки', async () => {
    let resolveFetch!: (value: TaskPosition[]) => void;
    const fetchPromise = new Promise<TaskPosition[]>((r) => {
      resolveFetch = r;
    });
    mockFetch.mockReturnValue(fetchPromise);

    const store = new TaskPositionsStore();
    const done = store.loadSprint(42);

    await Promise.resolve();
    expect(store.positionsLoadPending).toBe(true);
    expect(store.positionsSettledSprintId).toBe(null);

    resolveFetch([]);
    await done;

    expect(store.positionsLoadPending).toBe(false);
    expect(store.positionsSettledSprintId).toBe(42);
  });

  it('повторный loadSprint для того же спринта без in-flight не дергает API (нет цикла с монтированием планера)', async () => {
    mockFetch.mockResolvedValue([pos('a', 1)]);

    const store = new TaskPositionsStore();
    await store.loadSprint(42);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await store.loadSprint(42);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
