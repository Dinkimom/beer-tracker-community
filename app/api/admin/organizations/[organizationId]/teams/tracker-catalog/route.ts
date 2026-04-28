import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { apiCache, cacheKeys } from '@/lib/cache';
import {
  findOrganizationById,
  getDecryptedOrganizationTrackerToken,
} from '@/lib/organizations';
import { listTeams } from '@/lib/staffTeams';
import { fetchTrackerBoardsPaginate, fetchTrackerQueuesPaginate } from '@/lib/trackerApi';
import {
  TRACKER_ADMIN_CATALOG_QUEUES_BOARDS_TTL_SEC,
  trackerAdminCatalogConnectionFingerprint,
} from '@/lib/trackerApi/trackerAdminCatalogCache';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';
import { resolveTrackerApiBaseUrlForOrganizationRow } from '@/lib/trackerRequestConfig';

interface CachedTrackerCatalogSlice {
  boards: { id: number; name: string }[];
  queues: { key: string; name: string }[];
}

/**
 * GET /api/admin/organizations/[organizationId]/teams/tracker-catalog
 * org_admin: очереди и доски из Трекера (серверный токен организации) + текущие привязки команд.
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }

  const orgId = auth.ctx.organizationId;
  const org = await findOrganizationById(orgId);
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
    const t = await getDecryptedOrganizationTrackerToken(orgId);
    if (!t?.trim()) {
      return NextResponse.json(
        {
          error:
            'Нет сохранённого OAuth-токена трекера. Сохраните токен во вкладке «Яндекс Трекер», затем обновите каталог.',
        },
        { status: 422 }
      );
    }
    token = t.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const apiUrl = resolveTrackerApiBaseUrlForOrganizationRow(org);
  const trackerCloudOrgId = org.tracker_org_id.trim();
  const cacheFingerprint = trackerAdminCatalogConnectionFingerprint(
    token,
    apiUrl,
    trackerCloudOrgId
  );
  const qbCacheKey = cacheKeys.adminTrackerCatalogQueuesBoards(orgId, cacheFingerprint);

  const api = createTrackerAxiosInstance({
    apiUrl,
    oauthToken: token,
    orgId: trackerCloudOrgId,
  });

  try {
    let slice = apiCache.get<CachedTrackerCatalogSlice>(qbCacheKey);
    if (!slice) {
      const [queues, boards] = await Promise.all([
        fetchTrackerQueuesPaginate(api),
        fetchTrackerBoardsPaginate(api),
      ]);
      slice = {
        boards: boards.map((b) => ({ id: b.id, name: b.name })),
        queues: queues.map((q) => ({ key: q.key, name: q.name })),
      };
      apiCache.set(qbCacheKey, slice, TRACKER_ADMIN_CATALOG_QUEUES_BOARDS_TTL_SEC);
    }

    const teams = await listTeams(orgId, { activeOnly: false });

    return NextResponse.json({
      boards: slice.boards,
      queues: slice.queues,
      teams: teams.map((t) => ({
        id: t.id,
        title: t.title,
        tracker_board_id: t.tracker_board_id,
        tracker_queue_key: t.tracker_queue_key,
      })),
    });
  } catch (error) {
    return handleApiError(error, 'admin tracker catalog (queues and boards)');
  }
}
