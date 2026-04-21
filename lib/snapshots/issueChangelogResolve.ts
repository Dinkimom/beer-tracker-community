/**
 * Сборка ответа batch changelog: кеш PostgreSQL + при необходимости Tracker.
 */

import type { IssueChangelogWithComments } from '@/types/tracker';
import type { AxiosInstance } from 'axios';

import { fetchIssuesChangelogBatchFromTracker } from '@/lib/trackerApi';

import { fetchIssueChangelogCacheMap } from './issueChangelogRead';
import { upsertIssueChangelogCacheBatchForOrg } from './issueChangelogWrite';

const empty: IssueChangelogWithComments = { changelog: [], comments: [] };

/** Ответ batch по списку ключей из уже загруженного кеша (без запросов к Tracker). */
export function issueChangelogBatchRecordFromCacheMap(
  issueKeys: string[],
  cache: Map<string, IssueChangelogWithComments>
): Record<string, IssueChangelogWithComments> {
  const out: Record<string, IssueChangelogWithComments> = {};
  for (const k of issueKeys) {
    out[k] = cache.get(k) ?? empty;
  }
  return out;
}

/**
 * Порядок ключей в `issueKeys` сохраняется в объекте ответа.
 *
 * `existingCache` — если уже загружен (например в route для cache-only short-circuit), не дублировать SELECT.
 */
export async function resolveIssueChangelogBatchForOrganization(input: {
  axiosInstance: AxiosInstance;
  existingCache?: Map<string, IssueChangelogWithComments>;
  issueKeys: string[];
  organizationId: string;
  refresh?: boolean;
}): Promise<Record<string, IssueChangelogWithComments>> {
  const { axiosInstance, existingCache, issueKeys, organizationId, refresh } =
    input;
  const result: Record<string, IssueChangelogWithComments> = {};

  if (issueKeys.length === 0) {
    return result;
  }

  if (refresh) {
    const uniqueKeys = [...new Set(issueKeys)];
    const dataMap = await fetchIssuesChangelogBatchFromTracker(
      uniqueKeys,
      axiosInstance
    );
    const rows = uniqueKeys.map((issueKey) => ({
      issueKey,
      data: dataMap.get(issueKey) ?? empty,
    }));
    await upsertIssueChangelogCacheBatchForOrg(organizationId, rows);
    for (const key of issueKeys) {
      result[key] = dataMap.get(key) ?? empty;
    }
    return result;
  }

  const cached =
    existingCache ??
    (await fetchIssueChangelogCacheMap(organizationId, issueKeys));
  const toFetch = [...new Set(issueKeys.filter((k) => !cached.has(k)))];

  let fetched = new Map<string, IssueChangelogWithComments>();
  if (toFetch.length > 0) {
    fetched = await fetchIssuesChangelogBatchFromTracker(
      toFetch,
      axiosInstance
    );
    const rows = toFetch.map((issueKey) => ({
      issueKey,
      data: fetched.get(issueKey) ?? empty,
    }));
    await upsertIssueChangelogCacheBatchForOrg(organizationId, rows);
  }

  for (const key of issueKeys) {
    const fromTracker = fetched.get(key);
    if (fromTracker) {
      result[key] = fromTracker;
    } else {
      const fromDb = cached.get(key);
      result[key] = fromDb ?? empty;
    }
  }

  return result;
}
