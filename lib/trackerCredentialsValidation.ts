/**
 * Проверка OAuth-токена Яндекс Трекера до сохранения в organization_secrets.
 */

import type { AxiosError } from 'axios';

import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';

export function cleanOrganizationTrackerToken(token: string): string {
  return token.replace(/\s+/g, '').trim();
}

/**
 * Нормализует базовый URL API (без завершающего слэша).
 */
export function normalizeTrackerApiBaseUrl(input: string): string {
  const raw = input.trim();
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('Tracker API URL must use http or https');
  }
  let path = u.pathname;
  while (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path ? `${u.origin}${path}` : u.origin;
}

export type ValidateTrackerCredentialsResult =
  { message: string; ok: false; status?: number } | { message?: string; ok: true };

/**
 * Проверка OAuth-токена: `GET /myself` и «администраторский» `GET /users`
 * (постраничный список пользователей организации в API v3).
 */
export async function validateYandexTrackerOAuth(params: {
  apiUrl: string;
  oauthToken: string;
  orgId: string;
}): Promise<ValidateTrackerCredentialsResult> {
  const token = cleanOrganizationTrackerToken(params.oauthToken);
  if (!token) {
    return { message: 'Токен пустой после нормализации', ok: false, status: 400 };
  }
  const orgId = params.orgId.trim();
  if (!orgId) {
    return { message: 'Укажите идентификатор организации в трекере', ok: false, status: 400 };
  }

  let apiUrl: string;
  try {
    apiUrl = normalizeTrackerApiBaseUrl(params.apiUrl);
  } catch {
    return { message: 'Некорректный URL API трекера', ok: false, status: 400 };
  }

  const api = createTrackerAxiosInstance({
    apiUrl,
    oauthToken: token,
    orgId,
  });

  try {
    await api.get('/myself');
  } catch (error: unknown) {
    const ax = error as AxiosError;
    const status = ax.response?.status;
    if (status === 401 || status === 403) {
      return {
        message: 'Токен отклонён трекером',
        ok: false,
        status: 400,
      };
    }
    return {
      message:
        status != null
          ? `Ошибка трекера (${String(status)})`
          : 'Не удалось связаться с API трекера',
      ok: false,
      status: 502,
    };
  }

  try {
    await api.get('/users', { params: { page: 1, perPage: 1 } });
  } catch (error: unknown) {
    const ax = error as AxiosError;
    const status = ax.response?.status;
    if (status === 401 || status === 403) {
      return {
        message:
          'Токен не имеет прав администратора',
        ok: false,
        status: 400,
      };
    }
    return {
      message:
        status != null
          ? `Ошибка трекера при проверке прав (${String(status)})`
          : 'Не удалось проверить права администратора в API Яндекс Трекера',
      ok: false,
      status: 502,
    };
  }

  return {
    message: 'Токен валиден, права администратора в Яндекс Трекере подтверждены',
    ok: true,
  };
}
