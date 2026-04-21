'use client';

import type { ReactNode } from 'react';

/** Светлая тема: холодные нейтрали, без жёлтого акцента на весь экран. */
const LIGHT_AUTH_BG =
  'linear-gradient(165deg, #f0f9ff 0%, #e8f4fc 42%, #f1f5f9 78%, #f8fafc 100%)';

const DARK_AUTH_BG =
  'linear-gradient(165deg, #0f172a 0%, #1e293b 30%, #1e3a5f 60%, #0f172a 100%)';

export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{ background: LIGHT_AUTH_BG }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: DARK_AUTH_BG }}
      />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      {children}
    </div>
  );
}

/** Ссылка в подвале карточки входа/регистрации. */
export const authTextLinkClassName =
  'font-medium text-blue-600 underline-offset-2 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-blue-400 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-gray-900';

/** Общий fallback для Suspense на страницах входа/регистрации. */
export function AuthPageLoadingFallback() {
  return (
    <AuthBackground>
      <AuthCard>
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-ds-text-muted">
          <svg
            className="h-9 w-9 animate-spin text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              fill="currentColor"
            />
          </svg>
          <span className="text-sm">Загрузка…</span>
        </div>
      </AuthCard>
    </AuthBackground>
  );
}
