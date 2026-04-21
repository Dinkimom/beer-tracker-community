/**
 * Компонент overlay загрузки
 * Отображается при загрузке данных.
 * Рендерится в портал (document.body), чтобы быть поверх любых overflow-hidden
 * и stacking context страницы (таблица, сайдбар и т.д.).
 */

'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

/** Тот же спиннер, что и у Icon name="spinner". Вращение на обёртке — анимация не «залипает» при нагрузке main thread. */
function SpinnerIcon() {
  return (
    <div className="h-12 w-12 animate-spin" style={{ willChange: 'transform' }}>
      <svg
        className="h-full w-full text-blue-600"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" opacity="0.25" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  /** When omitted, uses localized default from `common.loading`. */
  message?: string;
}

const emptySubscribe = () => () => {};

export function LoadingOverlay({ isVisible, message: messageProp }: LoadingOverlayProps) {
  const { t } = useI18n();
  const message = messageProp ?? t('common.loading');
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => typeof document !== 'undefined',
    () => false
  );

  if (!isVisible) return null;
  if (!mounted) return null;

  const overlay = (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 isolate flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
      role="status"
      style={{ zIndex: ZIndex.overlay }}
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-md px-8">
        <SpinnerIcon />
        <div className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center">{message}</div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
