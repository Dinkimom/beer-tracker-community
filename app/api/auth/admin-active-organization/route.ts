import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  setAdminActiveOrganizationCookie,
} from '@/lib/auth/adminActiveOrganizationCookie';
import { getProductUserIdFromRequest } from '@/lib/auth/productSession';
import { isProductSuperAdmin } from '@/lib/auth/superAdmin';
import { findOrganizationById } from '@/lib/organizations/organizationRepository';

const BodySchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * POST /api/auth/admin-active-organization — супер-админ: сохранить выбранную организацию (cookie path /admin).
 */
export async function POST(request: NextRequest) {
  const userId = getProductUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }
  if (!(await isProductSuperAdmin(userId))) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректный organizationId' }, { status: 400 });
  }

  const { organizationId } = parsed.data;
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, organizationId });
  setAdminActiveOrganizationCookie(res, organizationId);
  return res;
}
