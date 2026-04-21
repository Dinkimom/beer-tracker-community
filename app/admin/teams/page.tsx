import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminTeamsPageClient } from '@/features/admin/teams/AdminTeamsPageClient';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { resolveAccessProfile } from '@/lib/access/orgAccess';
import { getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';
import { isOrganizationTrackerConnectionReady } from '@/lib/organizations/organizationTrackerAdminFormState';
import { getOrganizationTrackerAdminFormState } from '@/lib/organizations/organizationTrackerConnection';
import { listTeams } from '@/lib/staffTeams';

export default async function TeamsPage() {
  const userId = await getVerifiedProductUserIdFromServerCookies();
  if (!userId) {
    redirect('/login?next=/admin/teams');
  }

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

  const accessProfile = await resolveAccessProfile(userId, resolvedOrgId);
  const isOrgAdmin = accessProfile?.orgRole === 'org_admin';
  const leadTeamIds = new Set(
    (accessProfile?.teamMemberships ?? [])
      .filter((t) => t.isTeamLead)
      .map((t) => t.teamId)
  );

  const rawTeams = await listTeams(resolvedOrgId, { activeOnly: false });
  const filteredTeams = isOrgAdmin
    ? rawTeams
    : rawTeams.filter((t) => leadTeamIds.has(t.id));
  const teams = filteredTeams.map((t) => ({
    active: t.active,
    id: t.id,
    slug: t.slug,
    title: t.title,
    tracker_board_id: String(t.tracker_board_id),
    tracker_queue_key: t.tracker_queue_key,
  }));

  return (
    <Suspense>
      <AdminTeamsPageClient initialTeams={teams} isOrgAdmin={isOrgAdmin} orgId={resolvedOrgId} />
    </Suspense>
  );
}
