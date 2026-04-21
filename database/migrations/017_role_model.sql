-- Role model: team memberships for product users, invitations, one org per user.

SET search_path TO beer_tracker;

-- Keep a single organization_members row per user (earliest by created_at).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        created_at ASC,
        id ASC
    ) AS rn
  FROM organization_members
)
DELETE FROM organization_members om
USING ranked r
WHERE om.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_members_user_id ON organization_members (user_id);

CREATE TABLE user_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  is_team_lead BOOLEAN NOT NULL DEFAULT false,
  is_team_member BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_team_memberships_lead_or_member CHECK (is_team_lead OR is_team_member),
  UNIQUE (user_id, team_id)
);

CREATE INDEX idx_user_team_memberships_user ON user_team_memberships (user_id);
CREATE INDEX idx_user_team_memberships_team ON user_team_memberships (team_id);

COMMENT ON TABLE user_team_memberships IS 'Права пользователя продукта в команде (ACL); не путать с team_members(staff)';

CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  invited_team_role TEXT NOT NULL CHECK (invited_team_role IN ('team_lead', 'team_member')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_organization_invitations_token_hash ON organization_invitations (token_hash);
CREATE INDEX idx_organization_invitations_org ON organization_invitations (organization_id);
CREATE INDEX idx_organization_invitations_email_org ON organization_invitations (organization_id, email);

COMMENT ON TABLE organization_invitations IS 'Приглашение по email в команду организации; токен только в виде hash';
