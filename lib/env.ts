/**
 * Утилиты для работы с переменными окружения
 * Централизованное место для получения env переменных
 */

import { timingSafeEqual } from 'crypto';

export function getTrackerConfig() {
  return {
    apiUrl: process.env.TRACKER_API_URL || 'https://api.tracker.yandex.net/v2',
    // Умышленно не используем токен из переменных окружения –
    // авторизация всегда должна идти через пользовательский токен из заголовка.
    oauthToken: '',
    /** Не используется: Cloud Org ID трекера берётся из tenant (organizations.tracker_org_id). */
    orgId: '',
  };
}

/**
 * Подключение к PostgreSQL приложения (схема `BEER_TRACKER_SCHEMA`).
 * Переменные: `POSTGRES_*` или стандартные `PG*` (как у libpq).
 */
export function getPostgresConfig() {
  return {
    host: process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || process.env.PGPORT || '5432', 10),
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'postgres',
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
  };
}

/**
 * Имя схемы для таблиц beer-tracker в PostgreSQL приложения (по умолчанию beer_tracker).
 * Для схем с дефисом в SQL используются кавычки.
 */
export function getBeerTrackerSchema(): string {
  const v = process.env.BEER_TRACKER_SCHEMA;
  return (typeof v === 'string' && v.trim()) ? v.trim() : 'beer_tracker';
}

const ORG_SECRETS_KEY_BYTES = 32;

/**
 * Парсит мастер-ключ AES-256 для organization_secrets: 64 hex-символа или base64 на 32 байта.
 */
export function parseOrgSecretsMasterKey(raw: string | undefined): Buffer {
  if (raw === undefined || !raw.trim()) {
    throw new Error('ORG_SECRETS_ENCRYPTION_KEY is required for organization tracker token encryption');
  }
  const s = raw.trim();
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(s)) {
    buf = Buffer.from(s, 'hex');
  } else {
    buf = Buffer.from(s, 'base64');
  }
  if (buf.length !== ORG_SECRETS_KEY_BYTES) {
    throw new Error(
      `ORG_SECRETS_ENCRYPTION_KEY must decode to ${ORG_SECRETS_KEY_BYTES} bytes (AES-256); got ${buf.length}`
    );
  }
  return buf;
}

export function getOrgSecretsMasterKey(): Buffer {
  return parseOrgSecretsMasterKey(process.env.ORG_SECRETS_ENCRYPTION_KEY);
}

/** Глобальные границы и дефолты синхронизации (оператор платформы). См. design.md. */
export interface SyncPlatformEnv {
  cronTickMinutes: number;
  defaultIntervalMinutes: number;
  defaultMaxIssuesPerRun: number;
  defaultOverlapMinutes: number;
  /** Интервал между успешными full_rescan для одной org (админский API). `0` — без кулдауна. */
  fullRescanCooldownMinutes: number;
  /** Верхняя граница числа задач за один прогон initial_full / full_rescan (защита от бесконечного цикла). */
  fullSyncMaxIssuesPerRun: number;
  maxIntervalMinutes: number;
  maxMaxIssuesPerRun: number;
  maxOrgsPerTick: number;
  maxOverlapMinutes: number;
  minIntervalMinutes: number;
  minMaxIssuesPerRun: number;
  minOverlapMinutes: number;
}

function readPositiveIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function readNonNegativeIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

let syncPlatformEnvCache: SyncPlatformEnv | undefined;

/**
 * Читает SYNC_* из окружения. Кэшируется на процесс.
 * Требует: min/default overlap строго больше cron-тика (иначе конфиг платформы противоречив).
 */
export function getSyncPlatformEnv(): SyncPlatformEnv {
  if (syncPlatformEnvCache !== undefined) {
    return syncPlatformEnvCache;
  }
  const cronTickMinutes = readPositiveIntEnv(
    'SYNC_CRON_TICK_MINUTES',
    process.env.SYNC_CRON_TICK_MINUTES,
    5
  );
  const minIntervalMinutes = readPositiveIntEnv(
    'SYNC_MIN_INTERVAL_MINUTES',
    process.env.SYNC_MIN_INTERVAL_MINUTES,
    5
  );
  const maxIntervalMinutes = readPositiveIntEnv(
    'SYNC_MAX_INTERVAL_MINUTES',
    process.env.SYNC_MAX_INTERVAL_MINUTES,
    1440
  );
  const defaultIntervalMinutes = readPositiveIntEnv(
    'SYNC_DEFAULT_INTERVAL_MINUTES',
    process.env.SYNC_DEFAULT_INTERVAL_MINUTES,
    15
  );
  const minOverlapMinutes = readPositiveIntEnv(
    'SYNC_MIN_OVERLAP_MINUTES',
    process.env.SYNC_MIN_OVERLAP_MINUTES,
    cronTickMinutes + 1
  );
  const maxOverlapMinutes = readPositiveIntEnv(
    'SYNC_MAX_OVERLAP_MINUTES',
    process.env.SYNC_MAX_OVERLAP_MINUTES,
    240
  );
  const defaultOverlapMinutes = readPositiveIntEnv(
    'SYNC_DEFAULT_OVERLAP_MINUTES',
    process.env.SYNC_DEFAULT_OVERLAP_MINUTES,
    Math.max(cronTickMinutes + 1, minOverlapMinutes, 10)
  );
  const maxOrgsPerTick = readPositiveIntEnv(
    'SYNC_MAX_ORGS_PER_TICK',
    process.env.SYNC_MAX_ORGS_PER_TICK,
    50
  );
  const defaultMaxIssuesPerRun = readPositiveIntEnv(
    'SYNC_DEFAULT_MAX_ISSUES_PER_RUN',
    process.env.SYNC_DEFAULT_MAX_ISSUES_PER_RUN,
    500
  );
  const minMaxIssuesPerRun = readPositiveIntEnv(
    'SYNC_MIN_MAX_ISSUES_PER_RUN',
    process.env.SYNC_MIN_MAX_ISSUES_PER_RUN,
    10
  );
  const maxMaxIssuesPerRun = readPositiveIntEnv(
    'SYNC_MAX_MAX_ISSUES_PER_RUN',
    process.env.SYNC_MAX_MAX_ISSUES_PER_RUN,
    5000
  );
  const fullSyncMaxIssuesPerRun = readPositiveIntEnv(
    'SYNC_FULL_SYNC_MAX_ISSUES_PER_RUN',
    process.env.SYNC_FULL_SYNC_MAX_ISSUES_PER_RUN,
    50_000
  );
  const fullRescanCooldownMinutes = readNonNegativeIntEnv(
    'SYNC_FULL_RESCAN_COOLDOWN_MINUTES',
    process.env.SYNC_FULL_RESCAN_COOLDOWN_MINUTES,
    0
  );

  if (minIntervalMinutes > maxIntervalMinutes) {
    throw new Error('SYNC_MIN_INTERVAL_MINUTES must be <= SYNC_MAX_INTERVAL_MINUTES');
  }
  if (minOverlapMinutes > maxOverlapMinutes) {
    throw new Error('SYNC_MIN_OVERLAP_MINUTES must be <= SYNC_MAX_OVERLAP_MINUTES');
  }
  if (defaultIntervalMinutes < minIntervalMinutes || defaultIntervalMinutes > maxIntervalMinutes) {
    throw new Error('SYNC_DEFAULT_INTERVAL_MINUTES must be within min/max interval bounds');
  }
  if (defaultOverlapMinutes < minOverlapMinutes || defaultOverlapMinutes > maxOverlapMinutes) {
    throw new Error('SYNC_DEFAULT_OVERLAP_MINUTES must be within min/max overlap bounds');
  }
  if (minOverlapMinutes <= cronTickMinutes) {
    throw new Error('SYNC_MIN_OVERLAP_MINUTES must be greater than SYNC_CRON_TICK_MINUTES');
  }
  if (defaultOverlapMinutes <= cronTickMinutes) {
    throw new Error('SYNC_DEFAULT_OVERLAP_MINUTES must be greater than SYNC_CRON_TICK_MINUTES');
  }
  if (minMaxIssuesPerRun > maxMaxIssuesPerRun) {
    throw new Error('SYNC_MIN_MAX_ISSUES_PER_RUN must be <= SYNC_MAX_MAX_ISSUES_PER_RUN');
  }
  if (
    defaultMaxIssuesPerRun < minMaxIssuesPerRun ||
    defaultMaxIssuesPerRun > maxMaxIssuesPerRun
  ) {
    throw new Error('SYNC_DEFAULT_MAX_ISSUES_PER_RUN must be within min/max issues-per-run bounds');
  }
  if (fullSyncMaxIssuesPerRun < minMaxIssuesPerRun) {
    throw new Error(
      'SYNC_FULL_SYNC_MAX_ISSUES_PER_RUN must be >= SYNC_MIN_MAX_ISSUES_PER_RUN'
    );
  }

  syncPlatformEnvCache = {
    cronTickMinutes,
    minIntervalMinutes,
    maxIntervalMinutes,
    defaultIntervalMinutes,
    minOverlapMinutes,
    maxOverlapMinutes,
    defaultOverlapMinutes,
    maxOrgsPerTick,
    defaultMaxIssuesPerRun,
    fullRescanCooldownMinutes,
    fullSyncMaxIssuesPerRun,
    minMaxIssuesPerRun,
    maxMaxIssuesPerRun,
  };
  return syncPlatformEnvCache;
}

/** Сброс кэша getSyncPlatformEnv (только тесты). */
export function resetSyncPlatformEnvCacheForTests(): void {
  syncPlatformEnvCache = undefined;
}

/**
 * Redis для BullMQ (полные sync и статусы). Пусто — режим без Redis по design.
 */
export function getRedisUrl(): string | undefined {
  const v = process.env.REDIS_URL;
  if (typeof v !== 'string') {
    return undefined;
  }
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Секрет для POST /api/internal/sync/tick и аналогов. Пустая строка — эндпоинт не должен принимать вызовы.
 */
export function getSyncCronSecret(): string {
  const v = process.env.SYNC_CRON_SECRET;
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Сравнение секрета cron без утечки по времени (длины должны совпадать).
 */
export function verifySyncCronSecret(provided: string | null | undefined): boolean {
  const expected = getSyncCronSecret();
  if (!expected) {
    return false;
  }
  if (provided === null || provided === undefined) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

const AUTH_SESSION_SECRET_MIN_LEN = 32;

/**
 * Секрет подписи cookie сессии продукта (HMAC-SHA256). В production обязателен, ≥ 32 символов.
 */
export function getAuthSessionSecret(): string {
  const raw = process.env.AUTH_SESSION_SECRET?.trim();
  if (!raw || raw.length < AUTH_SESSION_SECRET_MIN_LEN) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `AUTH_SESSION_SECRET must be set and at least ${AUTH_SESSION_SECRET_MIN_LEN} characters`
      );
    }
    console.warn(
      '[auth] AUTH_SESSION_SECRET missing or short; using dev-only fallback (not for production)'
    );
    return 'dev-only-auth-session-secret-min-32-chars!!';
  }
  return raw;
}

