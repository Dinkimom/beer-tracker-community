'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';

export interface CustomSelectOption<T extends string> {
  /** Нельзя выбрать (например, значение уже занято другой сущностью). */
  disabled?: boolean;
  label: string;
  value: T;
}

interface CustomSelectProps<T extends string> {
  className?: string;
  /** Блокирует открытие списка и смену значения (например, пока идёт сохранение). */
  disabled?: boolean;
  options: CustomSelectOption<T>[];
  /** Поле поиска над списком: фильтр по подстроке в label и value. */
  searchable?: boolean;
  /** Плейсхолдер поля поиска (при searchable). */
  searchPlaceholder?: string;
  /** Префикс только для отображаемого выбранного значения (в дропдауне не показывается) */
  selectedPrefix?: string;
  /** `compact` — h-8, как селектор спринта и кнопки в шапке планера. */
  size?: 'compact' | 'default';
  title?: string;
  value: T;
  onChange: (value: T) => void;
  /** Кастомная строка опции (например, с иконкой/цветом). */
  renderOption?: (option: CustomSelectOption<T>, ctx: { isSelected: boolean }) => ReactNode;
  /** Кастомное содержимое кнопки выбора (вместо label + selectedPrefix). */
  renderTriggerValue?: (ctx: {
    selectedOption: CustomSelectOption<T> | undefined;
    value: T;
  }) => ReactNode;
}

function optionMatchesQuery<T extends string>(
  option: CustomSelectOption<T>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    option.label.toLowerCase().includes(q) || String(option.value).toLowerCase().includes(q)
  );
}

export function CustomSelect<T extends string>({
  className,
  disabled = false,
  size = 'default',
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = 'Поиск…',
  renderOption,
  renderTriggerValue,
  selectedPrefix,
  title,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen && !disabled) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [disabled, isOpen]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (isOpen && searchable && !disabled) {
      const id = requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [disabled, isOpen, searchable]);

  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current || !dropdownRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        dropdownRef.current.style.position = 'fixed';
        dropdownRef.current.style.top = `${rect.bottom + 4}px`;
        dropdownRef.current.style.left = `${rect.left}px`;
        dropdownRef.current.style.width = `${rect.width}px`;
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  let displayText: string;
  if (selectedOption) {
    displayText = selectedPrefix
      ? `${selectedPrefix}${selectedOption.label}`
      : selectedOption.label;
  } else {
    displayText = String(value);
  }

  const triggerInner =
    renderTriggerValue?.({ selectedOption, value }) ?? (
      <span className="min-w-0 truncate whitespace-nowrap">{displayText}</span>
    );

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const filteredOptions = searchable
    ? options.filter((o) => optionMatchesQuery(o, searchQuery))
    : options;

  return (
    <div ref={containerRef} className={className ? `relative ${className}` : 'relative'}>
      <Button
        ref={buttonRef}
        className={`w-full !items-center !justify-between !gap-2 !px-3 !py-0 font-medium ${
          size === 'compact' ? '!h-8 text-sm' : '!h-9 text-sm'
        }`}
        disabled={disabled}
        title={title}
        type="button"
        variant="outline"
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((open) => {
            const next = !open;
            if (next) {
              setSearchQuery('');
            }
            return next;
          });
        }}
      >
        <span className="flex min-w-0 flex-1 items-center text-left">{triggerInner}</span>
        <Icon
          className={`${size === 'compact' ? 'h-3.5 w-3.5' : 'h-3 w-3'} shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          name="chevron-down"
        />
      </Button>

      {isOpen && !disabled &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg ${
              searchable ? 'max-h-72' : 'max-h-60 overflow-y-auto py-1'
            }`}
            style={{ zIndex: ZIndex.modal + 1 }}
          >
            {searchable ? (
              <div className="shrink-0 border-b border-gray-200 px-2 py-2 dark:border-gray-600">
                <input
                  ref={searchInputRef}
                  autoComplete="off"
                  className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400"
                  placeholder={searchPlaceholder}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                />
              </div>
            ) : null}
            <div className={searchable ? 'min-h-0 flex-1 overflow-y-auto py-1' : undefined}>
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Ничего не найдено</p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  const isDisabled = option.disabled === true;
                  let rowClass =
                    'cursor-pointer text-gray-700 hover:!bg-gray-50 dark:text-gray-300 dark:hover:!bg-gray-700';
                  if (isDisabled) {
                    rowClass = 'cursor-not-allowed !text-gray-400 !opacity-60 dark:!text-gray-500';
                  } else if (isSelected) {
                    rowClass =
                      'cursor-pointer !bg-blue-50 !text-blue-700 hover:!bg-blue-50 dark:!bg-blue-900/30 dark:!text-blue-300 dark:hover:!bg-blue-900/30';
                  }
                  return (
                    <Button
                      key={String(option.value)}
                      className={`h-auto min-h-0 w-full rounded-none border-0 !items-center !justify-start !px-3 !py-2 text-left text-sm font-medium shadow-none ${rowClass}`}
                      disabled={isDisabled}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (isDisabled) {
                          return;
                        }
                        handleSelect(option.value);
                      }}
                    >
                      {renderOption ? (
                        renderOption(option, { isSelected })
                      ) : (
                        <span className="block">{option.label}</span>
                      )}
                    </Button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
