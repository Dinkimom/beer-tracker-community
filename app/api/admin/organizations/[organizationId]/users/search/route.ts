import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import {
  findOrganizationById,
  getDecryptedOrganizationTrackerToken,
} from '@/lib/organizations';
import {
  fetchTrackerUsersPaginate,
  filterTrackerUsers,
} from '@/lib/trackerApi';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';
import { resolveTrackerApiBaseUrlForOrganizationRow } from '@/lib/trackerRequestConfig';

/**
 * GET /api/admin/organizations/[organizationId]/users/search?q=...
 * org_admin: поиск пользователей напрямую в Яндекс Трекере (по токену организации).
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantForOrganization(request, organizationId);
  if (auth.response) return auth.response;
  const denied = requireOrgAdmin(auth.ctx);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }
  if (!org.tracker_org_id?.trim()) {
    return NextResponse.json(
      { error: 'Сначала укажите Cloud Organization ID в разделе «Яндекс Трекер».' },
      { status: 422 }
    );
  }

  let token: string;
  try {
    const t = await getDecryptedOrganizationTrackerToken(auth.ctx.organizationId);
    if (!t?.trim()) {
      return NextResponse.json(
        { error: 'Нет OAuth-токена трекера. Сохраните токен во вкладке «Яндекс Трекер».' },
        { status: 422 }
      );
    }
    token = t.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const api = createTrackerAxiosInstance({
    apiUrl: resolveTrackerApiBaseUrlForOrganizationRow(org),
    oauthToken: token,
    orgId: org.tracker_org_id.trim(),
  });

  try {
    const allUsers = await fetchTrackerUsersPaginate(api);
    const items = filterTrackerUsers(allUsers, q);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'admin tracker users search');
  }
}
