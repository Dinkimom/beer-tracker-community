import { NextResponse } from 'next/server';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { verifyOrganizationTrackerTokenForAdmin } from '@/lib/organizations/organizationTrackerConnection';

/**
 * POST /api/admin/organizations/[organizationId]/tracker/verify
 * org_admin: проверка токена против API трекера (без записи в БД).
 * Тело JSON опционально: `{ "oauthToken"?: string, "trackerOrgId"?: string }` — значения из формы до «Сохранить».
 * Без тела или с пустыми полями используются сохранённые org id и токен.
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

  let oauthToken: string | undefined;
  let trackerOrgId: string | undefined;
  try {
    const raw = await request.text();
    if (raw.trim()) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        if (typeof o.oauthToken === 'string') oauthToken = o.oauthToken;
        if (typeof o.trackerOrgId === 'string') trackerOrgId = o.trackerOrgId;
      }
    }
  } catch {
    /* пустое или невалидное тело — как раньше, только сохранённые данные */
  }

  const result = await verifyOrganizationTrackerTokenForAdmin(auth.ctx.organizationId, {
    oauthToken,
    trackerOrgId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ok: false }, { status: result.status });
  }
  return NextResponse.json({
    message:
      'Токен рабочий, права администратора в Яндекс Трекере подтверждены',
    ok: true,
  });
}
