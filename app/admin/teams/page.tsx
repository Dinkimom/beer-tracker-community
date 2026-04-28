import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminOrganizationUsersClient } from '@/features/admin/members/AdminOrganizationUsersClient';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';
import { listOrganizationTeamsWithMembersFromOverseer } from '@/lib/organizations/organizationMembersRepository';

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
  const teamDirectory = await listOrganizationTeamsWithMembersFromOverseer(resolvedOrgId);

  return (
    <Suspense>
      <AdminOrganizationUsersClient orgId={resolvedOrgId} teamDirectory={teamDirectory} />
    </Suspense>
  );
}
