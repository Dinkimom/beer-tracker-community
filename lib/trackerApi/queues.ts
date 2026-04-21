/**
 * Tracker API: очереди (только сервер).
 */

import type { AxiosInstance } from 'axios';

import { requireTrackerAxiosForApiRoute } from '../trackerAxiosFactory';

import { TRACKER_V3_BASE } from './constants';

export interface TrackerQueueListItem {
  id?: number;
  key: string;
  name: string;
}

function mapRawQueue(raw: unknown): TrackerQueueListItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === 'string' ? o.key.trim() : '';
  if (!key) {
    return null;
  }
  let name = key;
  if (typeof o.name === 'string' && o.name.trim()) {
    name = o.name.trim();
  } else if (typeof o.summary === 'string' && o.summary.trim()) {
    name = o.summary.trim();
  }
  let id: number | undefined;
  if (typeof o.id === 'number' && Number.isFinite(o.id)) {
    id = o.id;
  } else if (typeof o.id === 'string' && /^\d+$/.test(o.id)) {
    const n = Number.parseInt(o.id, 10);
    if (Number.isFinite(n)) {
      id = n;
    }
  }
  return { id, key, name };
}

/** Ответ списка очередей: массив или обёртка (на случай смены формата API). */
function extractQueueRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.values)) {
      return o.values;
    }
  }
  return [];
}

/**
 * Список очередей: официальный `GET /v3/queues/?perPage=…` (массив в теле).
 * Эндпоинт `queues/_paginate` в облачном Tracker отдаёт 404 — используется для досок, не для очередей.
 */
export async function fetchTrackerQueuesPaginate(
  axiosInstance?: AxiosInstance
): Promise<TrackerQueueListItem[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const perPage = 500;
  const { data } = await api.get<unknown>(`${TRACKER_V3_BASE}/queues/`, {
    params: { perPage },
  });
  const rows = extractQueueRows(data);
  const out: TrackerQueueListItem[] = [];
  for (const row of rows) {
    const item = mapRawQueue(row);
    if (item) {
      out.push(item);
    }
  }
  return out;
}
