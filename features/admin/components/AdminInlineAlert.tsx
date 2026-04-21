'use client';

import type { ReactNode } from 'react';

type AdminInlineAlertVariant = 'error' | 'success' | 'warning';

const containerClass: Record<AdminInlineAlertVariant, string> = {
  error:
    'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300',
  success:
    'flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300',
  warning:
    'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200',
};

const roleForVariant: Record<AdminInlineAlertVariant, string | undefined> = {
  error: 'alert',
  success: undefined,
  warning: 'status',
};

const ariaLiveForVariant: Record<AdminInlineAlertVariant, 'assertive' | 'polite'> = {
  error: 'assertive',
  success: 'polite',
  warning: 'polite',
};

function IconError() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" x2="9" y1="9" y2="15" />
      <line x1="9" x2="15" y1="9" y2="15" />
    </svg>
  );
}

function IconSuccess() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

const iconForVariant: Record<AdminInlineAlertVariant, ReactNode> = {
  error: <IconError />,
  success: <IconSuccess />,
  warning: <IconWarning />,
};

export function AdminInlineAlert({
  children,
  variant,
}: {
  children: ReactNode;
  variant: AdminInlineAlertVariant;
}) {
  return (
    <div
      aria-live={ariaLiveForVariant[variant]}
      className={containerClass[variant]}
      role={roleForVariant[variant]}
    >
      {iconForVariant[variant]}
      <span>{children}</span>
    </div>
  );
}
