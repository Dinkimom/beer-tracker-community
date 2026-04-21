'use client';

import { createContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useXarrow } from 'react-xarrows';

/** Один useXarrow на свимлейны внутри Xwrapper. */
export const SwimlaneArrowRedrawContext = createContext<(() => void) | null>(null);

export function SwimlaneXarrowRedrawProvider({ children }: { children: ReactNode }) {
  const rawRedraw = useXarrow();
  const rawRef = useRef(rawRedraw);
  useEffect(() => {
    rawRef.current = rawRedraw;
  });
  const stableRedraw = useCallback(() => {
    rawRef.current();
  }, []);

  return (
    <SwimlaneArrowRedrawContext.Provider value={stableRedraw}>{children}</SwimlaneArrowRedrawContext.Provider>
  );
}
