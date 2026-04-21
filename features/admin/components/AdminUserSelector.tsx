'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

interface TrackerUser {
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  trackerId: string;
}

interface AdminUserSelectorProps {
  className?: string;
  orgId: string;
  placeholder?: string;
  value: string;
  onChange: (trackerId: string, user: TrackerUser | null) => void;
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase() || '?';
}

export function AdminUserSelector({
  className,
  orgId,
  placeholder,
  value,
  onChange,
}: AdminUserSelectorProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('admin.userSelector.defaultPlaceholder');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TrackerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TrackerUser | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!value) {
      setSelectedUser(null);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen || searchQuery.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      fetch(
        `/api/admin/organizations/${orgId}/users/search?q=${encodeURIComponent(searchQuery)}`,
        { signal: controller.signal }
      )
        .then((r) => r.json() as Promise<{ items?: TrackerUser[] }>)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.items ?? []);
          }
        })
        .catch(() => {
          /* aborted */
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, searchQuery, orgId]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSearchQuery(selectedUser?.displayName ?? '');
    setResults([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [selectedUser?.displayName]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    } else {
      queueMicrotask(() => {
        setSearchQuery('');
        setResults([]);
      });
    }
  }, [isOpen, handleClickOutside]);

  const handleSelect = useCallback(
    (user: TrackerUser) => {
      setSelectedUser(user);
      onChange(user.trackerId, user);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedUser(null);
      onChange('', null);
    },
    [onChange]
  );

  const handleClearInput = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={containerRef} className={className ? `relative ${className}` : 'relative'}>
      {isOpen ? (
        <>
          <div
            className="flex items-center gap-2 min-h-[36px] px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            style={{ zIndex: ZIndex.dropdownContent + 1 }}
          >
            <input
              ref={inputRef}
              className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none text-sm"
              placeholder={t('admin.userSelector.searchPlaceholder')}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <HeaderIconButton
                aria-label={t('admin.userSelector.clearSearchAria')}
                className="h-7 w-7 shrink-0"
                title={t('admin.userSelector.clearTitle')}
                type="button"
                onClick={handleClearInput}
              >
                <Icon className="h-4 w-4" name="x" />
              </HeaderIconButton>
            ) : null}
          </div>
          {searchQuery.length >= MIN_SEARCH_LENGTH && (
            <div
              className="absolute top-full left-0 right-0 z-10 mt-1 min-w-full rounded-lg border border-gray-200 bg-white py-2 dark:border-gray-700 dark:bg-gray-800"
              style={{ zIndex: ZIndex.dropdownContent }}
            >
              {loading && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('admin.userSelector.searching')}
                </div>
              )}
              {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('admin.userSelector.empty')}
                </div>
              )}
              {!loading && results.length > 0 && (
                <div className="max-h-52 overflow-y-auto">
                  {results.map((user) => {
                    const isSelected = user.trackerId === value;
                    return (
                      <Button
                        key={user.trackerId}
                        className={`h-auto min-h-0 w-full justify-start gap-3 rounded-none px-3 py-2 text-left text-sm font-normal ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/30'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                        type="button"
                        variant="ghost"
                        onClick={() => handleSelect(user)}
                      >
                        <Avatar
                          avatarUrl={user.avatarUrl ?? null}
                          initials={getInitials(user.displayName)}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {user.displayName}
                          {user.email ? (
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Icon
                            className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                            name="check"
                          />
                        ) : null}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="relative w-full">
          <Button
            className={`h-auto min-h-[36px] w-full justify-between gap-2 px-3 py-2 text-left text-sm font-normal ${value ? 'pr-[4.5rem]' : ''}`}
            type="button"
            variant="outline"
            onClick={handleOpen}
          >
            {selectedUser ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar
                  avatarUrl={selectedUser.avatarUrl ?? null}
                  initials={getInitials(selectedUser.displayName)}
                  size="sm"
                />
                <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {selectedUser.displayName}
                </span>
              </div>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{resolvedPlaceholder}</span>
            )}
            <Icon className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-400" name="chevron-down" />
          </Button>
          {value ? (
            <HeaderIconButton
              aria-label={t('admin.userSelector.resetSelectionAria')}
              className="absolute right-11 top-1/2 z-10 -translate-y-1/2"
              title={t('admin.userSelector.clearTitle')}
              type="button"
              onClick={handleClear}
            >
              <Icon className="h-3.5 w-3.5" name="x" />
            </HeaderIconButton>
          ) : null}
        </div>
      )}
    </div>
  );
}
