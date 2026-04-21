/**
 * Создание и принятие приглашений в команду организации.
 */

import type { PoolClient } from 'pg';

import { findUserByEmail, hashPassword, verifyPassword } from '@/lib/auth';
import { pool, qualifyBeerTrackerTables } from '@/lib/db';
import { scheduleInvitationEmailDelivery } from '@/lib/email/invitationEmail';
import {
  generateInvitationRawToken,
  hashInvitationToken,
} from '@/lib/invitations/invitationTokens';
import {
  type InvitedTeamRole,
  type OrganizationInvitationRow,
  findOrganizationInvitationByTokenHash,
  insertOrganizationInvitation,
} from '@/lib/organizations/organizationInvitationsRepository';
import {
  findOrganizationMembership,
  listUserOrganizations,
} from '@/lib/organizations/organizationMembersRepository';
import { findOrganizationById } from '@/lib/organizations/organizationRepository';
import { findTeamById } from '@/lib/staffTeams';
import {
  findStaffByOrganizationAndEmailNorm,
  findStaffByTrackerUserId,
  insertStaff,
  type UpdateStaffPatch,
  updateStaff,
} from '@/lib/staffTeams/staffRepository';

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function appBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, '') : 'http://localhost:3000';
}

function inviteRoleToFlags(role: InvitedTeamRole): { isTeamLead: boolean; isTeamMember: boolean } {
  if (role === 'team_lead') {
    return { isTeamLead: true, isTeamMember: false };
  }
  return { isTeamLead: false, isTeamMember: true };
}

function displayNameFromInvitationEmail(emailNorm: string): string {
  const lower = emailNorm.trim().toLowerCase();
  const at = lower.indexOf('@');
  if (at > 0) {
    return lower.slice(0, at);
  }
  return lower.length > 0 ? lower : 'Пользователь';
}

/**
 * Данные выбранного пользователя трекера при создании приглашения — сразу пишем в staff,
 * чтобы после принятия приглашения в планере был tracker_user_id (синхронизация исполнителя).
 */
export async function upsertStaffFromTrackerInvitationContext(input: {
  displayName?: string | undefined;
  emailNorm: string;
  organizationId: string;
  trackerUserId: string;
}): Promise<void> {
  const emailLower = input.emailNorm.trim().toLowerCase();
  const tid = input.trackerUserId.trim();
  if (!tid) {
    return;
  }
  const display =
    input.displayName?.trim() ||
    displayNameFromInvitationEmail(emailLower) ||
    tid;

  const byTracker = await findStaffByTrackerUserId(input.organizationId, tid);
  if (byTracker) {
    const patch: UpdateStaffPatch = {};
    if ((byTracker.email ?? '').trim().toLowerCase() !== emailLower) {
      patch.email = emailLower;
    }
    if (byTracker.display_name !== display) {
      patch.display_name = display;
    }
    if ((byTracker.tracker_user_id ?? '').trim() !== tid) {
      patch.tracker_user_id = tid;
    }
    if (Object.keys(patch).length > 0) {
      await updateStaff(input.organizationId, byTracker.id, patch);
    }
    return;
  }

  const byEmail = await findStaffByOrganizationAndEmailNorm(input.organizationId, emailLower);
  if (byEmail) {
    await updateStaff(input.organizationId, byEmail.id, {
      display_name: display,
      email: emailLower,
      tracker_user_id: tid,
    });
    return;
  }

  await insertStaff(input.organizationId, {
    display_name: display,
    email: emailLower,
    tracker_user_id: tid,
  });
}

async function resolveOrCreateStaffIdForInvitationEmailInTx(
  client: PoolClient,
  organizationId: string,
  invitationEmailNorm: string
): Promise<string> {
  const emailLower = invitationEmailNorm.trim().toLowerCase();
  const found = await client.query<{ id: string }>(
    qualifyBeerTrackerTables(
      `SELECT id FROM staff
       WHERE organization_id = $1
         AND email IS NOT NULL
         AND LOWER(TRIM(email)) = $2
       LIMIT 1`
    ),
    [organizationId, emailLower]
  );
  let staffId = found.rows[0]?.id;
  if (!staffId) {
    const displayName = displayNameFromInvitationEmail(emailLower);
    const ins = await client.query<{ id: string }>(
      qualifyBeerTrackerTables(
        `INSERT INTO staff (organization_id, tracker_user_id, display_name, email, manual_override_flags)
         VALUES ($1, NULL, $2, $3, NULL)
         RETURNING id`
      ),
      [organizationId, displayName, emailLower]
    );
    staffId = ins.rows[0]?.id;
    if (!staffId) {
      throw new Error('resolveOrCreateStaffIdForInvitationEmailInTx: staff insert failed');
    }
  }
  return staffId;
}

/**
 * Ростер команды в админке строится по team_members + staff; приглашение до этого писало только user_team_memberships.
 */
async function ensureStaffAndTeamMemberForInviteInTx(
  client: PoolClient,
  organizationId: string,
  teamId: string,
  invitationEmailNorm: string
): Promise<void> {
  const staffId = await resolveOrCreateStaffIdForInvitationEmailInTx(
    client,
    organizationId,
    invitationEmailNorm
  );

  await client.query(
    qualifyBeerTrackerTables(
      `INSERT INTO team_members (team_id, staff_id, role_slug)
       VALUES ($1::uuid, $2::uuid, NULL)
       ON CONFLICT (team_id, staff_id) DO NOTHING`
    ),
    [teamId, staffId]
  );
}

export async function createOrganizationInvitation(input: {
  createdByUserId: string;
  email: string;
  expiresAt?: Date;
  invitedTeamRole: InvitedTeamRole;
  organizationId: string;
  teamId: string | null;
}): Promise<{ invitation: OrganizationInvitationRow; rawToken: string }> {
  const [team, org] = await Promise.all([
    input.teamId
      ? findTeamById(input.organizationId, input.teamId)
      : Promise.resolve(null),
    findOrganizationById(input.organizationId),
  ]);
  if (input.teamId && !team) {
    throw new Error('Команда не найдена в этой организации');
  }

  const emailNorm = input.email.trim().toLowerCase();
  const existingUser = await findUserByEmail(emailNorm);
  if (existingUser) {
    const membership = await findOrganizationMembership(input.organizationId, existingUser.id);
    if (membership) {
      throw new Error('Этот email уже состоит в организации');
    }
  }

  const rawToken = generateInvitationRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_INVITE_TTL_MS);

  const invitation = await insertOrganizationInvitation({
    createdByUserId: input.createdByUserId,
    email: emailNorm,
    expiresAt,
    invitedTeamRole: input.invitedTeamRole,
    organizationId: input.organizationId,
    teamId: input.teamId,
    tokenHash,
  });

  /** Токен — base64url без `/`, `?`, `#`; encodeURIComponent не нужен и снижает риск двойного кодирования в почте. */
  const acceptUrl = `${appBaseUrl()}/invite/${rawToken}`;
  scheduleInvitationEmailDelivery({
    acceptUrl,
    organizationName: org?.name ?? 'Организация',
    teamTitle: team?.title ?? null,
    to: invitation.email,
  });

  return { invitation, rawToken };
}

export type InvitationPreview =
  | {
      email: string;
      expiresAt: string;
      ok: true;
      organizationName: string;
      /** null — приглашение только в организацию (без команды). */
      teamTitle: string | null;
    }
  | { ok: false; reason: 'expired' | 'not_found' | 'revoked' | 'used' };

export async function getInvitationPreview(rawToken: string): Promise<InvitationPreview> {
  const tokenHash = hashInvitationToken(rawToken);
  const inv = await findOrganizationInvitationByTokenHash(tokenHash);
  if (!inv) {
    return { ok: false, reason: 'not_found' };
  }
  if (inv.revoked_at) {
    return { ok: false, reason: 'revoked' };
  }
  if (inv.consumed_at) {
    return { ok: false, reason: 'used' };
  }
  if (new Date(inv.expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  const [org, team] = await Promise.all([
    findOrganizationById(inv.organization_id),
    inv.team_id
      ? findTeamById(inv.organization_id, inv.team_id)
      : Promise.resolve(null),
  ]);

  return {
    email: inv.email,
    expiresAt: new Date(inv.expires_at).toISOString(),
    ok: true,
    organizationName: org?.name ?? 'Организация',
    teamTitle: team?.title ?? null,
  };
}

export type AcceptInvitationResult =
  | { message: string; ok: false; status: 400 | 401 | 404 | 409 | 410 }
  | { ok: true; organizationId: string; userId: string };

async function upsertMembershipInTx(
  client: PoolClient,
  userId: string,
  organizationId: string,
  teamId: string | null,
  role: InvitedTeamRole,
  invitationEmailNorm: string
): Promise<void> {
  const membership = await client.query(
    qualifyBeerTrackerTables(
      `SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2`
    ),
    [organizationId, userId]
  );
  if (membership.rows.length === 0) {
    await client.query(
      qualifyBeerTrackerTables(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'member')`
      ),
      [organizationId, userId]
    );
  }

  if (!teamId) {
    await resolveOrCreateStaffIdForInvitationEmailInTx(
      client,
      organizationId,
      invitationEmailNorm
    );
    return;
  }

  const { isTeamLead, isTeamMember } = inviteRoleToFlags(role);
  await client.query(
    qualifyBeerTrackerTables(
      `INSERT INTO user_team_memberships (user_id, team_id, is_team_lead, is_team_member)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, team_id) DO UPDATE SET
         is_team_lead = user_team_memberships.is_team_lead OR EXCLUDED.is_team_lead,
         is_team_member = user_team_memberships.is_team_member OR EXCLUDED.is_team_member`
    ),
    [userId, teamId, isTeamLead, isTeamMember]
  );

  await ensureStaffAndTeamMemberForInviteInTx(client, organizationId, teamId, invitationEmailNorm);
}

export async function acceptOrganizationInvitation(
  rawToken: string,
  password: string
): Promise<AcceptInvitationResult> {
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { message: 'Пароль не короче 8 символов', ok: false, status: 400 };
  }

  const tokenHash = hashInvitationToken(rawToken);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lockRes = await client.query<OrganizationInvitationRow>(
      qualifyBeerTrackerTables(
        `SELECT id, organization_id, team_id, email, invited_team_role, token_hash,
                expires_at, consumed_at, revoked_at, created_by_user_id, created_at
         FROM organization_invitations
         WHERE token_hash = $1
         FOR UPDATE`
      ),
      [tokenHash]
    );
    const inv = lockRes.rows[0];
    if (!inv) {
      await client.query('ROLLBACK');
      return { message: 'Приглашение не найдено', ok: false, status: 404 };
    }
    if (inv.revoked_at) {
      await client.query('ROLLBACK');
      return { message: 'Приглашение отозвано', ok: false, status: 410 };
    }
    if (inv.consumed_at) {
      await client.query('ROLLBACK');
      return { message: 'Ссылка уже использована', ok: false, status: 410 };
    }
    if (new Date(inv.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return { message: 'Срок действия ссылки истёк', ok: false, status: 410 };
    }

    const emailNorm = inv.email.trim().toLowerCase();
    const existing = await findUserByEmail(emailNorm);

    let userId: string;

    if (existing) {
      if (!existing.password_hash || !verifyPassword(trimmed, existing.password_hash)) {
        await client.query('ROLLBACK');
        return {
          message: 'Неверный пароль. Войдите с учётной записью этого email или укажите верный пароль.',
          ok: false,
          status: 401,
        };
      }
      userId = existing.id;
      const orgs = await listUserOrganizations(userId);
      if (orgs.some((o) => o.organization_id !== inv.organization_id)) {
        await client.query('ROLLBACK');
        return {
          message: 'У вас уже есть другая организация. Принять приглашение нельзя.',
          ok: false,
          status: 409,
        };
      }
    } else {
      const hash = hashPassword(trimmed);
      const ins = await client.query<{ id: string }>(
        qualifyBeerTrackerTables(
          `INSERT INTO users (email, password_hash)
           VALUES (LOWER(TRIM($1)), $2)
           RETURNING id`
        ),
        [emailNorm, hash]
      );
      const row = ins.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { message: 'Не удалось создать пользователя', ok: false, status: 400 };
      }
      userId = row.id;
    }

    await upsertMembershipInTx(
      client,
      userId,
      inv.organization_id,
      inv.team_id,
      inv.invited_team_role,
      emailNorm
    );

    const consumed = await client.query(
      qualifyBeerTrackerTables(
        `UPDATE organization_invitations
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND consumed_at IS NULL`
      ),
      [inv.id]
    );
    if ((consumed.rowCount ?? 0) < 1) {
      await client.query('ROLLBACK');
      return { message: 'Не удалось завершить приглашение', ok: false, status: 409 };
    }

    await client.query('COMMIT');
    return { ok: true, organizationId: inv.organization_id, userId };
  } catch (err) {
    await client.query('ROLLBACK');
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === '23505') {
      return {
        message: 'Конфликт данных (возможно, учётная запись уже в организации).',
        ok: false,
        status: 409,
      };
    }
    console.error('[acceptOrganizationInvitation]', err);
    return { message: 'Внутренняя ошибка', ok: false, status: 400 };
  } finally {
    client.release();
  }
}
