/**
 * Снимки задач, попадающие в спринт по полю sprint в payload (замена CH has(sprints, name)).
 */

import type { QueryParams } from '@/types';
import type { TrackerIssue } from '@/types/tracker';

import { DatabaseError } from 'pg';

import { issueDataSprintContains } from '@/lib/burndown/sprintMembership';
import { query } from '@/lib/db';
import { isDbCompatibilityMode } from '@/lib/env';
import { queryAllOverseerIssues } from '@/lib/snapshots/overseerRawIssuesRead';

export interface SprintSnapshotQueryParams {
  /** Точное совпадение `payload.functionalTeam` (как колонка team в CH при фильтре по доске). */
  functionalTeamExact?: string | null;
  sprintId?: string | null;
  sprintName: string;
}

interface SnapshotDbRow {
  issue_key: string;
  organization_id: string;
  payload: TrackerIssue;
  synced_at: Date | string;
  tracker_updated_at: Date | string | null;
}

const SPRINT_MATCH_SQL = `
  AND (
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(payload->'sprint') = 'array' THEN payload->'sprint'
          ELSE '[]'::jsonb
        END
      ) elem
      WHERE elem->>'display' = $2
         OR elem->>'id' = $2
         OR (
           $3::text IS NOT NULL AND trim($3) <> ''
           AND (elem->>'id' = $3 OR elem->>'display' = $3)
         )
    )
    OR (
      jsonb_typeof(payload->'sprint') = 'object'
      AND (
        (payload->'sprint'->>'display') = $2
        OR (payload->'sprint'->>'id') = $2
        OR (
          $3::text IS NOT NULL AND trim($3) <> ''
          AND (
            (payload->'sprint'->>'display') = $3
            OR (payload->'sprint'->>'id') = $3
          )
        )
      )
    )
    OR (
      jsonb_typeof(payload->'sprint') = 'string'
      AND (
        trim(payload#>>'{sprint}') = $2
        OR (
          $3::text IS NOT NULL AND trim($3) <> ''
          AND trim(payload#>>'{sprint}') = $3
        )
      )
    )
  )
`;

function isPostgresUndefinedTable(err: unknown): boolean {
  return err instanceof DatabaseError && err.code === '42P01';
}

function isPostgresQueryCanceled(err: unknown): boolean {
  return err instanceof DatabaseError && err.code === '57014';
}

function isSafeSnapshotFallbackError(err: unknown): boolean {
  return isPostgresUndefinedTable(err) || isPostgresQueryCanceled(err);
}

/**
 * Задачи, у которых в снимке спринт совпадает с именем/id (текущее состояние экспорта).
 */
export async function queryIssueSnapshotsMatchingSprint(
  organizationId: string,
  params: SprintSnapshotQueryParams
): Promise<TrackerIssue[]> {
  const name = params.sprintName.trim();
  const sid =
    params.sprintId != null && String(params.sprintId).trim() !== ''
      ? String(params.sprintId).trim()
      : null;
  const team = params.functionalTeamExact?.trim() || null;

  const args: QueryParams = [organizationId, name, sid, team];
  const teamSql = `
    AND (
      $4::text IS NULL OR trim($4) = ''
      OR payload->>'functionalTeam' = $4
    )
  `;

  try {
    const res = await query<SnapshotDbRow>(
      `SELECT organization_id, issue_key, payload, tracker_updated_at, synced_at
       FROM issue_snapshots
       WHERE organization_id = $1
       ${teamSql}
       ${SPRINT_MATCH_SQL}`,
      args
    );

    const rows = res.rows.map((r) => r.payload);
    if (rows.length > 0 || !isDbCompatibilityMode()) {
      return rows;
    }
  } catch (error) {
    if (!isSafeSnapshotFallbackError(error)) {
      throw error;
    }
  }

  let fallback: TrackerIssue[];
  try {
    fallback = await queryAllOverseerIssues();
  } catch (error) {
    if (!isSafeSnapshotFallbackError(error)) {
      throw error;
    }
    return [];
  }

  return fallback.filter((issue) => {
    if (!issueDataSprintContains(issue, name, sid ?? undefined)) {
      return false;
    }
    if (!team) {
      return true;
    }
    return (issue.functionalTeam ?? '').trim() === team;
  });
}
