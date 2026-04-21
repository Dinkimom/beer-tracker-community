import { NextResponse } from 'next/server';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { listStaff } from '@/lib/staffTeams';

/**
 * GET /api/admin/organizations/[organizationId]/staff
 * org_admin: список сотрудников организации.
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;

  const auth = await requireTenantForOrganization(request, organizationId);
  if (auth.response) {
    return auth.response;
  }
  const denied = requireOrgAdmin(auth.ctx);
  if (denied) {
    return denied;
  }

  const staff = await listStaff(auth.ctx.organizationId);
  return NextResponse.json({ staff });
}
