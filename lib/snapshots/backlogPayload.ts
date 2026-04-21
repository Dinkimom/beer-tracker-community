/**
 * Чистая логика «бэклог по спринту» в payload (паритет с пустым массивом sprints в CH).
 * SQL в `issueSnapshotRead` дублирует эти правила — при изменении синхронизировать оба места.
 */

const DEFAULT_ISSUE_TYPE_KEYS = ['task', 'bug'] as const;
const DEFAULT_EXCLUDE_STATUS_KEYS = ['closed'] as const;

/** true, если в payload есть «живой» спринт (не пустой массив / не пустая строка / объект с id или display). */
export function issuePayloadHasActiveSprintField(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (!('sprint' in p)) return false;
  const s = p['sprint'];
  if (s == null) return false;
  if (Array.isArray(s)) return s.length > 0;
  if (typeof s === 'string') return s.trim().length > 0;
  if (typeof s === 'object' && !Array.isArray(s)) {
    const o = s as Record<string, unknown>;
    if (Object.keys(o).length === 0) return false;
    return 'id' in o || 'display' in o;
  }
  return false;
}

export function issuePayloadIsBacklogBySprint(payload: unknown): boolean {
  return !issuePayloadHasActiveSprintField(payload);
}

export function issuePayloadMatchesQueueFilter(
  payload: unknown,
  trackerQueueKey: string | null | undefined
): boolean {
  if (trackerQueueKey == null || trackerQueueKey === '') return true;
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const q = p['queue'];
  if (typeof q === 'string') return q === trackerQueueKey;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    const o = q as Record<string, unknown>;
    const key = o['key'];
    const id = o['id'];
    if (typeof key === 'string' && key === trackerQueueKey) return true;
    if (typeof id === 'string' && id === trackerQueueKey) return true;
  }
  return false;
}

export function issuePayloadMatchesTypeKeys(
  payload: unknown,
  issueTypeKeys: readonly string[] = DEFAULT_ISSUE_TYPE_KEYS
): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const t = p['type'];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
  const key = (t as Record<string, unknown>)['key'];
  if (typeof key !== 'string') return false;
  return issueTypeKeys.includes(key);
}

export function issuePayloadMatchesStatusExclusion(
  payload: unknown,
  excludeStatusKeys: readonly string[] = DEFAULT_EXCLUDE_STATUS_KEYS
): boolean {
  if (!payload || typeof payload !== 'object') return true;
  const p = payload as Record<string, unknown>;
  if (!('status' in p)) return true;
  const st = p['status'];
  if (!st || typeof st !== 'object' || Array.isArray(st)) return true;
  const key = (st as Record<string, unknown>)['key'];
  if (typeof key !== 'string') return true;
  return !excludeStatusKeys.includes(key);
}

/** Все условия бэклога как в `queryBacklogIssueSnapshots` (для тестов и офлайн-фильтрации). */
export function issuePayloadMatchesBacklogFilters(
  payload: unknown,
  options: {
    trackerQueueKey?: string | null;
    issueTypeKeys?: readonly string[];
    excludeStatusKeys?: readonly string[];
    onlyWithoutSprint?: boolean;
  } = {}
): boolean {
  const {
    trackerQueueKey,
    issueTypeKeys = DEFAULT_ISSUE_TYPE_KEYS,
    excludeStatusKeys = DEFAULT_EXCLUDE_STATUS_KEYS,
    onlyWithoutSprint = true,
  } = options;

  if (!issuePayloadMatchesQueueFilter(payload, trackerQueueKey)) return false;
  if (!issuePayloadMatchesTypeKeys(payload, issueTypeKeys)) return false;
  if (!issuePayloadMatchesStatusExclusion(payload, excludeStatusKeys)) return false;
  if (onlyWithoutSprint && !issuePayloadIsBacklogBySprint(payload)) return false;
  return true;
}
