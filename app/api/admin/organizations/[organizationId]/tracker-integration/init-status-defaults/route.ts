import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import {
  findOrganizationById,
  getDecryptedOrganizationTrackerToken,
  updateOrganization,
} from '@/lib/organizations';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';
import {
  extractTrackerIntegrationJson,
  mergeOrganizationSettingsTrackerIntegration,
  parseTrackerIntegrationStored,
  type TrackerIntegrationStored,
} from '@/lib/trackerIntegration';
import { fetchTrackerOrganizationStatuses } from '@/lib/trackerIntegration/fetchTrackerOrgMetadata';
import { buildStatusDefaultsFromTrackerStatuses } from '@/lib/trackerIntegration/statusTypeDefaults';
import { resolveTrackerApiBaseUrlForOrganizationRow } from '@/lib/trackerRequestConfig';

function emptyStored(revision: number): TrackerIntegrationStored {
  return { configRevision: revision };
}

/**
 * POST /api/admin/organizations/[organizationId]/tracker-integration/init-status-defaults
 * Подмешивает эвристические defaultsByTrackerStatusType из GET /v3/statuses (существующие ключи не затираются).
 */
export async function POST(
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
            'Нет сохранённого OAuth-токена трекера. Сохраните токен во вкладке «Яндекс Трекер», затем повторите запрос.',
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
  const api = createTrackerAxiosInstance({
    apiUrl,
    oauthToken: token,
    orgId: trackerCloudOrgId,
  });

  try {
    const trackerStatuses = await fetchTrackerOrganizationStatuses(api);
    const built = buildStatusDefaultsFromTrackerStatuses(trackerStatuses);
    const prev = parseTrackerIntegrationStored(extractTrackerIntegrationJson(org.settings));
    const base = prev ?? emptyStored(0);
    const mergedDefaults = {
      ...built,
      ...(base.statuses?.defaultsByTrackerStatusType ?? {}),
    };

    const nextRevision = (base.configRevision ?? 0) + 1;
    const stored: TrackerIntegrationStored = {
      ...base,
      configRevision: nextRevision,
      statuses: {
        ...base.statuses,
        defaultsByTrackerStatusType: mergedDefaults,
        lastMetadataFetchedAt: new Date().toISOString(),
      },
    };

    const newSettings = mergeOrganizationSettingsTrackerIntegration(org.settings, stored);
    const updated = await updateOrganization(org.id, { settings: newSettings });
    if (!updated) {
      return NextResponse.json({ error: 'Не удалось сохранить' }, { status: 500 });
    }

    // Сброс кэша метаданных необязателен: статусы те же; fingerprint не менялся.

    return NextResponse.json({
      config: stored,
      ok: true,
      seededKeys: Object.keys(built),
      trackerStatusCount: trackerStatuses.length,
    });
  } catch (error) {
    return handleApiError(error, 'init tracker status defaults');
  }
}
