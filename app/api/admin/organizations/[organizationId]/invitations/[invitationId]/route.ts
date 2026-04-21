import { NextResponse } from 'next/server';

import { requireTenantWithAdminProfile } from '@/lib/api-tenant';
import {
  findPendingOrganizationInvitationInOrg,
  revokeOrganizationInvitation,
} from '@/lib/organizations/organizationInvitationsRepository';

/**
 * DELETE /api/admin/organizations/[organizationId]/invitations/[invitationId] — отозвать приглашение.
 */
export async function DELETE(
  request: Request,
  routeContext: { params: Promise<{ invitationId: string; organizationId: string }> }
) {
  const { organizationId, invitationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const { profile } = auth;

  const isOrgAdmin = profile.orgRole === 'org_admin';
  const leadTeamIds = new Set(
    profile.teamMemberships.filter((t) => t.isTeamLead).map((t) => t.teamId)
  );
  if (!isOrgAdmin) {
    if (leadTeamIds.size === 0) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }
    const inv = await findPendingOrganizationInvitationInOrg(invitationId, organizationId);
    if (!inv) {
      return NextResponse.json({ error: 'Приглашение не найдено или уже недоступно' }, { status: 404 });
    }
    if (inv.team_id == null || !leadTeamIds.has(inv.team_id)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }
  }

  const ok = await revokeOrganizationInvitation(invitationId, organizationId);
  if (!ok) {
    return NextResponse.json({ error: 'Приглашение не найдено или уже недоступно' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
