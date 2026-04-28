/**
 * Чтение issue_snapshots: одна задача и выборка бэклога (контракт как у бывшего CH-бэклога).
 */

import type {
  IssueSnapshotRow,
  QueryBacklogSnapshotsParams,
  QueryBacklogSnapshotsResult,
} from './types';
import type { QueryParams } from '@/types';

import { query } from '@/lib/db';
import { isDbCompatibilityMode } from '@/lib/env';
import { issuePayloadMatchesBacklogFilters } from '@/lib/snapshots/backlogPayload';

import {
  findOverseerIssueByKey,
  findOverseerIssuesByKeys,
  queryOverseerIssuesByQueue,
} from './overseerRawIssuesRead';
import { statusKeyTypeKeySummaryFromPayload } from './snapshotPayloadSummary';

const DEFAULT_ISSUE_TYPES = ['task', 'bug'];
const DEFAULT_EXCLUDE_STATUS = ['closed'];

interface SnapshotDbRow {
  issue_key: string;
  organization_id: string;
  payload: IssueSnapshotRow['payload'];
  synced_at: Date | string;
  tracker_updated_at: Date | string | null;
}

function isoFromPgOptional(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function isoFromPg(value: Date | string): string {
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function mapSnapshotRow(r: SnapshotDbRow): IssueSnapshotRow {
  return {
    organization_id: r.organization_id,
    issue_key: r.issue_key,
    payload: r.payload,
    tracker_updated_at: isoFromPgOptional(r.tracker_updated_at),
    synced_at: isoFromPg(r.synced_at),
  };
}

export async function findIssueSnapshot(
  organizationId: string,
  issueKey: string
): Promise<IssueSnapshotRow | null> {
  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots
     WHERE organization_id = $1 AND issue_key = $2`,
    [organizationId, issueKey]
  );
  const row = res.rows[0];
  if (row) {
    return mapSnapshotRow(row);
  }
  if (!isDbCompatibilityMode()) {
    return null;
  }
  const payload = await findOverseerIssueByKey(issueKey);
  if (!payload) {
    return null;
  }
  return {
    organization_id: organizationId,
    issue_key: payload.key,
    payload,
    synced_at: new Date().toISOString(),
    tracker_updated_at: payload.updatedAt ?? null,
  };
}

export async function findIssueSnapshotsByKeys(
  organizationId: string,
  issueKeys: string[]
): Promise<IssueSnapshotRow[]> {
  const unique = [...new Set(issueKeys.map((k) => k.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots
     WHERE organization_id = $1 AND issue_key = ANY($2::text[])`,
    [organizationId, unique]
  );
  const rows = res.rows.map(mapSnapshotRow);
  if (rows.length > 0 || !isDbCompatibilityMode()) {
    return rows;
  }
  const payloads = await findOverseerIssuesByKeys(unique);
  return payloads.map((payload) => ({
    organization_id: organizationId,
    issue_key: payload.key,
    payload,
    synced_at: new Date().toISOString(),
    tracker_updated_at: payload.updatedAt ?? null,
  }));
}

/** Получение статусов, типов и сводки задач из снимков PostgreSQL. */
export async function fetchIssueStatusesTypesAndSummariesFromSnapshots(
  organizationId: string,
  issueKeys: string[]
): Promise<{
  statuses: Map<string, string>;
  summaries: Map<string, string>;
  types: Map<string, string>;
}> {
  const rows = await findIssueSnapshotsByKeys(organizationId, issueKeys);
  const statuses = new Map<string, string>();
  const types = new Map<string, string>();
  const summaries = new Map<string, string>();
  for (const row of rows) {
    const { status, type, summary } = statusKeyTypeKeySummaryFromPayload(
      row.payload
    );
    statuses.set(row.issue_key, status);
    types.set(row.issue_key, type);
    summaries.set(row.issue_key, summary);
  }
  return { statuses, summaries, types };
}

const BACKLOG_SPRINT_FILTER_SQL = `
  AND (
    NOT ($4::boolean)
    OR NOT (payload ? 'sprint')
    OR jsonb_typeof(payload->'sprint') = 'null'
    OR (jsonb_typeof(payload->'sprint') = 'array' AND jsonb_array_length(payload->'sprint') = 0)
    OR (
      jsonb_typeof(payload->'sprint') = 'string'
      AND length(trim(coalesce(payload#>>'{sprint}', ''))) = 0
    )
    OR (
      jsonb_typeof(payload->'sprint') = 'object'
      AND (
        payload->'sprint' = '{}'::jsonb
        OR NOT (payload->'sprint' ? 'id' OR payload->'sprint' ? 'display')
      )
    )
  )
`;

/**
 * Бэклог: пустой/отсутствующий sprint в JSONB, тип task|bug, статус не в exclude, опционально queue.
 * Сортировка: `createdAt` из payload (ISO-8601), затем synced_at — паритет с ORDER BY created_at DESC в CH.
 */
export async function queryBacklogIssueSnapshots(
  organizationId: string,
  params: QueryBacklogSnapshotsParams = {}
): Promise<QueryBacklogSnapshotsResult> {
  const issueTypeKeys = params.issueTypeKeys?.length
    ? params.issueTypeKeys
    : DEFAULT_ISSUE_TYPES;
  const excludeStatusKeys = params.excludeStatusKeys?.length
    ? params.excludeStatusKeys
    : DEFAULT_EXCLUDE_STATUS;
  const onlyWithoutSprint = params.onlyWithoutSprint !== false;
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(200, Math.max(1, params.perPage ?? 50));
  const offset = (page - 1) * perPage;

  const queueKey = params.trackerQueueKey?.trim() || null;

  const baseArgs: QueryParams = [
    organizationId,
    issueTypeKeys,
    excludeStatusKeys,
    onlyWithoutSprint,
  ];

  let queueSql = '';
  if (queueKey) {
    queueSql = `AND (
      (payload->'queue'->>'key') = $5
      OR (payload->'queue'->>'id') = $5
      OR (payload->>'queue') = $5
    )`;
    baseArgs.push(queueKey);
  }

  /** $4 = onlyWithoutSprint; при false условие по спринту отключается (NOT false OR …). */
  const whereCommon = `
    WHERE organization_id = $1
      AND (payload->'type'->>'key') = ANY($2::text[])
      AND (
        NOT (payload ? 'status')
        OR NOT ((payload->'status'->>'key') = ANY($3::text[]))
      )
      ${BACKLOG_SPRINT_FILTER_SQL}
      ${queueSql}
  `;

  const countArgs = [...baseArgs];
  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM issue_snapshots ${whereCommon}`,
    countArgs
  );
  const totalCount = parseInt(countRes.rows[0]?.count ?? '0', 10);
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / perPage);

  const listArgs = [...baseArgs, perPage, offset];
  const limitParam = baseArgs.length + 1;
  const offsetParam = baseArgs.length + 2;

  const res = await query<SnapshotDbRow>(
    `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
     FROM issue_snapshots
     ${whereCommon}
     ORDER BY (payload->>'createdAt') DESC NULLS LAST, synced_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    listArgs
  );
  const mapped = res.rows.map(mapSnapshotRow);
  if (mapped.length > 0 || !isDbCompatibilityMode()) {
    return {
      rows: mapped,
      totalCount,
      totalPages,
    };
  }
  const fallbackIssues = await queryOverseerIssuesByQueue(queueKey ?? '');
  const filtered = fallbackIssues.filter((issue) =>
    issuePayloadMatchesBacklogFilters(issue, {
      excludeStatusKeys,
      issueTypeKeys,
      onlyWithoutSprint,
      trackerQueueKey: queueKey,
    })
  );
  const paged = filtered.slice(offset, offset + perPage);
  const fallbackTotal = filtered.length;
  const fallbackPages = fallbackTotal === 0 ? 0 : Math.ceil(fallbackTotal / perPage);

  return {
    rows: paged.map((payload) => ({
      organization_id: organizationId,
      issue_key: payload.key,
      payload,
      synced_at: new Date().toISOString(),
      tracker_updated_at: payload.updatedAt ?? null,
    })),
    totalCount: fallbackTotal,
    totalPages: fallbackPages,
  };
}
