/**
 * Настроенные экземпляры axios для разных API
 * Централизованная конфигурация клиентов HTTP
 */

import axios, { type AxiosInstance } from 'axios';

import { getTrackerConfig } from './env';
import {
  PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY,
  TENANT_ORG_HEADER,
} from './tenantHttpConstants';
import { createTrackerAxiosInstance } from './trackerAxiosFactory';
import { getEffectiveTrackerTokenForBrowser } from './trackerTokenStorage';

/**
 * Создает экземпляр Yandex Tracker API
 * Ленивая инициализация для правильной работы в Next.js (клиент/сервер)
 */
function createTrackerApi(): AxiosInstance {
  const trackerConfig = getTrackerConfig();
  return createTrackerAxiosInstance({
    apiUrl: trackerConfig.apiUrl || 'https://api.tracker.yandex.net/v2',
    oauthToken: trackerConfig.oauthToken,
    orgId: trackerConfig.orgId,
  });
}

/**
 * Axios инстанс для Yandex Tracker API
 * Используйте этот экспорт только на серверной стороне (в API routes)
 *
 * Использует Proxy для ленивой инициализации - инстанс создается только при первом обращении
 */
let _trackerApiInstance: AxiosInstance | null = null;

export const trackerApi = new Proxy({} as AxiosInstance, {
  get(_target, prop) {
    if (!_trackerApiInstance) {
      _trackerApiInstance = createTrackerApi();
    }
    const value = _trackerApiInstance[prop as keyof AxiosInstance];
    return typeof value === 'function' ? value.bind(_trackerApiInstance) : value;
  },
});

/**
 * Axios инстанс для внутреннего Beer Tracker API
 * Используется в клиентских компонентах для обращения к Next.js API routes
 */
export const beerTrackerApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

beerTrackerApi.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const trackerToken = getEffectiveTrackerTokenForBrowser();
        if (trackerToken) {
          config.headers['X-Tracker-Token'] = trackerToken;
        }

        const orgId = localStorage
          .getItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY)
          ?.trim();
        if (orgId) {
          config.headers[TENANT_ORG_HEADER] = orgId;
        }
      } catch (error) {
        console.error('[beerTrackerApi] Error reading token from localStorage:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

beerTrackerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    if (status === 401 && typeof window !== 'undefined') {
      const { pathname, search } = window.location;
      const isAuthPage =
        pathname === '/login' || pathname === '/register' || pathname === '/auth-setup';
      if (!isAuthPage) {
        const next = encodeURIComponent(`${pathname}${search}`);
        if (pathname.startsWith('/admin')) {
          window.location.assign(`/login?next=${next}`);
        } else {
          window.location.assign(`/auth-setup?next=${next}`);
        }
      }
    }
    return Promise.reject(error);
  }
);
