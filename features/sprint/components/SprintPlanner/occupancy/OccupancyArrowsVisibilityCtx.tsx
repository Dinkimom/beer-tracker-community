'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** API регистрации видимости якорей — ссылка на value стабильна, строки не ререндерятся при скролле. */
export interface OccupancyArrowsRegisterCtxValue {
  registerVisible: (taskIds: string[], inView: boolean) => void;
}

/** Снимок видимых taskId — меняется при скролле; подписываться только там, где нужен (стрелки). */
export interface OccupancyArrowsVisibleIdsCtxValue {
  visibleTaskIds: Set<string>;
}

export const OccupancyArrowsRegisterCtx = createContext<OccupancyArrowsRegisterCtxValue | null>(null);

export const OccupancyArrowsVisibleIdsCtx = createContext<OccupancyArrowsVisibleIdsCtxValue | null>(null);

export function useOccupancyArrowsRegister(): OccupancyArrowsRegisterCtxValue | null {
  return useContext(OccupancyArrowsRegisterCtx);
}

export function useOccupancyArrowsVisibleIds(): OccupancyArrowsVisibleIdsCtxValue | null {
  return useContext(OccupancyArrowsVisibleIdsCtx);
}

export function OccupancyArrowsVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visibleTaskIds, setVisibleTaskIds] = useState<Set<string>>(() => new Set());

  const registerVisible = useCallback((taskIds: string[], inView: boolean) => {
    setVisibleTaskIds((prev) => {
      const next = new Set(prev);
      for (const id of taskIds) {
        if (inView) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const registerValue = useMemo<OccupancyArrowsRegisterCtxValue>(
    () => ({ registerVisible }),
    [registerVisible]
  );

  const visibleIdsValue = useMemo<OccupancyArrowsVisibleIdsCtxValue>(
    () => ({ visibleTaskIds }),
    [visibleTaskIds]
  );

  return (
    <OccupancyArrowsRegisterCtx.Provider value={registerValue}>
      <OccupancyArrowsVisibleIdsCtx.Provider value={visibleIdsValue}>
        {children}
      </OccupancyArrowsVisibleIdsCtx.Provider>
    </OccupancyArrowsRegisterCtx.Provider>
  );
}

/** Вызывать из строки занятости внутри OccupancyLazyByViewport: сообщает, что якоря стрелок для taskIds в viewport (inView) или нет */
export function OccupancyArrowsVisibilityReporter({
  inView,
  taskIds,
}: {
  inView: boolean;
  taskIds: string[];
}) {
  const ctx = useOccupancyArrowsRegister();
  const taskIdsKey = taskIds.join(',');
  // Стабилизируем по содержимому: ссылка на taskIds с родителя может меняться без смены набора id.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- зависимость только от taskIdsKey
  const stableTaskIds = useMemo(() => taskIds.slice(), [taskIdsKey]);

  const registerVisible = ctx?.registerVisible;
  useEffect(() => {
    if (!registerVisible || stableTaskIds.length === 0) return;
    registerVisible(stableTaskIds, inView);
    return () => registerVisible(stableTaskIds, false);
  }, [inView, registerVisible, stableTaskIds]);

  return null;
}
