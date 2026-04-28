/**
 * Чтение кеша changelog + comments из issue_changelog_events.
 */

import type { IssueChangelogWithComments } from '@/types/tracker';

import { query } from '@/lib/db';
import { isDbCompatibilityMode } from '@/lib/env';
import { fetchIssueChangelogMapFromOverseer } from '@/lib/snapshots/overseerRawIssuesRead';

interface ChangelogSelectRow {
  changelog: unknown;
  comments: unknown;
  issue_key: string;
}

/**
 * Возвращает только ключи, для которых в БД есть строка (в т.ч. пустые массивы).
 */
export async function fetchIssueChangelogCacheMap(
  organizationId: string,
  issueKeys: string[]
): Promise<Map<string, IssueChangelogWithComments>> {
  const map = new Map<string, IssueChangelogWithComments>();
  if (issueKeys.length === 0) {
    return map;
  }
  const unique = [...new Set(issueKeys)];
  const res = await query<ChangelogSelectRow>(
    `SELECT issue_key, changelog, comments
     FROM issue_changelog_events
     WHERE organization_id = $1 AND issue_key = ANY($2::text[])`,
    [organizationId, unique]
  );
  for (const row of res.rows) {
    map.set(row.issue_key, {
      changelog: Array.isArray(row.changelog) ? row.changelog : [],
      comments: Array.isArray(row.comments) ? row.comments : [],
    });
  }
  if (!isDbCompatibilityMode()) {
    return map;
  }
  const missing = unique.filter((key) => !map.has(key));
  if (missing.length === 0) {
    return map;
  }
  const fallback = await fetchIssueChangelogMapFromOverseer(missing);
  for (const [key, value] of fallback.entries()) {
    map.set(key, {
      changelog: value.changelog as IssueChangelogWithComments['changelog'],
      comments: value.comments as IssueChangelogWithComments['comments'],
    });
  }
  return map;
}
