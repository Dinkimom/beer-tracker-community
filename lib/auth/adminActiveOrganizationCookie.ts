import type { NextResponse } from 'next/server';

import { resolveAuthCookieSecure } from './cookieSecure';

/** HttpOnly cookie: активная организация в админке для супер-админа (path /admin). */
export const ADMIN_ACTIVE_ORGANIZATION_COOKIE = 'bt_admin_organization_id';

const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function cookieBase() {
  return {
    httpOnly: true,
    path: '/admin',
    sameSite: 'lax' as const,
    secure: resolveAuthCookieSecure(),
  };
}

export function setAdminActiveOrganizationCookie(response: NextResponse, organizationId: string): void {
  response.cookies.set(ADMIN_ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    ...cookieBase(),
    maxAge: MAX_AGE_SEC,
  });
}

export function clearAdminActiveOrganizationCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_ACTIVE_ORGANIZATION_COOKIE, '', {
    ...cookieBase(),
    maxAge: 0,
  });
}
