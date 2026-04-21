/**
 * Приглашения в команду (organization_invitations). Полный accept-flow — в отдельных задачах.
 */

import { query } from '@/lib/db';

export type InvitedTeamRole = 'team_lead' | 'team_member';

export interface OrganizationInvitationRow {
  consumed_at: Date | null;
  created_at: Date;
  created_by_user_id: string | null;
  email: string;
  expires_at: Date;
  id: string;
  invited_team_role: InvitedTeamRole;
  organization_id: string;
  revoked_at: Date | null;
  team_id: string | null;
  token_hash: string;
}

export async function insertOrganizationInvitation(input: {
  createdByUserId: string | null;
  email: string;
  expiresAt: Date;
  invitedTeamRole: InvitedTeamRole;
  organizationId: string;
  teamId: string | null;
  tokenHash: string;
}): Promise<OrganizationInvitationRow> {
  const res = await query<OrganizationInvitationRow>(
    `INSERT INTO organization_invitations (
       organization_id, team_id, email, invited_team_role, token_hash, expires_at, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, organization_id, team_id, email, invited_team_role, token_hash,
       expires_at, consumed_at, revoked_at, created_by_user_id, created_at`,
    [
      input.organizationId,
      input.teamId,
      input.email.trim().toLowerCase(),
      input.invitedTeamRole,
      input.tokenHash,
      input.expiresAt,
      input.createdByUserId,
    ]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('insertOrganizationInvitation: no row returned');
  }
  return row;
}

export async function findOrganizationInvitationByTokenHash(
  tokenHash: string
): Promise<OrganizationInvitationRow | null> {
  const res = await query<OrganizationInvitationRow>(
    `SELECT id, organization_id, team_id, email, invited_team_role, token_hash,
            expires_at, consumed_at, revoked_at, created_by_user_id, created_at
     FROM organization_invitations
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return res.rows[0] ?? null;
}

export async function listPendingOrganizationInvitations(
  organizationId: string
): Promise<OrganizationInvitationRow[]> {
  const res = await query<OrganizationInvitationRow>(
    `SELECT id, organization_id, team_id, email, invited_team_role, token_hash,
            expires_at, consumed_at, revoked_at, created_by_user_id, created_at
     FROM organization_invitations
     WHERE organization_id = $1
       AND consumed_at IS NULL
       AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return res.rows;
}

/** Активные приглашения без строки organization_members с тем же email (ещё не приняли приглашение). */
export interface PendingInvitationDirectoryRow {
  created_at: Date;
  email: string;
  expires_at: Date;
  id: string;
  invited_team_role: InvitedTeamRole;
  team_id: string | null;
  team_title: string | null;
}

export async function listPendingInvitationsWithoutOrgMembership(
  organizationId: string
): Promise<PendingInvitationDirectoryRow[]> {
  const res = await query<PendingInvitationDirectoryRow>(
    `SELECT oi.id, oi.email, oi.invited_team_role, oi.expires_at, oi.created_at,
            oi.team_id, t.title AS team_title
     FROM organization_invitations oi
     LEFT JOIN teams t ON t.id = oi.team_id AND t.organization_id = oi.organization_id
     WHERE oi.organization_id = $1
       AND oi.consumed_at IS NULL
       AND oi.revoked_at IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM organization_members om
         INNER JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = oi.organization_id
           AND u.email = oi.email
       )
     ORDER BY oi.created_at DESC`,
    [organizationId]
  );
  return res.rows;
}

export async function findPendingOrganizationInvitationInOrg(
  invitationId: string,
  organizationId: string
): Promise<OrganizationInvitationRow | null> {
  const res = await query<OrganizationInvitationRow>(
    `SELECT id, organization_id, team_id, email, invited_team_role, token_hash,
            expires_at, consumed_at, revoked_at, created_by_user_id, created_at
     FROM organization_invitations
     WHERE id = $1 AND organization_id = $2
       AND consumed_at IS NULL
       AND revoked_at IS NULL`,
    [invitationId, organizationId]
  );
  return res.rows[0] ?? null;
}

export async function revokeOrganizationInvitation(
  invitationId: string,
  organizationId: string
): Promise<boolean> {
  const res = await query(
    `UPDATE organization_invitations
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL AND consumed_at IS NULL`,
    [invitationId, organizationId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markOrganizationInvitationConsumed(invitationId: string): Promise<boolean> {
  const res = await query(
    `UPDATE organization_invitations
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND consumed_at IS NULL`,
    [invitationId]
  );
  return (res.rowCount ?? 0) > 0;
}
