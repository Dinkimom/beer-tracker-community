import type { AxiosError } from 'axios';

import { NextRequest, NextResponse } from 'next/server';

import { TENANT_ORG_HEADER } from '@/lib/tenantHttpConstants';
import { createTrackerApiClient } from '@/lib/tracker-client';
import { userMessageFromYandexTrackerErrorBody } from '@/lib/trackerApi/yandexTrackerErrorMessages';
import {
  TrackerApiConfigError,
  resolveValidateTokenTrackerContext,
} from '@/lib/trackerRequestConfig';

/**
 * Очищает токен от всех пробельных символов
 */
function cleanToken(token: string): string {
  return token.replace(/\s+/g, '').trim();
}

/**
 * Валидирует OAuth токен, делая тестовый запрос к Yandex Tracker API.
 * Cloud Org ID — из заголовка X-Organization-Id или тела `organizationId` при сессии продукта
 * (контекст организации из БД).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { organizationId?: unknown; token?: unknown };
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required', valid: false },
        { status: 400 }
      );
    }

    const cleanedToken = cleanToken(token);

    if (!cleanedToken) {
      return NextResponse.json(
        { error: 'Token cannot be empty after cleaning', valid: false },
        { status: 400 }
      );
    }

    const rawHeader = request.headers.get(TENANT_ORG_HEADER)?.trim() ?? '';
    const rawBodyOrg =
      typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    if (rawHeader && rawBodyOrg && rawHeader !== rawBodyOrg) {
      return NextResponse.json(
        {
          error: 'organizationId в теле запроса не совпадает с заголовком X-Organization-Id',
          valid: false,
        },
        { status: 400 }
      );
    }

    let apiUrl: string;
    let orgId: string;
    try {
      const ctx = await resolveValidateTokenTrackerContext(request, body.organizationId);
      apiUrl = ctx.apiUrl;
      orgId = ctx.orgId;
    } catch (e) {
      if (e instanceof TrackerApiConfigError) {
        return NextResponse.json(
          {
            error: e.message,
            valid: false,
          },
          { status: e.status }
        );
      }
      throw e;
    }

    const trackerApi = createTrackerApiClient({
      apiUrl,
      oauthToken: cleanedToken,
      orgId,
    });

    await trackerApi.get('/myself');

    return NextResponse.json({
      message: 'Token is valid',
      valid: true,
    });
  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    console.error('[validateToken] Error:', {
      data: axiosError.response?.data,
      message: axiosError.message,
      status: axiosError.response?.status,
    });

    const status = axiosError.response?.status;
    let errorMessage = 'Failed to validate token';

    if (status === 401) {
      errorMessage = 'Недействительный токен. Пожалуйста, получите новый токен.';
    } else if (status === 403) {
      errorMessage = 'Токен не имеет доступа к организации. Проверьте права доступа.';
    } else if (status === 404) {
      errorMessage = 'Неверный формат токена или организация не найдена.';
    } else {
      const fromTracker = userMessageFromYandexTrackerErrorBody(axiosError.response?.data);
      if (fromTracker) errorMessage = fromTracker;
    }

    return NextResponse.json(
      {
        details: axiosError.response?.data,
        error: errorMessage,
        valid: false,
      },
      { status: 200 }
    );
  }
}
