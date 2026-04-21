import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminTeamDetailClient } from '@/features/admin/teams/[teamId]/AdminTeamDetailClient';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { resolveAccessProfile } from '@/lib/access/orgAccess';
import { getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';
import { isOrganizationTrackerConnectionReady } from '@/lib/organizations/organizationTrackerAdminFormState';
import { getOrganizationTrackerAdminFormState } from '@/lib/organizations/organizationTrackerConnection';
import {
  enrichTeamMembersDisplayNamesFromTracker,
  findTeamById,
  listTeamMembersWithStaff,
} from '@/lib/staffTeams';

interface TeamDetailPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const userId = await getVerifiedProductUserIdFromServerCookies();
  if (!userId) {
    redirect('/login?next=/admin/teams');
  }

  const { teamId } = await params;

  const { activeOrganizationId, orgs } = await getCachedAdminOrganizationContext(userId);
  const primary =
    orgs.find((o) => o.organization_id === activeOrganizationId && o.canAccessAdmin) ??
    orgs.find((o) => o.canAccessAdmin);
  if (!primary) {
    redirect('/admin/org');
  }

  const resolvedOrgId = primary.organization_id;

  const trackerFormState = await getOrganizationTrackerAdminFormState(resolvedOrgId);
  if (!isOrganizationTrackerConnectionReady(trackerFormState)) {
    redirect('/admin/tracker');
  }

  const [rawTeam, rawMembersListed] = await Promise.all([
    findTeamById(resolvedOrgId, teamId),
    listTeamMembersWithStaff(resolvedOrgId, teamId),
  ]);

  if (!rawTeam) {
    notFound();
  }

  const rawMembers = await enrichTeamMembersDisplayNamesFromTracker(
    resolvedOrgId,
    rawMembersListed
  );

  const profile = await resolveAccessProfile(userId, resolvedOrgId);
  const isOrgAdmin = profile?.orgRole === 'org_admin';
  const isTeamLeadForThis =
    profile?.teamMemberships.some((t) => t.teamId === teamId && t.isTeamLead) ?? false;
  if (!isOrgAdmin && !isTeamLeadForThis) {
    notFound();
  }

  const team = {
    active: rawTeam.active,
    id: rawTeam.id,
    slug: rawTeam.slug,
    title: rawTeam.title,
    tracker_board_id: String(rawTeam.tracker_board_id),
    tracker_queue_key: rawTeam.tracker_queue_key,
  };

  const members = rawMembers.map((m) => ({
    pending_product_invitation: Boolean(m.pending_product_invitation),
    product_planner_is_team_lead:
      m.product_planner_is_team_lead == null ? null : Boolean(m.product_planner_is_team_lead),
    product_team_access: Boolean(m.product_team_access),
    product_user_in_org: Boolean(m.product_user_in_org),
    product_user_id: m.product_user_id ?? null,
    role_slug: m.role_slug,
    staff_display_name: m.staff_display_name,
    staff_email: m.staff_email,
    staff_id: m.staff_id,
    staff_tracker_user_id: m.staff_tracker_user_id,
  }));

  return (
    <Suspense>
      <AdminTeamDetailClient
        initialMembers={members}
        initialTeam={team}
        isOrgAdmin={isOrgAdmin}
        orgId={resolvedOrgId}
      />
    </Suspense>
  );
}
