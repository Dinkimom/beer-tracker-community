import { NextResponse } from 'next/server';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { getSyncPlatformEnv } from '@/lib/env';
import { findOrganizationById, updateOrganization } from '@/lib/organizations';
import {
  mergeOrganizationSettingsSyncPatch,
  OrgSyncSettingsPartialSchema,
  parseResolveAndValidateOrgSyncFromSettingsRoot,
} from '@/lib/orgSyncSettings';

const AdminSyncPatchSchema = OrgSyncSettingsPartialSchema.omit({ lastFullRescanAt: true });

/**
 * PATCH /api/admin/organizations/[organizationId]/sync/settings
 * org_admin: обновляет `organizations.settings.sync` (интервал, overlap, лимиты, enabled).
 */
export async function PATCH(
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

  const parsed = AdminSyncPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные поля настроек синхронизации', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: 'Передайте хотя бы одно поле (enabled, intervalMinutes, overlapMinutes, maxIssuesPerRun, windowUtc)' },
      { status: 400 }
    );
  }

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  const platform = getSyncPlatformEnv();
  const newSettings = mergeOrganizationSettingsSyncPatch(org.settings, parsed.data);
  const validation = parseResolveAndValidateOrgSyncFromSettingsRoot(newSettings, platform);
  if (!validation.ok) {
    return NextResponse.json(
      { code: validation.code, error: validation.message },
      { status: 422 }
    );
  }

  const updated = await updateOrganization(org.id, { settings: newSettings });
  if (!updated) {
    return NextResponse.json({ error: 'Не удалось сохранить' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    resolvedSync: validation.settings,
  });
}
