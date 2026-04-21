/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedApiSync } from './useDebouncedApiSync';

interface Row {
  id: string;
  v: number;
}

describe('useDebouncedApiSync', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads items when sprintId is valid', async () => {
    const fetchFn = vi.fn().mockResolvedValue([{ id: 'a', v: 1 }] as Row[]);
    const deleteFn = vi.fn().mockResolvedValue(true);
    const saveFn = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useDebouncedApiSync<Row, string, Row>({
        sprintId: 10,
        debounceDelay: 50,
        deleteFn,
        fetchFn,
        getId: (x) => x.id,
        saveFn,
        toApiFormat: (x) => x,
      })
    );

    await waitFor(() => {
      expect(result.current[0]).toEqual([{ id: 'a', v: 1 }]);
    });
    expect(fetchFn).toHaveBeenCalledWith(10);
  });

  it('debounces saveItem so only the last pending update is sent', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue([] as Row[]);
    const saveFn = vi.fn().mockResolvedValue(true);
    const deleteFn = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useDebouncedApiSync<Row, string, Row>({
        sprintId: 1,
        debounceDelay: 300,
        deleteFn,
        fetchFn,
        getId: (x) => x.id,
        saveFn,
        toApiFormat: (x) => x,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchFn).toHaveBeenCalledWith(1);

    act(() => {
      result.current[2]({ id: 'x', v: 1 });
    });
    expect(saveFn).not.toHaveBeenCalled();

    let lastSave: Promise<void>;
    await act(() => {
      lastSave = result.current[2]({ id: 'x', v: 2 });
    });
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      await lastSave!;
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(1, { id: 'x', v: 2 }, true);
  });

  it('uses batchSaveFn when several items are flushed together', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue([] as Row[]);
    const saveFn = vi.fn().mockResolvedValue(true);
    const batchSaveFn = vi.fn().mockResolvedValue({ success: true, count: 2 });
    const deleteFn = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useDebouncedApiSync<Row, string, Row>({
        sprintId: 2,
        debounceDelay: 100,
        batchSaveFn,
        deleteFn,
        fetchFn,
        getId: (x) => x.id,
        saveFn,
        toApiFormat: (x) => x,
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchFn).toHaveBeenCalledWith(2);

    let lastSave: Promise<void>;
    act(() => {
      result.current[2]({ id: 'a', v: 1 });
      lastSave = result.current[2]({ id: 'b', v: 1 });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await lastSave!;
    });

    expect(batchSaveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).not.toHaveBeenCalled();
    expect(batchSaveFn.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a', v: 1 }),
        expect.objectContaining({ id: 'b', v: 1 }),
      ])
    );
  });

  it('does not call save when sprintId is invalid', async () => {
    const fetchFn = vi.fn().mockResolvedValue([] as Row[]);
    const saveFn = vi.fn().mockResolvedValue(true);
    const deleteFn = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useDebouncedApiSync<Row, string, Row>({
        sprintId: null,
        debounceDelay: 20,
        deleteFn,
        fetchFn,
        getId: (x) => x.id,
        saveFn,
        toApiFormat: (x) => x,
      })
    );

    await act(async () => {
      await result.current[2]({ id: 'x', v: 1 });
    });
    expect(saveFn).not.toHaveBeenCalled();
  });
});
