/**
 * Единая фабрика Axios для Yandex Tracker (интерцепторы, ретраи 429).
 * Серверные маршруты должны использовать инстанс из getTrackerApiFromRequest —
 * не дефолтный trackerApi из axios.ts (у него намеренно пустой OAuth).
 */

import type { AxiosAdapter, AxiosInstance } from 'axios';

import axios from 'axios';

export interface TrackerAxiosCreateConfig {
  /** Кастомный транспорт (например в тестах), иначе стандартный HTTP-адаптер Axios */
  adapter?: AxiosAdapter;
  apiUrl?: string;
  oauthToken: string;
  orgId: string;
}

const MAX_RETRIES = 6;
const MAX_GATEWAY_RETRIES = 5;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60_000;

const GATEWAY_RETRY_STATUSES = new Set([502, 503, 504]);

function attachTrackerInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use(
    (config) => config,
    (error) => {
      console.error('[Tracker Request Error]', error);
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config;

      if (error.response?.status === 429 && config) {
        const cfg = config as { _retryCount?: number; url?: string };
        cfg._retryCount = (cfg._retryCount ?? 0) + 1;
        if (cfg._retryCount <= MAX_RETRIES) {
          const retryAfterHeader = error.response.headers?.['retry-after'];
          const retryAfterSec =
            retryAfterHeader != null ? parseInt(String(retryAfterHeader), 10) : NaN;
          let delayMs: number;
          if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
            delayMs = Math.min(retryAfterSec * 1000, MAX_DELAY_MS);
          } else {
            delayMs = Math.min(
              BASE_DELAY_MS * 2 ** (cfg._retryCount - 1),
              MAX_DELAY_MS
            );
          }
          const jitter = delayMs * 0.15 * (2 * Math.random() - 1);
          const delay = Math.round(delayMs + jitter);

          console.warn(
            `[Tracker] 429 Too Many Requests — retry ${cfg._retryCount}/${MAX_RETRIES} after ${delay}ms (${cfg.url})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return instance.request(config);
        }
      }

      const status = error.response?.status;
      if (status != null && GATEWAY_RETRY_STATUSES.has(status) && config) {
        const cfg = config as { _gatewayRetryCount?: number; url?: string };
        cfg._gatewayRetryCount = (cfg._gatewayRetryCount ?? 0) + 1;
        if (cfg._gatewayRetryCount <= MAX_GATEWAY_RETRIES) {
          const delayMs = Math.min(
            BASE_DELAY_MS * 2 ** (cfg._gatewayRetryCount - 1),
            MAX_DELAY_MS
          );
          const jitter = delayMs * 0.12 * (2 * Math.random() - 1);
          const delay = Math.round(delayMs + jitter);
          console.warn(
            `[Tracker] ${String(status)} ${error.response?.statusText ?? ''} — gateway retry ${String(cfg._gatewayRetryCount)}/${String(MAX_GATEWAY_RETRIES)} after ${String(delay)}ms (${cfg.url ?? ''})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return instance.request(config);
        }
      }

      console.error('[Tracker Response Error]', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });
      return Promise.reject(error);
    }
  );
}

/**
 * Создаёт AxiosInstance для Tracker API с общими интерцепторами (в т.ч. 429).
 */
export function createTrackerAxiosInstance(config: TrackerAxiosCreateConfig): AxiosInstance {
  const instance = axios.create({
    ...(config.adapter != null ? { adapter: config.adapter } : {}),
    baseURL: config.apiUrl || 'https://api.tracker.yandex.net/v2',
    headers: {
      'Authorization': `OAuth ${config.oauthToken}`,
      'X-Org-ID': config.orgId,
      'Content-Type': 'application/json',
    },
  });
  attachTrackerInterceptors(instance);
  return instance;
}

/**
 * lib/trackerApi/* принимает опциональный AxiosInstance; без него нельзя звать трекер
 * (дефолтный server trackerApi с пустым OAuth ломает запросы).
 */
export function requireTrackerAxiosForApiRoute(client: AxiosInstance | undefined): AxiosInstance {
  if (client == null) {
    throw new Error(
      'Yandex Tracker API requires an AxiosInstance from getTrackerApiFromRequest(request). ' +
        'The default server trackerApi has no user OAuth token (by design).'
    );
  }
  return client;
}
