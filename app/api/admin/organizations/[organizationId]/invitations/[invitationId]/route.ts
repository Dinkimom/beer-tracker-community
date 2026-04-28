import { NextResponse } from 'next/server';

import { requireTenantWithAdminProfile } from '@/lib/api-tenant';

/**
 * DELETE /api/admin/organizations/[organizationId]/invitations/[invitationId] — отозвать приглашение.
 */
export async function DELETE(
  request: Request,
  routeContext: { params: Promise<{ invitationId: string; organizationId: string }> }
) {
  const { organizationId, invitationId } = await routeContext.params;
  if (!invitationId) {
    return NextResponse.json({ error: 'Некорректный invitationId' }, { status: 400 });
  }
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  return NextResponse.json(
    { error: 'Инвайты отключены. Используйте управление составом команды.' },
    { status: 410 }
  );
}
