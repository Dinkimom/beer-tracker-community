/**
 * Метаданные трекера для админки (поля, статусы) — сервер, org-токен.
 */

import type { AxiosInstance } from 'axios';

import { TRACKER_V3_BASE } from '@/lib/trackerApi/constants';

export interface TrackerMetadataFieldDto {
  category?: string;
  display?: string;
  id: string;
  key?: string;
  name?: string;
  options?: string[];
  readonly?: boolean;
  schemaType?: string;
}

export interface TrackerMetadataStatusDto {
  description?: string;
  display: string;
  id: string;
  key: string;
  statusType?: { display?: string; id?: string; key?: string };
}

function normalizeEntityId(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return '';
}

function mapField(raw: unknown): TrackerMetadataFieldDto | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = normalizeEntityId(o.id);
  if (!id) {
    return null;
  }
  const schema =
    o.schema && typeof o.schema === 'object' && !Array.isArray(o.schema)
      ? (o.schema as Record<string, unknown>)
      : null;
  const optionsProvider =
    o.optionsProvider && typeof o.optionsProvider === 'object' && !Array.isArray(o.optionsProvider)
      ? (o.optionsProvider as Record<string, unknown>)
      : null;
  const rawOptions = optionsProvider?.values;
  const options = Array.isArray(rawOptions)
    ? rawOptions
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  return {
    category: typeof o.category === 'string' ? o.category : undefined,
    display: typeof o.display === 'string' ? o.display : undefined,
    id,
    key: typeof o.key === 'string' ? o.key : undefined,
    name: typeof o.name === 'string' ? o.name : undefined,
    options,
    readonly: typeof o.readonly === 'boolean' ? o.readonly : undefined,
    schemaType: typeof schema?.type === 'string' ? schema.type : undefined,
  };
}

function mapStatus(raw: unknown): TrackerMetadataStatusDto | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === 'string' ? o.key.trim() : '';
  const id = normalizeEntityId(o.id) || key;
  if (!key || !id) {
    return null;
  }
  const display = typeof o.display === 'string' ? o.display : key;
  let statusType: TrackerMetadataStatusDto['statusType'];
  const st = o.statusType ?? o.type;
  if (st && typeof st === 'object') {
    const t = st as Record<string, unknown>;
    statusType = {
      display: typeof t.display === 'string' ? t.display : undefined,
      id: typeof t.id === 'string' ? t.id : undefined,
      key: typeof t.key === 'string' ? t.key : undefined,
    };
  }
  return {
    description: typeof o.description === 'string' ? o.description : undefined,
    display,
    id,
    key,
    statusType,
  };
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>).values;
    if (Array.isArray(v)) {
      return v;
    }
  }
  return [];
}

/**
 * GET /v3/fields — глобальные поля организации.
 */
export async function fetchTrackerOrganizationFields(
  api: AxiosInstance
): Promise<TrackerMetadataFieldDto[]> {
  const { data } = await api.get<unknown>(`${TRACKER_V3_BASE}/fields`);
  const rows = extractArray(data);
  const out: TrackerMetadataFieldDto[] = [];
  for (const row of rows) {
    const f = mapField(row);
    if (f) {
      out.push(f);
    }
  }
  return out;
}

/**
 * GET /v3/statuses — список статусов (если метод доступен для организации).
 */
export async function fetchTrackerOrganizationStatuses(
  api: AxiosInstance
): Promise<TrackerMetadataStatusDto[]> {
  try {
    const { data } = await api.get<unknown>(`${TRACKER_V3_BASE}/statuses`);
    const rows = extractArray(data);
    const out: TrackerMetadataStatusDto[] = [];
    for (const row of rows) {
      const s = mapStatus(row);
      if (s) {
        out.push(s);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchTrackerFieldEnumValues(
  api: AxiosInstance,
  fieldId: string
): Promise<string[]> {
  const id = fieldId.trim();
  if (!id) {
    return [];
  }
  try {
    const { data } = await api.get<unknown>(`${TRACKER_V3_BASE}/fields/${encodeURIComponent(id)}`);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return [];
    }
    const o = data as Record<string, unknown>;
    const op =
      o.optionsProvider && typeof o.optionsProvider === 'object' && !Array.isArray(o.optionsProvider)
        ? (o.optionsProvider as Record<string, unknown>)
        : null;
    const values = op?.values;
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
