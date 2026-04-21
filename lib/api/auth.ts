/**
 * API аутентификации (валидация токена Tracker, текущий пользователь).
 */

import type { TrackerMyselfUser } from './types';
import type { AxiosError } from 'axios';

import { getPlannerBeerTrackerApi } from '../plannerBeerTrackerApiOverride';

/**
 * Возвращает данные текущего пользователя из Tracker (GET /myself).
 * Требует заголовок X-Tracker-Token (добавляется beerTrackerApi автоматически).
 */
export async function getMyself(): Promise<TrackerMyselfUser> {
  const { data } = await getPlannerBeerTrackerApi().get<TrackerMyselfUser>('/auth/myself');
  return data;
}

/**
 * Валидирует OAuth токен Яндекс Трекера.
 * `organizationId` — UUID организации продукта (если не передан, сервер читает заголовок X-Organization-Id).
 */
export async function validateToken(
  token: string,
  options?: { organizationId?: string }
): Promise<{
  error?: string;
  valid: boolean;
}> {
  try {
    const { data } = await getPlannerBeerTrackerApi().post('/auth/validate-token', {
      organizationId: options?.organizationId?.trim() || undefined,
      token: token.trim(),
    });
    return {
      valid: data.valid || false,
      error: data.error,
    };
  } catch (error) {
    console.error('Failed to validate token:', error);
    const ax = error as AxiosError<{ error?: string }>;
    const fromApi = ax.response?.data && typeof ax.response.data === 'object' ? ax.response.data.error : undefined;
    return {
      valid: false,
      error:
        typeof fromApi === 'string' && fromApi.trim()
          ? fromApi
          : 'Ошибка при проверке токена. Попробуйте еще раз.',
    };
  }
}
