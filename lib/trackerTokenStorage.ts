/**
 * OAuth-токен Яндекс Трекера в localStorage с привязкой к организации продукта (tenant).
 * Legacy: значение как JSON-строка токена (`"y0_..."`) или сырой текст — см. {@link migrateTrackerTokenInLocalStorage}.
 */

import { PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY } from '@/lib/tenantHttpConstants';

/** Совпадает с {@link STORAGE_KEYS.TRACKER_TOKEN} в `hooks/localStorage/storageKeys.ts`. */
export const TRACKER_OAUTH_LOCAL_STORAGE_KEY = 'beer-tracker-tracker-token' as const;

export interface TrackerTokenPayload {
  organizationId: string;
  token: string;
}

function readActiveOrganizationIdRaw(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return localStorage.getItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

/**
 * Разбор сырого значения из localStorage (после migrate — объект `{ token, organizationId }`).
 */
export function parseTrackerTokenStorageRaw(raw: string | null): TrackerTokenPayload | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') {
      const t = parsed.trim();
      return t ? { organizationId: '', token: t } : null;
    }
    if (parsed && typeof parsed === 'object' && 'token' in parsed) {
      const o = parsed as { organizationId?: unknown; token?: unknown };
      const token = typeof o.token === 'string' ? o.token.trim() : '';
      if (!token) {
        return null;
      }
      const organizationId = typeof o.organizationId === 'string' ? o.organizationId.trim() : '';
      return { organizationId, token };
    }
  } catch {
    const t = raw.trim();
    return t ? { organizationId: '', token: t } : null;
  }
  return null;
}

export function readTrackerTokenPayload(): TrackerTokenPayload {
  if (typeof window === 'undefined') {
    return { organizationId: '', token: '' };
  }
  try {
    const raw = localStorage.getItem(TRACKER_OAUTH_LOCAL_STORAGE_KEY);
    return parseTrackerTokenStorageRaw(raw) ?? { organizationId: '', token: '' };
  } catch {
    return { organizationId: '', token: '' };
  }
}

export function writeTrackerTokenPayload(payload: TrackerTokenPayload): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const t = payload.token.trim();
    const org = payload.organizationId.trim();
    if (!t) {
      localStorage.removeItem(TRACKER_OAUTH_LOCAL_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      TRACKER_OAUTH_LOCAL_STORAGE_KEY,
      JSON.stringify({ organizationId: org, token: t })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Одноразовая миграция: JSON-строка токена, сырой текст или объект без organizationId.
 */
export function migrateTrackerTokenInLocalStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const key = TRACKER_OAUTH_LOCAL_STORAGE_KEY;
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return;
  }
  if (raw == null || raw.trim() === '') {
    return;
  }

  const activeOrg = readActiveOrganizationIdRaw();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (activeOrg) {
      writeTrackerTokenPayload({ organizationId: activeOrg, token: raw.trim() });
    }
    return;
  }

  if (typeof parsed === 'string') {
    const token = parsed.trim();
    if (token && activeOrg) {
      writeTrackerTokenPayload({ organizationId: activeOrg, token });
    }
    return;
  }

  if (parsed && typeof parsed === 'object' && 'token' in parsed) {
    const o = parsed as { organizationId?: unknown; token?: unknown };
    const token = typeof o.token === 'string' ? o.token.trim() : '';
    if (!token) {
      return;
    }
    const org = typeof o.organizationId === 'string' ? o.organizationId.trim() : '';
    if (!org && activeOrg) {
      writeTrackerTokenPayload({ organizationId: activeOrg, token });
    }
  }
}

/**
 * Токен для заголовка X-Tracker-Token: только если привязан к текущей активной org (или legacy без привязки).
 */
export function getEffectiveTrackerTokenForBrowser(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  migrateTrackerTokenInLocalStorage();
  const p = readTrackerTokenPayload();
  if (!p.token) {
    return '';
  }
  const active = readActiveOrganizationIdRaw();
  if (!p.organizationId) {
    return p.token;
  }
  if (!active || p.organizationId !== active) {
    return '';
  }
  return p.token;
}

/** Для {@link useSyncExternalStore} в AuthGuard и согласованности с axios. */
export function subscribeTrackerTokenGate(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const onCustom = (e: Event) => {
    const k = (e as CustomEvent<{ key?: string }>).detail?.key;
    if (k === TRACKER_OAUTH_LOCAL_STORAGE_KEY || k === PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === TRACKER_OAUTH_LOCAL_STORAGE_KEY ||
      e.key === PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener('localStorageChange', onCustom as EventListener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('localStorageChange', onCustom as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getTrackerTokenGateSnapshot(): string {
  return getEffectiveTrackerTokenForBrowser();
}
