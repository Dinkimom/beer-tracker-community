'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';
import {
  getTrackerTokenGateSnapshot,
  subscribeTrackerTokenGate,
} from '@/lib/trackerTokenStorage';

function subscribeClient() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Маршруты без OAuth-токена трекера в localStorage (онбординг продукта, админка SaaS). */
function bypassTrackerToken(pathname: string): boolean {
  if (
    pathname === '/auth-setup' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/invite/')
  ) {
    return true;
  }
  if (pathname.startsWith('/admin')) {
    return true;
  }
  if (pathname.startsWith('/demo')) {
    return true;
  }
  return false;
}

/**
 * Компонент для защиты маршрутов, требующих OAuth-токен трекера в браузере.
 * On-prem до инициализации БД — сразу на первичную регистрацию (`/register?next=/admin`),
 * иначе при отсутствии токена — на `/auth-setup`.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const usableTrackerToken = useSyncExternalStore(
    subscribeTrackerTokenGate,
    getTrackerTokenGateSnapshot,
    () => ''
  );
  const isMounted = useSyncExternalStore(subscribeClient, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!isMounted || bypassTrackerToken(pathname)) {
      return;
    }

    if (usableTrackerToken && usableTrackerToken.trim() !== '') {
      return;
    }

    let cancelled = false;
    async function resolveMissingTrackerToken() {
      try {
        const res = await fetch('/api/onprem/setup-state', { credentials: 'include' });
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          router.push('/auth-setup');
          return;
        }
        const data = (await res.json()) as { hasUsers?: boolean; onPremMode?: boolean };
        if (cancelled) {
          return;
        }
        if (data.onPremMode && data.hasUsers !== true) {
          router.replace('/register?next=/admin');
          return;
        }
        router.push('/auth-setup');
      } catch {
        if (!cancelled) {
          router.push('/auth-setup');
        }
      }
    }
    void resolveMissingTrackerToken();
    return () => {
      cancelled = true;
    };
  }, [isMounted, pathname, router, usableTrackerToken]);

  // До монтирования рендерим тот же UI, что и на сервере (избегаем hydration mismatch)
  if (!isMounted) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="fixed inset-0 isolate flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
        role="status"
        style={{ zIndex: ZIndex.overlay }}
      >
        <div className="flex flex-col items-center gap-4 w-full max-w-md px-8">
          <Icon className="animate-spin h-12 w-12 text-blue-600" name="spinner" />
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (bypassTrackerToken(pathname) || (usableTrackerToken && usableTrackerToken.trim() !== '')) {
    return children;
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 isolate flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
      role="status"
      style={{ zIndex: ZIndex.overlay }}
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-md px-8">
        <Icon className="animate-spin h-12 w-12 text-blue-600" name="spinner" />
        <div className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center">{t('common.loading')}</div>
      </div>
    </div>
  );
}
