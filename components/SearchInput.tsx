'use client';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';

interface SearchInputProps {
  className?: string;
  placeholder?: string;
  size?: 'md' | 'sm';
  value: string;
  onChange: (value: string) => void;
}

const sizeClasses = {
  sm: {
    input: 'pl-8 pr-8 py-1.5 text-xs rounded-md',
    icon: 'w-3.5 h-3.5',
    iconLeft: 'left-2.5',
    clearRight: 'right-2',
  },
  md: {
    input: 'pl-9 pr-8 py-0 text-sm rounded-lg h-8',
    icon: 'w-4 h-4',
    iconLeft: 'left-2.5',
    clearRight: 'right-2',
  },
};

export function SearchInput({
  value,
  onChange,
  placeholder: placeholderProp,
  size = 'sm',
  className = '',
}: SearchInputProps) {
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t('common.searchPlaceholder');
  const s = sizeClasses[size];
  return (
    <div className={`relative w-full ${className}`}>
      <Icon
        className={`absolute ${s.iconLeft} top-1/2 -translate-y-1/2 ${s.icon} text-gray-400 dark:text-gray-500`}
        name="search"
      />
      <input
        className={`w-full ${s.input} text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <HeaderIconButton
          aria-label={t('common.clearSearch')}
          className={`absolute ${s.clearRight} top-1/2 z-10 h-7 w-7 -translate-y-1/2`}
          title={t('common.clearSearch')}
          type="button"
          onClick={() => onChange('')}
        >
          <Icon className={s.icon} name="x" />
        </HeaderIconButton>
      ) : null}
    </div>
  );
}
