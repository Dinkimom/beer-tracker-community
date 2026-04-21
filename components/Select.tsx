'use client';

import type { SelectHTMLAttributes } from 'react';

const BASE_CLASSES =
  'w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  className?: string;
}

export function Select({ className = '', ...props }: SelectProps) {
  return (
    <select
      className={`${BASE_CLASSES} ${className}`}
      {...props}
    />
  );
}
