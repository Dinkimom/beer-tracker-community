'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant =
  | 'accent'
  | 'danger'
  | 'dangerOutline'
  | 'ghost'
  | 'outline'
  | 'primary'
  | 'secondary'
  | 'warning';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50',
  secondary:
    'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50',
  /** Как кнопки «вторичного» действия в админке: белый фон и бордер. */
  outline:
    'rounded-lg border border-gray-300 bg-white text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 disabled:pointer-events-none disabled:opacity-50',
  accent:
    'rounded-lg border border-blue-500/60 bg-blue-50 text-blue-900 transition-colors hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-950/60 dark:text-blue-100 dark:hover:bg-blue-900/50 disabled:pointer-events-none disabled:opacity-50',
  warning:
    'rounded-lg border border-amber-400/80 bg-amber-50 text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-500/45 dark:bg-amber-950/55 dark:text-amber-100 dark:hover:bg-amber-900/45 disabled:pointer-events-none disabled:opacity-50',
  danger:
    'bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50',
  /** Как `btnDanger` в админке: контурная деструктивная. */
  dangerOutline:
    'rounded-lg border border-red-200 bg-white text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/40 disabled:pointer-events-none disabled:opacity-50',
  ghost:
    'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  className?: string;
  /** Полная ширина (flex-1 для кнопок в ряду) */
  fullWidth?: boolean;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    fullWidth,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const base =
    'px-4 py-2 text-sm font-medium cursor-pointer inline-flex items-center justify-center gap-2';
  const variantClass = variantClasses[variant];
  const widthClass = fullWidth ? 'flex-1' : '';
  return (
    <button
      ref={ref}
      className={`${base} ${variantClass} ${widthClass} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});
