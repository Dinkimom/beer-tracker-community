import { NextResponse } from 'next/server';

import { requireTenantOrgAdmin } from '@/lib/api-tenant';
import { listPendingInvitationsWithoutOrgMembership } from '@/lib/organizations/organizationInvitationsRepository';
import {
  listOrganizationMemberDirectory,
  parseMemberDirectoryTeamsJson,
} from '@/lib/organizations/organizationMembersRepository';

/**
 * GET /api/admin/organizations/[organizationId]/members
 * org_admin: участники organization_members + активные приглашения без членства в org.
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantOrgAdmin(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }

  const orgId = auth.ctx.organizationId;
  const [rows, pendingRows] = await Promise.all([
    listOrganizationMemberDirectory(orgId),
    listPendingInvitationsWithoutOrgMembership(orgId),
  ]);

  return NextResponse.json({
    members: rows.map((r) => ({
      addedAt: new Date(r.created_at).toISOString(),
      email: r.email,
      hasTeamMembership: r.has_team_membership,
      orgRole: r.org_role,
      teams: parseMemberDirectoryTeamsJson(r.teams_json).map((t) => ({
        isTeamLead: Boolean(t.is_team_lead),
        isTeamMember: Boolean(t.is_team_member),
        teamId: t.team_id,
        title: t.title,
      })),
      userId: r.user_id,
    })),
    pendingInvitations: pendingRows.map((p) => ({
      createdAt: new Date(p.created_at).toISOString(),
      email: p.email,
      expiresAt: new Date(p.expires_at).toISOString(),
      id: p.id,
      invitedTeamRole: p.invited_team_role,
      teamId: p.team_id,
      teamTitle: p.team_title,
    })),
  });
}
