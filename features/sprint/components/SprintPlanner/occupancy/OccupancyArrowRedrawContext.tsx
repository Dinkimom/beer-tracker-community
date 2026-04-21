'use client';

import { createContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useXarrow } from 'react-xarrows';

/** Один useXarrow на дерево занятости внутри Xwrapper; стабильный колбэк для детей. */
export const OccupancyArrowRedrawContext = createContext<(() => void) | null>(null);

export function OccupancyXarrowRedrawProvider({ children }: { children: ReactNode }) {
  const rawRedraw = useXarrow();
  const rawRef = useRef(rawRedraw);
  useEffect(() => {
    rawRef.current = rawRedraw;
  });
  const stableRedraw = useCallback(() => {
    rawRef.current();
  }, []);

  return (
    <OccupancyArrowRedrawContext.Provider value={stableRedraw}>{children}</OccupancyArrowRedrawContext.Provider>
  );
}
