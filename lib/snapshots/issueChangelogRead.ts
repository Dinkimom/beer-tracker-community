/**
 * Чтение кеша changelog + comments из issue_changelog_events.
 */

import type { IssueChangelogWithComments } from '@/types/tracker';

import { fetchIssueChangelogMapFromOverseer } from '@/lib/snapshots/overseerRawIssuesRead';

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
  const overseer = await fetchIssueChangelogMapFromOverseer(organizationId, unique);
  for (const [key, value] of overseer.entries()) {
    map.set(key, {
      changelog: value.changelog as IssueChangelogWithComments['changelog'],
      comments: value.comments as IssueChangelogWithComments['comments'],
    });
  }
  return map;
}
