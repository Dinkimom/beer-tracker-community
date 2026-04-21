'use client';

import type { RegistryUserItem } from '@/lib/beerTrackerApi';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { getUserByTrackerId, searchUsers } from '@/lib/beerTrackerApi';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase() || '?';
}

interface UserSelectorProps {
  className?: string;
  placeholder?: string;
  title?: string;
  value: string;
  onChange: (trackerId: string) => void;
}

export function UserSelector({
  className,
  placeholder = '— выбрать —',
  title,
  value,
  onChange,
}: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<RegistryUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RegistryUserItem | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загрузка пользователя по ID при смене value (для аватара и имени)
  useEffect(() => {
    if (!value) {
      queueMicrotask(() => setSelectedUser(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoadingUser(true));
    getUserByTrackerId(value)
      .then((user) => {
        if (!cancelled) setSelectedUser(user ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // Поиск по запросу (debounce)
  useEffect(() => {
    if (!isOpen || searchQuery.length < MIN_SEARCH_LENGTH) {
      queueMicrotask(() => setResults([]));
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setLoading(true);
      searchUsers(searchQuery)
        .then((items) => setResults(items))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, searchQuery]);

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
    (user: RegistryUserItem) => {
      onChange(user.trackerId);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClearInput = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  const buttonText = loadingUser ? 'Загрузка…' : selectedUser?.displayName || value || placeholder;

  return (
    <div ref={containerRef} className={className ? `relative ${className}` : 'relative'}>
      {isOpen ? (
        <>
          <div
            className="flex items-center gap-2 min-h-[38px] px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            style={{ zIndex: ZIndex.dropdownContent + 1 }}
          >
            <input
              ref={inputRef}
              className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none"
              placeholder="Поиск по имени или фамилии…"
              title={title}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <HeaderIconButton
                className="!h-7 !w-7 shrink-0"
                title="Очистить"
                type="button"
                onClick={handleClearInput}
              >
                <Icon className="h-4 w-4" name="x" />
              </HeaderIconButton>
            ) : null}
          </div>
          {searchQuery.length >= MIN_SEARCH_LENGTH && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50 min-w-full"
              style={{ zIndex: ZIndex.dropdownContent }}
            >
              {loading && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Загрузка…</div>
              )}
              {!loading && results.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Ничего не найдено</div>
              )}
              {!loading && results.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {results.map((user) => {
                  const isSelected = user.trackerId === value;
                  return (
                    <Button
                      key={user.trackerId}
                      className={`h-auto min-h-0 w-full rounded-none border-0 !justify-start !gap-3 !px-3 !py-2 text-left text-sm font-medium shadow-none ${
                        isSelected
                          ? 'cursor-pointer !bg-blue-50 !text-blue-700 hover:!bg-blue-50 dark:!bg-blue-900/30 dark:!text-blue-300 dark:hover:!bg-blue-900/30'
                          : 'cursor-pointer text-gray-700 hover:!bg-gray-50 dark:text-gray-300 dark:hover:!bg-gray-700'
                      }`}
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelect(user)}
                    >
                      <Avatar
                        avatarUrl={user.avatarUrl}
                        initials={getInitials(user.displayName)}
                        size="sm"
                      />
                      <span className="flex-1 min-w-0 truncate">
                        {user.displayName}
                        {user.email && (
                          <span className="ml-1 text-gray-500 dark:text-gray-400 text-xs">{user.email}</span>
                        )}
                      </span>
                      {isSelected && (
                        <Icon className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" name="check" />
                      )}
                    </Button>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </>
      ) : (
        <Button
          className="min-h-[38px] w-full !justify-between !gap-2 !px-3 !py-2 text-sm font-medium"
          title={title}
          type="button"
          variant="outline"
          onClick={handleOpen}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar
                avatarUrl={selectedUser.avatarUrl}
                initials={getInitials(selectedUser.displayName)}
                size="sm"
              />
              <span className="truncate">{selectedUser.displayName}</span>
            </div>
          ) : (
            <span className={value ? '' : 'text-gray-500 dark:text-gray-400'}>{buttonText}</span>
          )}
          <Icon className="h-3 w-3 shrink-0" name="chevron-down" />
        </Button>
      )}
    </div>
  );
}
