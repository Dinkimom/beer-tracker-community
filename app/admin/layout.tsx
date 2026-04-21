import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AdminOrganizationIdProvider } from '@/features/admin/AdminOrganizationIdContext';
import { AdminShell } from '@/features/admin/AdminShell';
import { getCachedAdminOrganizationContext } from '@/lib/access/adminOrganizationContext';
import { findUserById, getVerifiedProductUserIdFromServerCookies } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getVerifiedProductUserIdFromServerCookies();
  if (!userId) {
    redirect('/login?next=/admin');
  }
  const [user, adminCtx] = await Promise.all([findUserById(userId), getCachedAdminOrganizationContext(userId)]);
  if (!user) {
    redirect('/login?next=/admin');
  }

  const { activeOrganizationId, isSuperAdmin, orgs } = adminCtx;
  if (orgs.length > 0 && !orgs.some((o) => o.canAccessAdmin)) {
    redirect('/?notice=admin-forbidden');
  }

  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-full" />}>
        <AdminOrganizationIdProvider organizationId={activeOrganizationId}>
          <AdminShell email={user.email} isSuperAdmin={isSuperAdmin} orgs={orgs}>
            {children}
          </AdminShell>
        </AdminOrganizationIdProvider>
      </Suspense>
    </div>
  );
}
