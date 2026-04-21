/**
 * Tracker API: пользователи организации (только сервер).
 */

import type { AxiosInstance } from 'axios';

import { TRACKER_V3_BASE } from './constants';

export interface TrackerUserItem {
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  /** uid Трекера — строка для совместимости с trackerId в приложении */
  trackerId: string;
}

interface TrackerUserRaw {
  dismissed?: boolean;
  display?: string;
  email?: string | null;
  firstName?: string;
  hasLicense?: boolean;
  lastName?: string;
  login?: string;
  trackerUid?: number;
  uid?: number;
}

function mapRawUser(raw: unknown): TrackerUserItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as TrackerUserRaw;
  const uid = o.trackerUid ?? o.uid;
  if (!uid) return null;
  if (o.dismissed) return null;

  const displayName =
    o.display?.trim() ||
    [o.firstName, o.lastName].filter(Boolean).join(' ') ||
    o.login ||
    String(uid);

  return {
    avatarUrl: null,
    displayName,
    email: o.email ?? null,
    trackerId: String(uid),
  };
}

/**
 * Загрузить всех пользователей организации из Яндекс Трекера (постранично).
 * Лимит Tracker API — 10 000 пользователей.
 */
export async function fetchTrackerUsersPaginate(
  api: AxiosInstance,
  maxPages = 20
): Promise<TrackerUserItem[]> {
  const result: TrackerUserItem[] = [];
  const perPage = 100;

  for (let page = 1; page <= maxPages; page++) {
    const res = await api.get<unknown[]>(`${TRACKER_V3_BASE}/users`, {
      params: { perPage, page },
    });
    const items = Array.isArray(res.data) ? res.data : [];
    for (const raw of items) {
      const mapped = mapRawUser(raw);
      if (mapped) result.push(mapped);
    }
    if (items.length < perPage) break;
  }

  return result;
}

/**
 * Поиск пользователей по строке запроса (фильтрация на сервере).
 */
export function filterTrackerUsers(
  users: TrackerUserItem[],
  query: string
): TrackerUserItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
  );
}
