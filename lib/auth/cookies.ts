/**
 * Чтение cookie сессии из заголовка Cookie запроса.
 */

import type { NextResponse } from 'next/server';

import { resolveAuthCookieSecure } from './cookieSecure';
import { PRODUCT_SESSION_COOKIE_NAME, PRODUCT_SESSION_MAX_AGE_SEC } from './constants';
import { signProductSessionToken } from './sessionToken';

function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const k = part.slice(0, idx).trim();
    if (k !== name) {
      continue;
    }
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function getProductSessionTokenFromRequest(request: Request): string | null {
  return parseCookieHeader(request.headers.get('cookie'), PRODUCT_SESSION_COOKIE_NAME);
}

export function appendProductSessionCookie(response: NextResponse, userId: string): void {
  const token = signProductSessionToken(userId);
  response.cookies.set(PRODUCT_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: PRODUCT_SESSION_MAX_AGE_SEC,
    path: '/',
    sameSite: 'lax',
    secure: resolveAuthCookieSecure(),
  });
}

export function clearProductSessionCookie(response: NextResponse): void {
  response.cookies.set(PRODUCT_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: resolveAuthCookieSecure(),
  });
}
