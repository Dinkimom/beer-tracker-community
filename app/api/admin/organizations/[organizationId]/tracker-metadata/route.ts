import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { apiCache, cacheKeys } from '@/lib/cache';
import {
  findOrganizationById,
  getDecryptedOrganizationTrackerToken,
} from '@/lib/organizations';
import {
  trackerAdminCatalogConnectionFingerprint,
  TRACKER_ADMIN_METADATA_TTL_SEC,
} from '@/lib/trackerApi/trackerAdminCatalogCache';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';
import {
  fetchTrackerOrganizationFields,
  fetchTrackerOrganizationStatuses,
  fetchTrackerFieldEnumValues,
  type TrackerMetadataFieldDto,
  type TrackerMetadataStatusDto,
} from '@/lib/trackerIntegration/fetchTrackerOrgMetadata';
import { resolveTrackerApiBaseUrlForOrganizationRow } from '@/lib/trackerRequestConfig';

/**
 * GET /api/admin/organizations/[organizationId]/tracker-metadata?resource=fields|statuses|all|field-values&fieldId=<id>
 * Поля и статусы Tracker v3 (кэш 5 мин).
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

  const orgId = auth.ctx.organizationId;
  const { searchParams } = new URL(request.url);
  const resource = (searchParams.get('resource') ?? 'all').toLowerCase();
  if (!['all', 'fields', 'statuses', 'field-values'].includes(resource)) {
    return NextResponse.json({ error: 'resource must be fields, statuses, field-values, or all' }, { status: 400 });
  }

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
  const fingerprint = trackerAdminCatalogConnectionFingerprint(token, apiUrl, trackerCloudOrgId);
  const api = createTrackerAxiosInstance({
    apiUrl,
    oauthToken: token,
    orgId: trackerCloudOrgId,
  });

  try {
    if (resource === 'field-values') {
      const fieldId = (searchParams.get('fieldId') ?? '').trim();
      if (!fieldId) {
        return NextResponse.json({ error: 'fieldId is required for resource=field-values' }, { status: 400 });
      }
      const values = await fetchTrackerFieldEnumValues(api, fieldId);
      return NextResponse.json({ fieldId, values });
    }

    const wantFields = resource === 'all' || resource === 'fields';
    const wantStatuses = resource === 'all' || resource === 'statuses';

    let fields: TrackerMetadataFieldDto[] | null = wantFields
      ? apiCache.get<TrackerMetadataFieldDto[]>(cacheKeys.adminTrackerOrgMetadata(orgId, fingerprint, 'fields'))
      : null;
    let statuses: TrackerMetadataStatusDto[] | null = wantStatuses
      ? apiCache.get<TrackerMetadataStatusDto[]>(cacheKeys.adminTrackerOrgMetadata(orgId, fingerprint, 'statuses'))
      : null;

    if (wantFields && !fields) {
      fields = await fetchTrackerOrganizationFields(api);
      apiCache.set(cacheKeys.adminTrackerOrgMetadata(orgId, fingerprint, 'fields'), fields, TRACKER_ADMIN_METADATA_TTL_SEC);
    }
    if (wantStatuses && !statuses) {
      statuses = await fetchTrackerOrganizationStatuses(api);
      apiCache.set(
        cacheKeys.adminTrackerOrgMetadata(orgId, fingerprint, 'statuses'),
        statuses,
        TRACKER_ADMIN_METADATA_TTL_SEC
      );
    }

    if (resource === 'fields') {
      return NextResponse.json({ fields: fields ?? [] });
    }
    if (resource === 'statuses') {
      return NextResponse.json({ statuses: statuses ?? [] });
    }
    return NextResponse.json({ fields: fields ?? [], statuses: statuses ?? [] });
  } catch (error) {
    return handleApiError(error, 'admin tracker metadata');
  }
}
