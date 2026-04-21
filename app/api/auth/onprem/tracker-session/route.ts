import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appendProductSessionCookie } from '@/lib/auth';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveProductUserIdForOnPremTrackerSession } from '@/lib/onPrem/establishProductSessionFromTrackerToken';
import { TrackerApiConfigError } from '@/lib/trackerRequestConfig';

const BodySchema = z.object({
  organizationId: z.string().uuid(),
  token: z.string().min(1).max(8192),
});

function cleanToken(token: string): string {
  return token.replace(/\s+/g, '').trim();
}

/**
 * POST /api/auth/onprem/tracker-session — cookie-сессия продукта по OAuth-токену трекера (без пароля).
 */
export async function POST(request: Request) {
  if (!isOnPremMode()) {
    return NextResponse.json({ error: 'Недоступно' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Укажите organizationId и token' }, { status: 400 });
  }

  const oauthToken = cleanToken(parsed.data.token);
  if (!oauthToken) {
    return NextResponse.json({ error: 'Токен пустой' }, { status: 400 });
  }

  try {
    const { userId } = await resolveProductUserIdForOnPremTrackerSession({
      oauthToken,
      organizationProductId: parsed.data.organizationId,
    });
    const res = NextResponse.json({ ok: true });
    appendProductSessionCookie(res, userId);
    return res;
  } catch (e) {
    if (e instanceof TrackerApiConfigError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[auth/onprem/tracker-session]', e);
    return NextResponse.json({ error: 'Не удалось выдать сессию' }, { status: 500 });
  }
}
