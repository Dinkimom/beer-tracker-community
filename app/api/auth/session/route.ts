import { NextResponse } from 'next/server';

import { enrichOrganizationSummariesForUser } from '@/lib/access/orgAccess';
import { getProductUserIdFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/auth/userRepository';
import { listUserOrganizations } from '@/lib/organizations';

/**
 * GET /api/auth/session — текущий пользователь продукта и список организаций (без пароля).
 */
export async function GET(request: Request) {
  const userId = getProductUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ user: null, organizations: [] });
  }
  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ user: null, organizations: [] });
  }
  const rawOrgs = await listUserOrganizations(userId);
  const organizations = await enrichOrganizationSummariesForUser(userId, rawOrgs);
  return NextResponse.json({
    organizations: organizations.map((o) => ({
      canAccessAdmin: o.canAccessAdmin ?? false,
      canUsePlanner: o.canUsePlanner ?? false,
      id: o.organization_id,
      managedTeamIds: o.managedTeamIds ?? (o.role === 'org_admin' ? null : []),
      initialSyncCompletedAt: o.initial_sync_completed_at
        ? new Date(o.initial_sync_completed_at).toISOString()
        : null,
      name: o.name,
      role: o.role,
      slug: o.slug,
    })),
    user: {
      email: user.email,
      emailVerified: user.email_verified_at !== null,
      id: user.id,
    },
  });
}
