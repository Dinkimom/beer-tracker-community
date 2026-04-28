import { NextResponse } from 'next/server';

/**
 * GET /api/invitations/[token] — метаданные приглашения для формы (email read-only на клиенте).
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  const { token } = await routeContext.params;
  if (!request || !token) {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Инвайты отключены' }, { status: 410 });
}

/**
 * POST /api/invitations/[token] — пароль, создание/проверка пользователя, членство, cookie сессии.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ token: string }> }
) {
  const { token } = await routeContext.params;
  if (!request || !token) {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Инвайты отключены' }, { status: 410 });
}
