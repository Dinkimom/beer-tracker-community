/**
 * Changelog и комментарии задачи через Yandex Tracker API.
 */

import type { IssueChangelogWithComments, IssueComment } from '@/types/tracker';

import axios, { type AxiosInstance } from 'axios';

import { changelogEntriesFromRawIssueLogs } from '@/lib/ytrackerRawIssues';

import { requireTrackerAxiosForApiRoute } from '../trackerAxiosFactory';

const CHANGELOG_PAGE = 100;
const COMMENTS_PAGE = 100;
const BATCH_CONCURRENCY = 8;

function decodeCommentText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

interface TrackerCommentRow {
  createdAt: string;
  createdBy?: {
    cloudUid?: string;
    display?: string;
    id?: string;
    passportUid?: number;
  };
  id: number;
  text: string;
  textHtml?: string;
  updatedAt: string;
  updatedBy?: {
    display: string;
    id: string;
  };
}

function issueCommentsFromTrackerApiResponse(raw: unknown): IssueComment[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .filter((c): c is TrackerCommentRow => {
      if (!c || typeof c !== 'object') {
        return false;
      }
      const o = c as Record<string, unknown>;
      return typeof o.id === 'number' && typeof o.text === 'string' && typeof o.createdAt === 'string';
    })
    .map((c) => ({
      createdAt: c.createdAt,
      createdBy: {
        cloudUid: c.createdBy?.cloudUid,
        display: c.createdBy?.display || 'Unknown',
        id: c.createdBy?.id || '',
        passportUid: c.createdBy?.passportUid,
      },
      id: c.id,
      text: decodeCommentText(c.text),
      textHtml: c.textHtml,
      updatedAt: c.updatedAt,
      updatedBy: c.updatedBy
        ? {
            display: c.updatedBy.display,
            id: c.updatedBy.id,
          }
        : undefined,
    }))
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

/** Все записи changelog задачи (пагинация Tracker API). */
export async function fetchTrackerIssueChangelogRawPages(
  api: AxiosInstance,
  issueKey: string
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined;
  for (;;) {
    const path = cursor
      ? `/issues/${encodeURIComponent(issueKey)}/changelog?perPage=${CHANGELOG_PAGE}&id=${encodeURIComponent(cursor)}`
      : `/issues/${encodeURIComponent(issueKey)}/changelog?perPage=${CHANGELOG_PAGE}`;
    const { data } = await api.get<unknown>(path);
    const page = Array.isArray(data) ? data : [];
    if (page.length === 0) {
      break;
    }
    all.push(...page);
    if (page.length < CHANGELOG_PAGE) {
      break;
    }
    const last = page[page.length - 1] as { id?: string };
    if (!last?.id) {
      break;
    }
    cursor = String(last.id);
  }
  return all;
}

async function fetchAllCommentsPages(
  api: AxiosInstance,
  issueKey: string
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined;
  for (;;) {
    const expand = 'expand=all';
    const path = cursor
      ? `/issues/${encodeURIComponent(issueKey)}/comments?${expand}&perPage=${COMMENTS_PAGE}&id=${encodeURIComponent(cursor)}`
      : `/issues/${encodeURIComponent(issueKey)}/comments?${expand}&perPage=${COMMENTS_PAGE}`;
    const { data } = await api.get<unknown>(path);
    const page = Array.isArray(data) ? data : [];
    if (page.length === 0) {
      break;
    }
    all.push(...page);
    if (page.length < COMMENTS_PAGE) {
      break;
    }
    const last = page[page.length - 1] as { id?: number };
    if (last?.id == null) {
      break;
    }
    cursor = String(last.id);
  }
  return all;
}

export async function fetchIssueChangelogWithCommentsFromTracker(
  issueKey: string,
  axiosInstance?: AxiosInstance
): Promise<IssueChangelogWithComments> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  try {
    const [rawLogs, rawComments] = await Promise.all([
      fetchTrackerIssueChangelogRawPages(api, issueKey),
      fetchAllCommentsPages(api, issueKey),
    ]);
    return {
      changelog: changelogEntriesFromRawIssueLogs(rawLogs),
      comments: issueCommentsFromTrackerApiResponse(rawComments),
    };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      return { changelog: [], comments: [] };
    }
    throw e;
  }
}

async function mapInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const part = await Promise.all(chunk.map(fn));
    out.push(...part);
  }
  return out;
}

export async function fetchIssuesChangelogBatchFromTracker(
  issueKeys: string[],
  axiosInstance?: AxiosInstance
): Promise<Map<string, IssueChangelogWithComments>> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const uniqueKeys = [...new Set(issueKeys)];
  const results = await mapInChunks(uniqueKeys, BATCH_CONCURRENCY, async (key) => {
    const data = await fetchIssueChangelogWithCommentsFromTracker(key, api);
    return { key, data };
  });
  const map = new Map<string, IssueChangelogWithComments>();
  for (const { key, data } of results) {
    map.set(key, data);
  }
  for (const key of issueKeys) {
    if (!map.has(key)) {
      map.set(key, { changelog: [], comments: [] });
    }
  }
  return map;
}
