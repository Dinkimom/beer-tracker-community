'use client';

import type { StatusPhaseCell } from '../../utils/statusToCells';
import type { Developer, Task } from '@/types';
import type { ChangelogEntry } from '@/types/tracker';

import { Avatar } from '@/components/Avatar';
import { StatusTag } from '@/components/StatusTag';
import { getInitials } from '@/utils/displayUtils';
import { translateStatus } from '@/utils/translations';

import { formatDuration } from '../../utils/formatDuration';

function normalizeFactStatusKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, '');
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PhaseTooltipProps {
  changelog: ChangelogEntry[];
  developerMap: Map<string, Developer>;
  phase: StatusPhaseCell;
  /** Редко: слитые отрезки (подписи задач в тултипе) */
  tasksMap?: Map<string, Task>;
}

export function PhaseTooltip({ changelog, developerMap, phase, tasksMap }: PhaseTooltipProps) {
  const transitions: Array<{
    entry: ChangelogEntry;
    fromStatusKey: string | null;
    fromStatusName: string | null;
    toStatusKey: string;
    toStatusName: string;
    timestamp: string;
  }> = [];

  const phaseStartTime = new Date(phase.startTime).getTime();
  const phaseEndTime = phase.endTime ? new Date(phase.endTime).getTime() : null;

  for (const entry of changelog) {
    const statusField = entry.fields?.find((f) => f.field.id === 'status');
    if (!statusField?.to) continue;

    const fromStatusKey = statusField.from?.key || null;
    const fromStatusName = statusField.from?.display || null;
    const toStatusKey = statusField.to.key;
    const toStatusName = statusField.to.display;
    const entryTime = new Date(entry.updatedAt).getTime();

    if (
      toStatusKey === phase.statusKey &&
      Math.abs(entryTime - phaseStartTime) < 1000
    ) {
      transitions.push({
        entry,
        fromStatusKey,
        fromStatusName,
        toStatusKey,
        toStatusName,
        timestamp: entry.updatedAt,
      });
    }

    if (
      fromStatusKey === phase.statusKey &&
      phaseEndTime !== null &&
      Math.abs(entryTime - phaseEndTime) < 1000
    ) {
      transitions.push({
        entry,
        fromStatusKey,
        fromStatusName,
        toStatusKey,
        toStatusName,
        timestamp: entry.updatedAt,
      });
    }
  }

  transitions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const durationStr = formatDuration(phase.durationMs);
  const isClosedStatus = normalizeFactStatusKey(phase.statusKey) === 'closed';
  const contributingIds = phase.contributingTaskIds?.filter(Boolean) ?? [];
  const contributingLines =
    tasksMap && contributingIds.length > 0
      ? contributingIds.map((id) => {
          const t = tasksMap.get(id);
          if (t) {
            const issueKey = (t as Task & { key?: string }).key ?? t.id;
            return `${issueKey}: ${t.name}`;
          }
          return id;
        })
      : [];

  return (
    <div className="p-3 min-w-[280px] max-w-[400px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {translateStatus(phase.statusKey)}
        </h3>
        {!isClosedStatus && (
          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{durationStr}</span>
        )}
      </div>

      {contributingLines.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Задачи
          </div>
          <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1 list-disc pl-4">
            {contributingLines.map((line, i) => (
              <li key={`${contributingIds[i]}-${i}`} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {transitions.length > 0 ? (
        <div className="space-y-3">
          {transitions.map((transition, idx) => {
            const author = transition.entry.createdBy;
            const authorId = author?.id;
            const developer = authorId ? developerMap.get(authorId) : undefined;
            const authorName = developer?.name || author?.display || 'Неизвестно';
            const avatarUrl = developer?.avatarUrl;

            return (
              <div key={idx} className="flex items-start gap-2">
                <Avatar
                  avatarUrl={avatarUrl}
                  initials={getInitials(authorName)}
                  size="lg"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {authorName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      {formatDateTime(transition.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {transition.fromStatusKey ? (
                      <>
                        <StatusTag status={transition.fromStatusKey} />
                        <span className="text-gray-400 dark:text-gray-500">→</span>
                      </>
                    ) : null}
                    <StatusTag status={transition.toStatusKey} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : contributingLines.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Нет информации о переходах
        </div>
      ) : null}
    </div>
  );
}
