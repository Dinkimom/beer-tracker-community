'use client';

import type { UserOrganizationSummary } from '@/lib/organizations';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

interface AdminOrganizationSelectorProps {
  organizations: readonly UserOrganizationSummary[];
  selectedOrganizationId: string;
}

export function AdminOrganizationSelector({
  organizations,
  selectedOrganizationId,
}: AdminOrganizationSelectorProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = organizations.find((o) => o.organization_id === selectedOrganizationId);

  const handleSelect = useCallback(
    async (organizationId: string) => {
      if (organizationId === selectedOrganizationId) {
        setIsOpen(false);
        return;
      }
      setPending(true);
      try {
        const res = await fetch('/api/auth/admin-active-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ organizationId }),
        });
        if (!res.ok) {
          return;
        }
        setIsOpen(false);
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router, selectedOrganizationId]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  if (organizations.length < 2) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative min-w-0 max-w-[min(100%,320px)] shrink">
      <Button
        ref={buttonRef}
        className={`flex h-10 min-h-0 w-full max-w-[320px] justify-between gap-2 px-3 py-0 text-left text-sm ${
          isOpen ? 'border-gray-400 dark:border-gray-500' : ''
        }`}
        disabled={pending}
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
          {selected?.name ?? t('admin.organizationSelector.placeholderName')}
        </span>
        <Icon
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${
            isOpen ? 'rotate-180' : ''
          }`}
          name="chevron-down"
        />
      </Button>
      {isOpen ? (
        <div
          className={`absolute top-full right-0 z-50 mt-1 max-h-80 min-w-[220px] max-w-[min(100vw-2rem,360px)] overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 ${ZIndex.class('dropdownContent')}`}
        >
          <ul className="py-1" role="listbox">
            {organizations.map((o) => {
              const active = o.organization_id === selectedOrganizationId;
              return (
                <li key={o.organization_id}>
                  <button
                    aria-selected={active}
                    className={[
                      'flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-blue-50 font-medium text-blue-900 dark:bg-blue-500/15 dark:text-blue-100'
                        : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60',
                    ].join(' ')}
                    role="option"
                    type="button"
                    onClick={() => void handleSelect(o.organization_id)}
                  >
                    <span className="truncate">{o.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
