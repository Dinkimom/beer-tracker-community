import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appendProductSessionCookie } from '@/lib/auth';
import { parseInvitationRawTokenFromRouteParam } from '@/lib/invitations/invitationTokenRouteParse';
import {
  acceptOrganizationInvitation,
  getInvitationPreview,
} from '@/lib/organizations/invitationService';

const PostBodySchema = z.object({
  password: z.string().min(8).max(128),
});

/**
 * GET /api/invitations/[token] — метаданные приглашения для формы (email read-only на клиенте).
 */
export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  const { token: tokenParam } = await routeContext.params;
  const rawToken = parseInvitationRawTokenFromRouteParam(tokenParam);
  const preview = await getInvitationPreview(rawToken);
  if (!preview.ok) {
    const status = preview.reason === 'not_found' ? 404 : 410;
    return NextResponse.json(
      { error: 'Ссылка недействительна или устарела', reason: preview.reason },
      { status }
    );
  }
  return NextResponse.json({
    email: preview.email,
    expiresAt: preview.expiresAt,
    organizationName: preview.organizationName,
    teamTitle: preview.teamTitle,
  });
}

/**
 * POST /api/invitations/[token] — пароль, создание/проверка пользователя, членство, cookie сессии.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  const { token: tokenParam } = await routeContext.params;
  const rawToken = parseInvitationRawTokenFromRouteParam(tokenParam);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Пароль: минимум 8 символов' }, { status: 400 });
  }

  const result = await acceptOrganizationInvitation(rawToken, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const res = NextResponse.json({
    organizationId: result.organizationId,
    ok: true,
    userId: result.userId,
  });
  appendProductSessionCookie(res, result.userId);
  return res;
}
