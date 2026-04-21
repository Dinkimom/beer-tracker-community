'use client';

import type { Developer, Task } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import ReactMarkdown from 'react-markdown';

import { Avatar } from '@/components/Avatar';
import { StatusTag } from '@/components/StatusTag';
import { type StatusPhaseCell, formatDuration } from '@/lib/planner-timeline';
import { getNextWorkingDay, isWeekend } from '@/utils/dateUtils';
import { getInitials } from '@/utils/displayUtils';
import { translateStatus } from '@/utils/translations';

/** Допуск по времени границы фазы (мс) — сопоставление с changelog.updatedAt */
const PHASE_BOUNDARY_MATCH_MS = 2000;

/**
 * Канонический ключ статуса для сопоставления changelog ↔ колбаса (как в mergeInProgressDurationsForAssignee).
 */
function factPhaseCanonicalFromTrackerKey(statusKey: string): string {
  const n = statusKey.toLowerCase().replace(/\s+/g, '');
  if (n === 'closed') return 'closed';
  if (n === 'inprogress') return 'inprogress';
  if (n === 'review' || n === 'inreview' || n === 'in_review') return 'review';
  if (n === 'readyfortest' || n === 'readyfortesting') return 'readyfortest';
  if (n === 'intesting') return 'intesting';
  if (n === 'defect') return 'defect';
  if (n === 'blocked') return 'blocked';
  return n;
}

function changelogStatusMatchesPhase(phaseStatusKey: string, changelogStatusKey: string): boolean {
  return (
    factPhaseCanonicalFromTrackerKey(changelogStatusKey) ===
    factPhaseCanonicalFromTrackerKey(phaseStatusKey)
  );
}

/** Как {@link mapHistoryItemToDuration}: старт фазы на таймлайне может быть сдвинут с выходных. */
function durationStartMsFromChangelogEntryUpdatedAt(iso: string): number {
  const startDate = new Date(iso);
  const normalizedStartDate = isWeekend(startDate) ? getNextWorkingDay(startDate) : startDate;
  return normalizedStartDate.getTime();
}

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

function formatTaskLine(taskId: string, tasksMap: Map<string, Task>): string {
  const t = tasksMap.get(taskId);
  if (!t) return taskId;
  const issueKey = (t as Task & { key?: string }).key ?? t.id;
  return `${issueKey}: ${t.name}`;
}

function parsePointsChangelogValue(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (v != null && typeof v === 'object' && 'key' in v) {
    const n = parseInt(String((v as { key?: unknown }).key), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function formatReestimationLine(deltaSP: number, deltaTP: number): string {
  const parts: string[] = [];
  if (deltaSP !== 0) parts.push(`${deltaSP > 0 ? '+' : ''}${deltaSP} sp`);
  if (deltaTP !== 0) parts.push(`${deltaTP > 0 ? '+' : ''}${deltaTP} tp`);
  return parts.join(' ');
}

function collectStatusTransitionsForPhase(
  changelog: ChangelogEntry[],
  phase: StatusPhaseCell
): Array<{
  entry: ChangelogEntry;
  fromStatusKey: string | null;
  fromStatusName: string | null;
  toStatusKey: string;
  toStatusName: string;
  timestamp: string;
}> {
  const transitions: Array<{
    entry: ChangelogEntry;
    fromStatusKey: string | null;
    fromStatusName: string | null;
    toStatusKey: string;
    toStatusName: string;
    timestamp: string;
  }> = [];

  const phaseStartMs = new Date(phase.startTime).getTime();
  const phaseEndMs = phase.endTime ? new Date(phase.endTime).getTime() : null;

  for (const entry of changelog) {
    const statusField = entry.fields?.find((f) => f.field.id === 'status');
    if (!statusField?.to) continue;

    const fromStatusKey = statusField.from?.key || null;
    const fromStatusName = statusField.from?.display || null;
    const toStatusKey = statusField.to.key;
    const toStatusName = statusField.to.display;
    const entryTimeMs = new Date(entry.updatedAt).getTime();
    const entryAlignedStartMs = durationStartMsFromChangelogEntryUpdatedAt(entry.updatedAt);

    if (
      changelogStatusMatchesPhase(phase.statusKey, toStatusKey) &&
      Math.abs(entryAlignedStartMs - phaseStartMs) < PHASE_BOUNDARY_MATCH_MS
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
      fromStatusKey != null &&
      changelogStatusMatchesPhase(phase.statusKey, fromStatusKey) &&
      phaseEndMs !== null &&
      Math.abs(entryTimeMs - phaseEndMs) < PHASE_BOUNDARY_MATCH_MS
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
  return transitions;
}

function collectReestimationsInPhaseWindow(
  changelog: ChangelogEntry[],
  phaseStartMs: number,
  phaseEndMs: number
): Array<{
  createdBy?: ChangelogEntry['createdBy'];
  label: string;
  updatedAt: string;
}> {
  const out: Array<{
    createdBy?: ChangelogEntry['createdBy'];
    label: string;
    updatedAt: string;
  }> = [];

  for (const entry of changelog) {
    const t = new Date(entry.updatedAt).getTime();
    if (t < phaseStartMs || t > phaseEndMs) continue;

    let deltaSP = 0;
    let deltaTP = 0;
    for (const field of entry.fields ?? []) {
      const fid = field.field.id;
      if (
        (fid === 'storyPoints' || fid === 'story_points') &&
        field.from != null &&
        field.to != null
      ) {
        deltaSP += parsePointsChangelogValue(field.to) - parsePointsChangelogValue(field.from);
      } else if (
        (fid === 'testPoints' || fid === 'test_points') &&
        field.from != null &&
        field.to != null
      ) {
        deltaTP += parsePointsChangelogValue(field.to) - parsePointsChangelogValue(field.from);
      }
    }

    if (deltaSP !== 0 || deltaTP !== 0) {
      out.push({
        createdBy: entry.createdBy,
        label: formatReestimationLine(deltaSP, deltaTP),
        updatedAt: entry.updatedAt,
      });
    }
  }

  out.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  return out;
}

function collectCommentsInPhaseWindow(
  comments: IssueComment[],
  phaseStartMs: number,
  phaseEndMs: number
): IssueComment[] {
  return comments
    .filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= phaseStartMs && t <= phaseEndMs;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

interface SwimlaneFactPhaseTooltipProps {
  changelog: ChangelogEntry[];
  developerMap: Map<string, Developer>;
  /** Верхняя граница интервала для комментариев/переоценок при открытой фазе (как у сегмента) */
  factualEndTimeMs: number;
  hideTaskSummary?: boolean;
  issueComments: IssueComment[];
  phase: StatusPhaseCell;
  taskId: string;
  tasksMap: Map<string, Task>;
}

/**
 * Тултип колбасы факта: длительность, переходы статуса, переоценки и комментарии за интервал фазы.
 */
export function SwimlaneFactPhaseTooltip({
  changelog,
  developerMap,
  factualEndTimeMs,
  hideTaskSummary = false,
  issueComments,
  phase,
  taskId,
  tasksMap,
}: SwimlaneFactPhaseTooltipProps) {
  const durationStr = formatDuration(phase.durationMs);
  const isClosedStatus = normalizeFactStatusKey(phase.statusKey) === 'closed';

  const phaseStartMs = new Date(phase.startTime).getTime();
  const phaseEndMs = phase.endTime ? new Date(phase.endTime).getTime() : factualEndTimeMs;

  const transitions = collectStatusTransitionsForPhase(changelog, phase);
  const reestimations = collectReestimationsInPhaseWindow(changelog, phaseStartMs, phaseEndMs);
  const phaseComments = collectCommentsInPhaseWindow(issueComments, phaseStartMs, phaseEndMs);

  return (
    <div className="p-3 min-w-[280px] max-w-[400px] max-h-[min(70vh,480px)] overflow-y-auto">
      <div
        className={`flex items-center justify-between ${hideTaskSummary ? 'mb-2' : 'mb-3'}`}
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {translateStatus(phase.statusKey)}
        </h3>
        {!isClosedStatus && (
          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{durationStr}</span>
        )}
      </div>

      {!hideTaskSummary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 break-words leading-snug">
          {formatTaskLine(taskId, tasksMap)}
        </p>
      )}

      {transitions.length > 0 && (
        <div className="mb-3 space-y-3">
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
                    <div className="flex items-center gap-2 flex-wrap">
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
      )}

      {reestimations.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Переоценки
          </div>
          <ul className="space-y-2 text-sm">
            {reestimations.map((ev, idx) => {
              const authorId = ev.createdBy?.id;
              const developer = authorId ? developerMap.get(authorId) : undefined;
              const authorName = developer?.name || ev.createdBy?.display || 'Неизвестно';
              return (
                <li key={`${ev.updatedAt}-${idx}`} className="flex justify-between gap-2">
                  <span className="font-medium text-amber-800 dark:text-amber-200">{ev.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 text-right">
                    {authorName} · {formatDateTime(ev.updatedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {phaseComments.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Комментарии
          </div>
          <ul className="space-y-2.5">
            {phaseComments.map((comment) => {
              const authorId = comment.createdBy.id;
              const developer = developerMap.get(authorId);
              const authorName = developer?.name || comment.createdBy.display || 'Неизвестно';
              const avatarUrl = developer?.avatarUrl;
              return (
                <li
                  key={`${comment.id}-${comment.createdAt}`}
                  className="border-t border-gray-100 dark:border-gray-700 pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <Avatar
                      avatarUrl={avatarUrl}
                      initials={getInitials(authorName)}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {authorName}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {formatDateTime(comment.createdAt)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none mt-1 [&_p]:my-0 [&_a]:break-all">
                        <ReactMarkdown>{comment.text || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
