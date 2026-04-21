import { NextResponse } from 'next/server';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { findOrganizationById, updateOrganization } from '@/lib/organizations';
import {
  extractTrackerIntegrationJson,
  mergeOrganizationSettingsTrackerIntegration,
  parseTrackerIntegrationStored,
  TrackerIntegrationPutBodySchema,
  type TrackerIntegrationStored,
} from '@/lib/trackerIntegration';

function emptyStored(revision: number): TrackerIntegrationStored {
  return {
    configRevision: revision,
  };
}

/**
 * GET /api/admin/organizations/[organizationId]/tracker-integration
 * Полный конфиг интеграции для админ-формы.
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

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  const parsed = parseTrackerIntegrationStored(extractTrackerIntegrationJson(org.settings));
  return NextResponse.json({ config: parsed ?? emptyStored(0) });
}

/**
 * PUT /api/admin/organizations/[organizationId]/tracker-integration
 * Заменяет `settings.trackerIntegration`, инкрементирует configRevision.
 */
export async function PUT(
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const raw =
    json !== null && typeof json === 'object' && !Array.isArray(json)
      ? { ...(json as Record<string, unknown>) }
      : {};
  delete raw.configRevision;

  const parsed = TrackerIntegrationPutBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректная конфигурация', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  const prev = parseTrackerIntegrationStored(extractTrackerIntegrationJson(org.settings));
  const nextRevision = (prev?.configRevision ?? 0) + 1;
  const stored: TrackerIntegrationStored = {
    ...parsed.data,
    configRevision: nextRevision,
  };

  const newSettings = mergeOrganizationSettingsTrackerIntegration(org.settings, stored);
  const updated = await updateOrganization(org.id, { settings: newSettings });
  if (!updated) {
    return NextResponse.json({ error: 'Не удалось сохранить' }, { status: 500 });
  }

  return NextResponse.json({ config: stored, ok: true });
}
