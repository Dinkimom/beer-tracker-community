import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminOrganizationUsersClient } from '@/features/admin/members/AdminOrganizationUsersClient';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';
import { listOrganizationMemberDirectory, parseMemberDirectoryTeamsJson } from '@/lib/organizations';
import { listTeams } from '@/lib/staffTeams';

export default async function MembersPage() {
  const userId = await getVerifiedProductUserIdFromServerCookies();
  if (!userId) {
    redirect('/login?next=/admin/members');
  }

  const { activeOrganizationId, orgs } = await getCachedAdminOrganizationContext(userId);
  const adminOrg = orgs.find((o) => o.organization_id === activeOrganizationId);
  if (!adminOrg || adminOrg.role !== 'org_admin') {
    redirect('/admin/org');
  }

  const connectOrgId = adminOrg.organization_id;

  const [directoryRows, rawTeams] = await Promise.all([
    listOrganizationMemberDirectory(connectOrgId),
    listTeams(connectOrgId, { activeOnly: false }),
  ]);

  const initialMembers = directoryRows.map((r) => ({
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
  }));
  const initialTeams = rawTeams.map((t) => ({
    active: t.active,
    id: t.id,
    title: t.title,
  }));

  return (
    <Suspense>
      <AdminOrganizationUsersClient
        currentUserId={userId}
        initialMembers={initialMembers}
        initialTeams={initialTeams}
        orgId={connectOrgId}
      />
    </Suspense>
  );
}
