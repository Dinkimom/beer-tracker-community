/**
 * Утилиты для создания Tracker API клиентов с поддержкой пользовательских токенов
 */

import type { AxiosInstance } from 'axios';

import { createTrackerAxiosInstance } from './trackerAxiosFactory';
import { resolveTrackerApiConfigFromRequest } from './trackerRequestConfig';

/**
 * Создает экземпляр axios для Tracker API с кастомными креденшалами
 * Используйте этот экспорт только на серверной стороне (в API routes)
 */
export function createTrackerApiClient(config: {
  oauthToken: string;
  orgId: string;
  apiUrl?: string;
}): AxiosInstance {
  return createTrackerAxiosInstance(config);
}

/**
 * Создает экземпляр Tracker API клиента из запроса Next.js
 * (токен из заголовка, Cloud Org ID и URL — из tenant в БД или из env).
 */
export async function createTrackerApiFromRequest(request: Request): Promise<AxiosInstance> {
  const config = await resolveTrackerApiConfigFromRequest(request);
  return createTrackerApiClient(config);
}
