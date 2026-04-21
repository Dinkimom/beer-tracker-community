import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  appendProductSessionCookie,
  findUserByEmail,
  hashPassword,
  insertUser,
} from '@/lib/auth';
import { allocateUniqueOrganizationSlug } from '@/lib/auth/orgSlug';
import { pool, qualifyBeerTrackerTables } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { readOnPremSetupState } from '@/lib/onPrem/setupState';
import { buildDefaultTrackerIntegrationStored, mergeOrganizationSettingsTrackerIntegration } from '@/lib/trackerIntegration';

const BodySchema = z.object({
  email: z.string().email().max(320),
  orgName: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(128),
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

function isOnPremAlreadyInitialized(err: unknown): boolean {
  return err instanceof Error && err.message === 'ONPREM_ALREADY_INITIALIZED';
}

/**
 * POST /api/auth/register — регистрация учётки продукта; выдаёт cookie сессии.
 * Подтверждение email в MVP не требуется.
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
    return NextResponse.json(
      { error: 'Проверьте email и пароль (минимум 8 символов), а также название организации' },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  if (!isOnPremMode()) {
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже есть' }, { status: 409 });
    }
    try {
      const hash = hashPassword(password);
      const user = await insertUser(email, hash);
      const res = NextResponse.json({
        user: {
          email: user.email,
          emailVerified: user.email_verified_at !== null,
          id: user.id,
        },
      });
      appendProductSessionCookie(res, user.id);
      return res;
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json({ error: 'Пользователь с таким email уже есть' }, { status: 409 });
      }
      console.error('[auth/register]', err);
      return NextResponse.json({ error: 'Не удалось зарегистрироваться' }, { status: 500 });
    }
  }

  const setupState = await readOnPremSetupState();
  if (setupState.initialized) {
    return NextResponse.json(
      {
        error:
          'Самостоятельная регистрация отключена. Попросите администратора добавить вас в команду и войдите по OAuth-токену трекера на странице настройки.',
      },
      { status: 403 }
    );
  }

  const orgName = parsed.data.orgName?.trim();
  if (!orgName) {
    return NextResponse.json(
      { error: 'Для первичной настройки укажите название организации' },
      { status: 400 }
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: 'Пользователь с таким email уже есть' }, { status: 409 });
  }
  try {
    const slug = await allocateUniqueOrganizationSlug(orgName);
    const settings = mergeOrganizationSettingsTrackerIntegration(
      {},
      buildDefaultTrackerIntegrationStored(0)
    );
    const hash = hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Сериализуем первичный онбординг, чтобы параллельные запросы не создали вторую организацию.
      await client.query('SELECT pg_advisory_xact_lock(742_001)');
      const stateResult = await client.query<{
        has_organizations: boolean;
        has_users: boolean;
      }>(
        qualifyBeerTrackerTables(
          `SELECT
             EXISTS(SELECT 1 FROM organizations) AS has_organizations,
             EXISTS(SELECT 1 FROM users) AS has_users`
        )
      );
      const state = stateResult.rows[0];
      if (state?.has_organizations || state?.has_users) {
        throw new Error('ONPREM_ALREADY_INITIALIZED');
      }
      const userResult = await client.query<{
        email: string;
        email_verified_at: Date | null;
        id: string;
      }>(
        qualifyBeerTrackerTables(
          `INSERT INTO users (email, password_hash)
           VALUES (LOWER(TRIM($1)), $2)
           RETURNING id, email, email_verified_at`
        ),
        [email.trim().toLowerCase(), hash]
      );
      const user = userResult.rows[0];
      if (!user) {
        throw new Error('register/onprem: no user row returned');
      }
      const orgResult = await client.query<{ id: string }>(
        qualifyBeerTrackerTables(
          `INSERT INTO organizations (name, slug, tracker_api_base_url, tracker_org_id, settings)
           VALUES ($1, $2, 'https://api.tracker.yandex.net/v3', '', $3::jsonb)
           RETURNING id`
        ),
        [orgName, slug, JSON.stringify(settings)]
      );
      const organizationId = orgResult.rows[0]?.id;
      if (!organizationId) {
        throw new Error('register/onprem: no organization row returned');
      }
      await client.query(
        qualifyBeerTrackerTables(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'org_admin')`
        ),
        [organizationId, user.id]
      );
      await client.query('COMMIT');
      const res = NextResponse.json({
        organization: {
          id: organizationId,
          name: orgName,
          slug,
        },
        user: {
          email: user.email,
          emailVerified: user.email_verified_at !== null,
          id: user.id,
        },
      });
      appendProductSessionCookie(res, user.id);
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (isOnPremAlreadyInitialized(err)) {
      return NextResponse.json(
        {
          error:
            'Инициализация уже выполнена. Войдите или попросите администратора добавить вас в команду.',
        },
        { status: 409 }
      );
    }
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        {
          error:
            'Инициализация уже выполнена. Войдите или попросите администратора добавить вас в команду.',
        },
        { status: 409 }
      );
    }
    console.error('[auth/register:onprem]', err);
    return NextResponse.json({ error: 'Не удалось завершить первичную настройку' }, { status: 500 });
  }
}
