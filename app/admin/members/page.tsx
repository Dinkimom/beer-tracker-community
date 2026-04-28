import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminRegistryEmployeesClient } from '@/features/admin/members/AdminRegistryEmployeesClient';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';
import { listRegistryEmployeesDirectory } from '@/lib/organizations/organizationMembersRepository';

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

  const rows = await listRegistryEmployeesDirectory(connectOrgId);

  return (
    <Suspense>
      <AdminRegistryEmployeesClient rows={rows} />
    </Suspense>
  );
}
