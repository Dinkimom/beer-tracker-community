import { NextResponse } from 'next/server';

import { requireTeamManagementAccess, requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { query } from '@/lib/db';

/**
 * GET /api/admin/organizations/[organizationId]/teams/[teamId]/registry-search?q=...
 * Поиск сотрудников из public.registry_employees для добавления в команду.
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  const { organizationId, teamId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const denied = requireTeamManagementAccess(auth.profile, teamId);
  if (denied) {
    return denied;
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }
  const pattern = `%${q.replace(/%/g, '\\%')}%`;

  const res = await query<{
    avatar_link: string | null;
    email: string | null;
    full_name: string | null;
    name: string | null;
    patronymic: string | null;
    staff_uid: string;
    surname: string | null;
    tracker_id: string | null;
  }>(
    `SELECT
        re.uuid::text AS staff_uid,
        re.tracker_id::text AS tracker_id,
        re.email,
        re.name,
        re.surname,
        re.patronymic,
        re.fullname AS full_name,
        re.avatar_link
     FROM public.registry_employees re
     WHERE re.uuid IS NOT NULL
       AND (
         COALESCE(re.fullname, '') ILIKE $1
         OR COALESCE(re.surname, '') ILIKE $1
         OR COALESCE(re.name, '') ILIKE $1
         OR COALESCE(re.patronymic, '') ILIKE $1
         OR COALESCE(re.email, '') ILIKE $1
       )
       AND NOT EXISTS (
         SELECT 1
         FROM overseer.staff_teams st
         WHERE st.team_uid = $2::uuid
           AND st.staff_uid = re.uuid
       )
     ORDER BY COALESCE(NULLIF(TRIM(re.fullname), ''), re.email, re.uuid::text) ASC
     LIMIT 30`,
    [pattern, teamId]
  );

  return NextResponse.json({ items: res.rows });
}
