/**
 * Эпики и стори из issue_snapshots (контракт как у бывшего CH-слоя эпиков/стори).
 */

import type { QueryParams } from '@/types';
import type { TrackerIssue } from '@/types/tracker';

import { query } from '@/lib/db';
import { isDbCompatibilityMode } from '@/lib/env';
import {
  findOverseerIssueByKey,
  queryOverseerIssuesByQueue,
} from '@/lib/snapshots/overseerRawIssuesRead';

export interface PagedTrackerIssues {
  issues: TrackerIssue[];
  totalCount: number;
  totalPages: number;
}

export interface EpicDeepStoryBundle {
  story: TrackerIssue;
  tasks: TrackerIssue[];
}

export interface EpicDeepSnapshotResult {
  epic: TrackerIssue | null;
  stories: EpicDeepStoryBundle[];
}

interface SnapshotDbRow {
  issue_key: string;
  organization_id: string;
  payload: TrackerIssue;
  synced_at: Date | string;
  tracker_updated_at: Date | string | null;
}

const QUEUE_WHERE = `AND (
  (payload->'queue'->>'key') = $2
  OR (payload->'queue'->>'id') = $2
  OR (payload->>'queue') = $2
)`;

function minYearSql(paramIndex: number): string {
  return `AND (
    $${paramIndex}::int IS NULL
    OR (
      CASE
        WHEN (payload->>'createdAt') ~ '^[0-9]{4}-'
        THEN SUBSTRING(payload->>'createdAt' FROM 1 FOR 4)::int
        ELSE EXTRACT(YEAR FROM synced_at)::int
      END >= $${paramIndex}::int
    )
  )`;
}

/**
 * Эпики в очереди (type = epic), сортировка как в CH: по дате создания убыв.
 */
export async function queryEpicSnapshotsForOrgQueue(
  organizationId: string,
  trackerQueueKey: string,
  page: number = 1,
  perPage: number = 100,
  minYear?: number
): Promise<PagedTrackerIssues> {
  const queue = trackerQueueKey.trim();
  const p = Math.max(1, page);
  const n = Math.min(200, Math.max(1, perPage));
  const offset = (p - 1) * n;

  const baseWhere = `
    WHERE organization_id = $1
    ${QUEUE_WHERE}
    AND lower(coalesce(payload->'type'->>'key', '')) = 'epic'
  `;

  const countArgs: QueryParams = [organizationId, queue];
  let countWhere = `${baseWhere  }\n`;
  let limitParam = 3;
  let offsetParam = 4;
  if (minYear !== undefined) {
    countWhere += minYearSql(3);
    countArgs.push(minYear);
    limitParam = 4;
    offsetParam = 5;
  }

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM issue_snapshots ${countWhere}`,
    countArgs
  );
  const totalCount = parseInt(countRes.rows[0]?.count ?? '0', 10);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / n);

  const listArgs: QueryParams = [...countArgs, n, offset];
  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots
     ${baseWhere}
     ${minYear !== undefined ? minYearSql(3) : ''}
     ORDER BY (payload->>'createdAt') DESC NULLS LAST, synced_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    listArgs
  );
  const pgIssues = res.rows.map((r) => r.payload);
  if (pgIssues.length > 0 || !isDbCompatibilityMode()) {
    return {
      issues: pgIssues,
      totalCount,
      totalPages,
    };
  }
  const fallback = await queryOverseerIssuesByQueue(queue);
  const epics = fallback.filter(
    (issue) => (issue.type?.key ?? '').toLowerCase() === 'epic'
  );
  const filtered =
    minYear !== undefined
      ? epics.filter((issue) => {
          const created = issue.createdAt ?? '';
          const year = /^\d{4}-/.test(created)
            ? Number.parseInt(created.slice(0, 4), 10)
            : Number.NaN;
          return Number.isFinite(year) ? year >= minYear : true;
        })
      : epics;
  const paged = filtered.slice(offset, offset + n);
  const fallbackTotal = filtered.length;
  const fallbackPages = fallbackTotal === 0 ? 0 : Math.ceil(fallbackTotal / n);

  return {
    issues: paged,
    totalCount: fallbackTotal,
    totalPages: fallbackPages,
  };
}

export interface QueryStorySnapshotsParams {
  epicKey?: string;
  minYear?: number;
  /** Все стори с непустым parent (как CH requireParent). */
  requireParent?: boolean;
  /** Стори без родителя (как CH withoutParent). */
  withoutParent?: boolean;
}

/**
 * Стори в очереди; фильтры parent/epic как в fetchStories.
 */
export async function queryStorySnapshotsForOrgQueue(
  organizationId: string,
  trackerQueueKey: string,
  page: number = 1,
  perPage: number = 100,
  options: QueryStorySnapshotsParams = {}
): Promise<PagedTrackerIssues> {
  const queue = trackerQueueKey.trim();
  const p = Math.max(1, page);
  const n = Math.min(200, Math.max(1, perPage));
  const offset = (p - 1) * n;

  const extra: string[] = [];
  const args: QueryParams = [organizationId, queue];
  let i = 3;

  if (options.epicKey?.trim()) {
    extra.push(`AND (payload->'parent'->>'key') = $${i}`);
    args.push(options.epicKey.trim());
    extra.push(`AND (payload ? 'parent') AND coalesce(trim(payload->'parent'->>'key'), '') <> ''`);
    i += 1;
  } else if (options.requireParent) {
    extra.push(
      `AND (payload ? 'parent') AND coalesce(trim(payload->'parent'->>'key'), '') <> ''`
    );
  } else if (options.withoutParent) {
    extra.push(`
      AND (
        NOT (payload ? 'parent')
        OR trim(coalesce(payload->'parent'->>'key', '')) = ''
      )
    `);
  }

  if (options.minYear !== undefined) {
    extra.push(minYearSql(i));
    args.push(options.minYear);
    i += 1;
  }

  const extraSql = extra.join('\n');

  const baseWhere = `
    WHERE organization_id = $1
    ${QUEUE_WHERE}
    AND lower(coalesce(payload->'type'->>'key', '')) = 'story'
    ${extraSql}
  `;

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM issue_snapshots ${baseWhere}`,
    args
  );
  const totalCount = parseInt(countRes.rows[0]?.count ?? '0', 10);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / n);

  const listArgs: QueryParams = [...args, n, offset];
  const limitP = i;
  const offsetP = i + 1;

  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots
     ${baseWhere}
     ORDER BY (payload->>'createdAt') DESC NULLS LAST, synced_at DESC
     LIMIT $${limitP} OFFSET $${offsetP}`,
    listArgs
  );
  const pgIssues = res.rows.map((r) => r.payload);
  if (pgIssues.length > 0 || !isDbCompatibilityMode()) {
    return {
      issues: pgIssues,
      totalCount,
      totalPages,
    };
  }
  const fallback = await queryOverseerIssuesByQueue(queue);
  let stories = fallback.filter(
    (issue) => (issue.type?.key ?? '').toLowerCase() === 'story'
  );
  if (options.epicKey?.trim()) {
    const epicKey = options.epicKey.trim();
    stories = stories.filter((issue) => issue.parent?.key === epicKey);
  } else if (options.requireParent) {
    stories = stories.filter((issue) => Boolean(issue.parent?.key?.trim()));
  } else if (options.withoutParent) {
    stories = stories.filter((issue) => !issue.parent?.key?.trim());
  }
  if (options.minYear !== undefined) {
    stories = stories.filter((issue) => {
      const created = issue.createdAt ?? '';
      const year = /^\d{4}-/.test(created)
        ? Number.parseInt(created.slice(0, 4), 10)
        : Number.NaN;
      return Number.isFinite(year) ? year >= options.minYear! : true;
    });
  }
  const paged = stories.slice(offset, offset + n);
  const fallbackTotal = stories.length;
  const fallbackPages = fallbackTotal === 0 ? 0 : Math.ceil(fallbackTotal / n);

  return {
    issues: paged,
    totalCount: fallbackTotal,
    totalPages: fallbackPages,
  };
}

/**
 * Эпик + стори под ним + task/bug под стори (один запрос, разбор в памяти — как fetchEpicDeep).
 */
export async function fetchEpicDeepFromSnapshots(
  organizationId: string,
  epicKey: string
): Promise<EpicDeepSnapshotResult> {
  const key = epicKey.trim();
  if (isDbCompatibilityMode()) {
    const epic = await findOverseerIssueByKey(key);
    if (epic) {
      const epicAny = epic as unknown as { queue?: string | { id?: string; key?: string } };
      const queueKey =
        (typeof epicAny.queue === 'object' && epicAny.queue
          ? (epicAny.queue.key ?? epicAny.queue.id)
          : undefined) ??
        (typeof epicAny.queue === 'string' ? epicAny.queue : '');
      const queueIssues = queueKey ? await queryOverseerIssuesByQueue(queueKey) : [];
      const storiesRaw = queueIssues.filter(
        (issue) =>
          (issue.type?.key ?? '').toLowerCase() === 'story' &&
          issue.parent?.key === key
      );
      const stories: EpicDeepStoryBundle[] = storiesRaw
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((story) => ({
          story,
          tasks: queueIssues.filter((issue) => {
            const t = (issue.type?.key ?? '').toLowerCase();
            return (t === 'task' || t === 'bug') && issue.parent?.key === story.key;
          }),
        }));
      if (stories.length > 0) {
        return { epic, stories };
      }
    }
  }
  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots i
     WHERE organization_id = $1
     AND (
       issue_key = $2
       OR (
         lower(coalesce(payload->'type'->>'key', '')) = 'story'
         AND (payload->'parent'->>'key') = $2
       )
       OR (
         lower(coalesce(payload->'type'->>'key', '')) IN ('task', 'bug')
         AND EXISTS (
           SELECT 1 FROM issue_snapshots s
           WHERE s.organization_id = $1
             AND s.issue_key = (i.payload->'parent'->>'key')
             AND lower(coalesce(s.payload->'type'->>'key', '')) = 'story'
             AND (s.payload->'parent'->>'key') = $2
         )
       )
     )
     ORDER BY
       CASE lower(coalesce(payload->'type'->>'key', ''))
         WHEN 'epic' THEN 0
         WHEN 'story' THEN 1
         ELSE 2
       END,
       coalesce(payload->'parent'->>'key', ''),
       (payload->>'createdAt') ASC NULLS LAST,
       issue_key ASC`,
    [organizationId, key]
  );

  const mapped = res.rows.map((r) => r.payload);

  let epic: TrackerIssue | null = null;
  const storyByKey = new Map<string, TrackerIssue>();
  const tasksByStoryKey = new Map<string, TrackerIssue[]>();

  for (const issue of mapped) {
    const ik = issue.key;
    const typeKey = (issue.type?.key ?? '').toLowerCase();

    if (ik === key) {
      epic = issue;
      continue;
    }
    if (typeKey === 'story') {
      storyByKey.set(ik, issue);
      tasksByStoryKey.set(ik, []);
      continue;
    }
    if (typeKey === 'task' || typeKey === 'bug') {
      const parentKey = issue.parent?.key;
      if (parentKey && storyByKey.has(parentKey)) {
        const list = tasksByStoryKey.get(parentKey)!;
        list.push(issue);
      }
    }
  }

  const stories: EpicDeepStoryBundle[] = Array.from(storyByKey.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([storyKey, story]) => ({
      story,
      tasks: tasksByStoryKey.get(storyKey) ?? [],
    }));

  return { epic, stories };
}
