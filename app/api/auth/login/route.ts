import { NextResponse } from 'next/server';
import { z } from 'zod';

import { appendProductSessionCookie, findUserByEmail, verifyPassword } from '@/lib/auth';

const BodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

/**
 * POST /api/auth/login — проверка пароля и выдача cookie сессии.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);
  if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }
  const res = NextResponse.json({
    user: {
      email: user.email,
      emailVerified: user.email_verified_at !== null,
      id: user.id,
    },
  });
  appendProductSessionCookie(res, user.id);
  return res;
}
