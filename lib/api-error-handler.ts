import { NextResponse } from 'next/server';

import { TrackerApiConfigError } from '@/lib/trackerRequestConfig';

type ErrorContext =
  | string
  | 'fetch backlog'
  | 'fetch data from Tracker'
  | 'fetch issue'
  | 'fetch sprints from Tracker'
  | 'fetch stories';

/** Стабильный идентификатор для клиента (новые поля не ломают старых потребителей `error`). */
export type ApiErrorCode =
  string | 'internal_error' | 'too_many_requests' | 'upstream_client_error';

export interface HandleApiErrorOptions {
  /**
   * Код для разбора на клиенте. Если не задан: при 500 — `internal_error`,
   * при проброшенном 4xx от апстрима — `upstream_client_error`.
   */
  code?: ApiErrorCode;
  /**
   * Если задано — HTTP-статусы ответа апстрима (axios), которые пробрасываем как есть.
   * Если не задано — как раньше: кроме 429 всё сворачивается в 500 (не ломаем существующие route).
   */
  forwardStatuses?: readonly number[];
}

/** Типичные 4xx от Yandex Tracker для проброса в новых маршрутах. */
export const TRACKER_UPSTREAM_FORWARD_STATUSES: readonly number[] = [
  400, 401, 403, 404, 409, 422,
];

function getAxiosResponse(error: unknown): { status?: number; data?: unknown; headers?: unknown } | undefined {
  const e = error as { response?: { status?: number; data?: unknown; headers?: unknown } };
  return e.response;
}

function extractUpstreamMessage(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const msg = o.errorMessage ?? o.message ?? o.error;
    if (typeof msg === 'string') return msg;
  }
  return undefined;
}

function errorDetailsFromUnknown(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return undefined;
}

/**
 * Унифицированная обработка ошибок для API routes.
 *
 * **Тело ответа (JSON):**
 * - `error` (string) — сообщение для пользователя / логики UI (как раньше).
 * - `code` (string) — машинный код (`internal_error`, `too_many_requests`, `upstream_client_error` или свой из `options.code`).
 * - `details` (string, опционально) — уточнение (сообщение `Error` или текст от апстрима).
 *
 * **Статусы:** 429 обрабатывается отдельно. Если в `options.forwardStatuses` передан список
 * (например `TRACKER_UPSTREAM_FORWARD_STATUSES`), axios-ответ с таким статусом пробрасывается;
 * иначе, как раньше, всё кроме 429 даёт 500.
 */
export function handleApiError(
  error: unknown,
  context: ErrorContext,
  options?: HandleApiErrorOptions
): NextResponse {
  console.error(`[${context}]`, error);

  if (error instanceof TrackerApiConfigError) {
    return NextResponse.json(
      {
        code: 'tracker_config' satisfies ApiErrorCode,
        error: error.message,
      },
      { status: error.status }
    );
  }

  const upstream = getAxiosResponse(error);
  const forwardList = options?.forwardStatuses;

  if (upstream?.status === 429) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        code: 'too_many_requests' satisfies ApiErrorCode,
      },
      { status: 429 }
    );
  }

  const upstreamStatus = upstream?.status;
  const passThrough =
    forwardList &&
    upstreamStatus != null &&
    forwardList.includes(upstreamStatus)
      ? upstreamStatus
      : null;

  const status = passThrough ?? 500;
  const fallbackError = `Failed to ${context}`;
  const upstreamMsg = extractUpstreamMessage(upstream?.data);
  const errMsg = errorDetailsFromUnknown(error);

  const errorText =
    status === 500 ? fallbackError : (upstreamMsg ?? errMsg ?? fallbackError);

  const body: Record<string, string> = {
    error: errorText,
  };

  const code: ApiErrorCode =
    options?.code ??
    (status === 500 ? 'internal_error' : 'upstream_client_error');
  body.code = code;

  if (status === 500 && errMsg) {
    body.details = errMsg;
  } else if (status !== 500 && (upstreamMsg || errMsg)) {
    const detail = upstreamMsg ?? errMsg;
    if (detail && detail !== errorText) {
      body.details = detail;
    }
  }

  return NextResponse.json(body, { status });
}
