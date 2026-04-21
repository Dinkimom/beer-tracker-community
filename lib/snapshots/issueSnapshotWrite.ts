/**
 * Запись снимков задач в issue_snapshots (tenant-scoped).
 */

import type { TrackerIssue } from '@/types/tracker';

import { query } from '@/lib/db';

import { stringifyForPostgresJsonb } from './sanitizePayloadForPostgresJsonb';

export async function upsertIssueSnapshotsForOrg(
  organizationId: string,
  issues: TrackerIssue[]
): Promise<number> {
  let n = 0;
  for (const issue of issues) {
    const updatedAt = issue.updatedAt ?? null;
    await query(
      `INSERT INTO issue_snapshots (organization_id, issue_key, payload, tracker_updated_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (organization_id, issue_key) DO UPDATE
       SET payload = EXCLUDED.payload,
           tracker_updated_at = EXCLUDED.tracker_updated_at,
           synced_at = CURRENT_TIMESTAMP`,
      [organizationId, issue.key, stringifyForPostgresJsonb(issue), updatedAt]
    );
    n += 1;
  }
  return n;
}
