import { NextResponse } from 'next/server';

import { requireTenantWithAdminProfile } from '@/lib/api-tenant';

/**
 * GET /api/admin/organizations/[organizationId]/invitations — активные приглашения (без hash токена).
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  return NextResponse.json(
    { error: 'Инвайты отключены. Используйте управление составом команды.' },
    { status: 410 }
  );
}

/**
 * POST /api/admin/organizations/[organizationId]/invitations — устаревший контракт:
 * то же прямое добавление в команду, что и POST …/teams/{teamId}/members (без писем и токенов приглашения).
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  return NextResponse.json(
    { error: 'Инвайты отключены. Используйте управление составом команды.' },
    { status: 410 }
  );
}
