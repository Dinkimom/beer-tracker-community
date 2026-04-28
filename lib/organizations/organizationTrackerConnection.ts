/**
 * Сохранение параметров трекера и серверного токена (транзакция) + постановка initial_full.
 */

import type { OrganizationTrackerAdminFormState } from './organizationTrackerAdminFormState';
import type { QueryParams } from '@/types';

import { encryptOrgTrackerToken } from '@/lib/crypto-org-secrets';
import { pool, qualifyBeerTrackerTables } from '@/lib/db';
import { getOrgSecretsMasterKey, getTrackerConfig } from '@/lib/env';
import { enqueueInitialFullSync } from '@/lib/sync/queue';
import { isSyncRedisConfigured } from '@/lib/sync/redisConnection';
import {
  cleanOrganizationTrackerToken,
  normalizeTrackerApiBaseUrl,
  validateYandexTrackerOAuth,
} from '@/lib/trackerCredentialsValidation';

import { findOrganizationById } from './organizationRepository';
import {
  findOrganizationSecretRow,
  getDecryptedOrganizationTrackerToken,
} from './organizationSecretsRepository';

export type { OrganizationTrackerAdminFormState } from './organizationTrackerAdminFormState';

export type VerifyStoredTrackerTokenResult =
  { error: string; ok: false; status: number } | { ok: true };

export interface ConnectOrganizationTrackerInput {
  /**
   * Пустая строка / не передан — берётся сохранённый в БД токен (если есть).
   * Новое значение перешифровывается и заменяет секрет.
   */
  oauthToken?: string;
  organizationId: string;
  /** Если не задан — берётся из TRACKER_API_URL. */
  trackerApiBaseUrl?: string | null;
  trackerOrgId: string;
  userId: string;
}

export type ConnectOrganizationTrackerResult =
  | {
      ok: true;
      syncJobEnqueued: boolean;
      syncJobWarning?: string;
      /** Ни поля, ни токен не менялись — запрос в трекер не нужен. */
      unchanged?: boolean;
    }
  | { error: string; ok: false; status: number };

function resolveDefaultTrackerApiUrl(): string {
  return getTrackerConfig().apiUrl;
}

async function persistTrackerConnection(params: {
  encryptedToken: Buffer;
  organizationId: string;
  trackerOrgId: string;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = async (text: string, values?: QueryParams) => {
      await client.query(qualifyBeerTrackerTables(text), values);
    };
    await run(
      `UPDATE organizations
       SET tracker_org_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [params.organizationId, params.trackerOrgId]
    );
    await run(
      `INSERT INTO organization_secrets (organization_id, encrypted_tracker_token, encryption_key_version)
       VALUES ($1, $2, 1)
       ON CONFLICT (organization_id) DO UPDATE
       SET encrypted_tracker_token = EXCLUDED.encrypted_tracker_token,
           encryption_key_version = 1,
           updated_at = CURRENT_TIMESTAMP`,
      [params.organizationId, params.encryptedToken]
    );
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

async function persistTrackerOrgFieldsOnly(params: {
  organizationId: string;
  trackerOrgId: string;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = async (text: string, values?: QueryParams) => {
      await client.query(qualifyBeerTrackerTables(text), values);
    };
    await run(
      `UPDATE organizations
       SET tracker_org_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [params.organizationId, params.trackerOrgId]
    );
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Поля формы админки (без секретов): UUID org в продукте, Cloud Org ID трекера, факт наличия шифрованного токена.
 */
export async function getOrganizationTrackerAdminFormState(
  organizationId: string
): Promise<OrganizationTrackerAdminFormState | null> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return null;
  }
  const row = await findOrganizationSecretRow(organizationId);
  const buf = row?.encrypted_tracker_token;
  const hasStoredToken =
    buf != null && (Buffer.isBuffer(buf) ? buf.length > 0 : Buffer.byteLength(Buffer.from(buf)) > 0);
  return {
    hasStoredToken,
    organizationId: org.id,
    trackerOrgId: org.tracker_org_id?.trim() ?? '',
  };
}

export interface VerifyOrganizationTrackerTokenOptions {
  /** Токен из формы; если не передан или пустой — берётся сохранённый в БД. */
  oauthToken?: string;
  /** Cloud Organization ID из формы; если не передан или пустой — из БД. */
  trackerOrgId?: string;
}

/**
 * Проверка токена к API трекера без записи в БД.
 * Можно передать `oauthToken` и `trackerOrgId` из формы до нажатия «Сохранить».
 */
export async function verifyOrganizationTrackerTokenForAdmin(
  organizationId: string,
  options?: VerifyOrganizationTrackerTokenOptions
): Promise<VerifyStoredTrackerTokenResult> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return { error: 'Организация не найдена', ok: false, status: 404 };
  }

  const fromFormOrg = options?.trackerOrgId?.trim();
  const trackerOrgId =
    fromFormOrg && fromFormOrg !== ''
      ? fromFormOrg
      : (org.tracker_org_id?.trim() ?? '');

  if (!trackerOrgId) {
    return {
      error: 'Укажите Cloud Organization ID в форме',
      ok: false,
      status: 400,
    };
  }

  const draftToken =
    options?.oauthToken != null ? cleanOrganizationTrackerToken(options.oauthToken) : '';

  let token: string;
  if (draftToken) {
    token = draftToken;
  } else {
    try {
      const t = await getDecryptedOrganizationTrackerToken(organizationId);
      if (!t?.trim()) {
        return {
          error:
            'Введите OAuth-токен в поле и нажмите «Проверить», либо сначала сохраните настройки',
          ok: false,
          status: 400,
        };
      }
      token = t.replace(/\s+/g, '').trim();
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Не удалось прочитать сохранённый токен',
        ok: false,
        status: 500,
      };
    }
  }

  const rawUrl = resolveDefaultTrackerApiUrl();
  let trackerApiBaseUrl: string;
  try {
    trackerApiBaseUrl = normalizeTrackerApiBaseUrl(rawUrl);
  } catch {
    return {
      error: 'Некорректный URL API трекера в настройках организации',
      ok: false,
      status: 400,
    };
  }
  const validated = await validateYandexTrackerOAuth({
    apiUrl: trackerApiBaseUrl,
    oauthToken: token,
    orgId: trackerOrgId,
  });
  if (!validated.ok) {
    return { error: validated.message, ok: false, status: validated.status ?? 400 };
  }
  return { ok: true };
}

/** Проверка только сохранённых в БД org id и токена (тело запроса не используется). */
export async function verifyStoredOrganizationTrackerToken(
  organizationId: string
): Promise<VerifyStoredTrackerTokenResult> {
  return verifyOrganizationTrackerTokenForAdmin(organizationId);
}

/**
 * Валидирует токен в трекере, затем сохраняет URL/org id и при необходимости шифрованный токен.
 * Пустой `oauthToken` — используется ранее сохранённый токен (если org/url не менялись, БД не трогаем).
 * При изменении настроек или новом токене ставит initial_full в Redis (если настроен).
 */
export async function connectOrganizationTracker(
  input: ConnectOrganizationTrackerInput
): Promise<ConnectOrganizationTrackerResult> {
  const org = await findOrganizationById(input.organizationId);
  if (!org) {
    return { error: 'Организация не найдена', ok: false, status: 404 };
  }

  const rawUrl =
    input.trackerApiBaseUrl != null && String(input.trackerApiBaseUrl).trim() !== ''
      ? String(input.trackerApiBaseUrl).trim()
      : resolveDefaultTrackerApiUrl();

  let trackerApiBaseUrl: string;
  try {
    trackerApiBaseUrl = normalizeTrackerApiBaseUrl(rawUrl);
  } catch {
    return { error: 'Некорректный URL API трекера', ok: false, status: 400 };
  }

  const trackerOrgId = input.trackerOrgId.trim();
  if (!trackerOrgId) {
    return { error: 'Укажите идентификатор организации в трекере', ok: false, status: 400 };
  }

  const prevOrgId = org.tracker_org_id?.trim() ?? '';
  const configUnchanged = prevOrgId === trackerOrgId;

  const tokenFromInput = cleanOrganizationTrackerToken(input.oauthToken ?? '');
  const wroteNewToken = Boolean(tokenFromInput);

  if (configUnchanged && !wroteNewToken) {
    return { ok: true, syncJobEnqueued: false, unchanged: true };
  }

  let cleanedToken: string;
  if (tokenFromInput) {
    cleanedToken = tokenFromInput;
  } else {
    let stored: string | null;
    try {
      stored = await getDecryptedOrganizationTrackerToken(org.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось прочитать сохранённый токен';
      return { error: msg, ok: false, status: 500 };
    }
    const s = stored?.replace(/\s+/g, '').trim() ?? '';
    if (!s) {
      return {
        error: 'Укажите OAuth-токен при первом подключении или смените токен',
        ok: false,
        status: 400,
      };
    }
    cleanedToken = s;
  }

  const validated = await validateYandexTrackerOAuth({
    apiUrl: trackerApiBaseUrl,
    oauthToken: cleanedToken,
    orgId: trackerOrgId,
  });
  if (!validated.ok) {
    return {
      error: validated.message,
      ok: false,
      status: validated.status ?? 400,
    };
  }

  try {
    if (wroteNewToken) {
      let encrypted: Buffer;
      try {
        const key = getOrgSecretsMasterKey();
        encrypted = encryptOrgTrackerToken(cleanedToken, key);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка шифрования токена';
        return { error: msg, ok: false, status: 500 };
      }
      await persistTrackerConnection({
        encryptedToken: encrypted,
        organizationId: input.organizationId,
        trackerOrgId,
      });
    } else {
      await persistTrackerOrgFieldsOnly({
        organizationId: input.organizationId,
        trackerOrgId,
      });
    }
  } catch (e) {
    console.error('[connectOrganizationTracker] persist failed', e);
    return { error: 'Не удалось сохранить настройки', ok: false, status: 500 };
  }

  let syncJobEnqueued = false;
  let syncJobWarning: string | undefined;
  if (isSyncRedisConfigured()) {
    try {
      await enqueueInitialFullSync(input.organizationId, input.userId);
      syncJobEnqueued = true;
    } catch (e) {
      syncJobWarning =
        e instanceof Error ? e.message : 'Не удалось поставить initial_full в очередь';
    }
  } else {
    syncJobWarning = 'Redis не настроен (REDIS_URL); первичную синхронизацию нужно запустить вручную';
  }

  return { ok: true, syncJobEnqueued, syncJobWarning };
}
