'use client';

import type { RegistryEmployeeDirectoryRow } from '@/lib/organizations/organizationMembersRepository';

import { useMemo } from 'react';

import { Avatar } from '@/components/Avatar';
import { useI18n } from '@/contexts/LanguageContext';
import { cardBody, cardHeader, cardShell, hCard, muted } from '@/features/admin/adminUiTokens';

interface AdminRegistryEmployeesClientProps {
  rows: RegistryEmployeeDirectoryRow[];
}

function normalized(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

function displayName(row: RegistryEmployeeDirectoryRow): string {
  const full = normalized(row.full_name);
  if (full) return full;
  const composed = [normalized(row.surname), normalized(row.name), normalized(row.patronymic)]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (composed) return composed;
  return normalized(row.email) || normalized(row.tracker_id) || normalized(row.employee_id) || normalized(row.staff_uid) || '—';
}

function initials(row: RegistryEmployeeDirectoryRow): string {
  const display = displayName(row);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export function AdminRegistryEmployeesClient({ rows }: AdminRegistryEmployeesClientProps) {
  const { t } = useI18n();
  const sorted = useMemo(
    () => rows.map((x) => x).sort((a, b) => displayName(a).localeCompare(displayName(b), 'ru')),
    [rows]
  );

  return (
    <section className={cardShell}>
      <div className={cardHeader}>
        <h1 className={hCard}>{t('admin.shell.nav.members')}</h1>
        <p className={`mt-1 ${muted}`}>Реестр сотрудников из `public.registry_employees`.</p>
      </div>
      <div className={`${cardBody} space-y-3`}>
        {sorted.length === 0 ? <p className={muted}>В реестре пока нет сотрудников.</p> : null}
        {sorted.map((row) => (
          <article
            key={row.employee_id}
            className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  avatarUrl={row.avatar_link}
                  initials={initials(row)}
                  size="md"
                  title={displayName(row)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName(row)}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{row.email || 'email: —'}</p>
                </div>
              </div>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {row.tracker_id || row.employee_id}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {row.status ? `status: ${row.status}` : 'status: —'}
              {row.fired_date ? ` · fired: ${row.fired_date}` : ''}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {row.teams.length > 0
                ? `Команды: ${row.teams.map((team) => team.team_title).join(', ')}`
                : 'Команды: —'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
