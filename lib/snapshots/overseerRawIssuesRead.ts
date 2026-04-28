import type { TrackerIssue } from '@/types/tracker';

import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { changelogEntriesFromRawIssueLogs } from '@/lib/ytrackerRawIssues';

interface OverseerRawIssueRow {
  issue_comments: unknown;
  issue_data: unknown;
  issue_id: string;
  issue_logs: unknown;
  updated_at: Date | string | null;
}

function resolveIssueKey(rowIssueId: string, issueData: unknown): string {
  if (issueData && typeof issueData === 'object' && !Array.isArray(issueData)) {
    const key = (issueData as Record<string, unknown>).key;
    if (typeof key === 'string' && key.trim()) {
      return key.trim();
    }
  }
  return rowIssueId;
}

function toTrackerIssue(rowIssueId: string, issueData: unknown): TrackerIssue {
  const issueKey = resolveIssueKey(rowIssueId, issueData);
  const payload =
    issueData && typeof issueData === 'object' && !Array.isArray(issueData)
      ? { ...(issueData as Record<string, unknown>) }
      : {};
  if (typeof payload.key !== 'string' || payload.key.trim() === '') {
    payload.key = issueKey;
  }
  if (typeof payload.id !== 'string' || payload.id.trim() === '') {
    payload.id = issueKey;
  }
  if (typeof payload.summary !== 'string') {
    payload.summary = issueKey;
  }
  if (typeof payload.self !== 'string') {
    payload.self = '';
  }
  return payload as unknown as TrackerIssue;
}

function normalizeOverseerRows(rows: OverseerRawIssueRow[]): TrackerIssue[] {
  return rows.map((r) => {
    const issue = toTrackerIssue(r.issue_id, r.issue_data) as unknown as Record<string, unknown>;
    if (!('issue_logs' in issue)) {
      issue.issue_logs = r.issue_logs;
    }
    if (!('issue_comments' in issue)) {
      issue.issue_comments = r.issue_comments;
    }
    return issue as unknown as TrackerIssue;
  });
}

export async function findOverseerIssueByKey(issueKey: string): Promise<TrackerIssue | null> {
  const res = await query<OverseerRawIssueRow>(
    `SELECT issue_id, issue_data, issue_logs, issue_comments, updated_at
     FROM overseer.ytracker_raw_issues
     WHERE issue_data->>'key' = $1
     LIMIT 1`,
    [issueKey]
  );
  const row = res.rows[0];
  return row ? normalizeOverseerRows([row])[0] ?? null : null;
}

export async function findOverseerIssuesByKeys(
  issueKeys: string[],
  organizationId?: string
): Promise<TrackerIssue[]> {
  const unique = [...new Set(issueKeys.map((k) => k.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  const onPrem = isOnPremMode();
  const res = await query<OverseerRawIssueRow>(
    onPrem
      ? `SELECT issue_id, issue_data, issue_logs, issue_comments, updated_at
         FROM overseer.ytracker_raw_issues
         WHERE issue_data->>'key' = ANY($1::text[])`
      : `SELECT issue_id, issue_data, issue_logs, issue_comments, updated_at
         FROM overseer.ytracker_raw_issues
         WHERE organization_id = $1::uuid
           AND issue_data->>'key' = ANY($2::text[])`,
    onPrem ? [unique] : [organizationId ?? null, unique]
  );
  return normalizeOverseerRows(res.rows);
}

export async function queryOverseerIssuesByQueue(queueKey: string): Promise<TrackerIssue[]> {
  const queue = queueKey.trim();
  if (!queue) {
    return [];
  }
  const res = await query<OverseerRawIssueRow>(
    `SELECT r.issue_id, r.issue_data, r.issue_logs, r.issue_comments, r.updated_at, r.team_uid
     FROM overseer.ytracker_raw_issues r
     INNER JOIN overseer.teams t ON t.uid = r.team_uid
     WHERE t.queue = $1`,
    [queue]
  );
  return normalizeOverseerRows(res.rows);
}

export async function queryOverseerIssuesByBoard(boardId: number): Promise<TrackerIssue[]> {
  const res = await query<OverseerRawIssueRow>(
    `SELECT r.issue_id, r.issue_data, r.issue_logs, r.issue_comments, r.updated_at, r.team_uid
     FROM overseer.ytracker_raw_issues r
     INNER JOIN overseer.teams t ON t.uid = r.team_uid
     WHERE t.board = $1::bigint`,
    [boardId]
  );
  return normalizeOverseerRows(res.rows);
}

export async function queryAllOverseerIssues(): Promise<TrackerIssue[]> {
  const res = await query<OverseerRawIssueRow>(
    `SELECT issue_id, issue_data, issue_logs, issue_comments, updated_at
     FROM overseer.ytracker_raw_issues`
  );
  return normalizeOverseerRows(res.rows);
}

export async function fetchIssueChangelogMapFromOverseer(
  organizationId: string,
  issueKeys: string[]
): Promise<Map<string, { changelog: unknown[]; comments: unknown[] }>> {
  const map = new Map<string, { changelog: unknown[]; comments: unknown[] }>();
  const issues = await findOverseerIssuesByKeys(issueKeys, organizationId);
  for (const issue of issues) {
    const payload = issue as unknown as Record<string, unknown>;
    const rawLogs = payload.issue_logs ?? payload.changelog ?? [];
    const rawComments = payload.issue_comments ?? payload.comments ?? [];
    const changelog = changelogEntriesFromRawIssueLogs(rawLogs);
    map.set(issue.key, {
      changelog,
      comments: Array.isArray(rawComments) ? rawComments : [],
    });
  }
  return map;
}
