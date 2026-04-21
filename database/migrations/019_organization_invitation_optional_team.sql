-- Приглашение в организацию без привязки к команде (team_id NULL).

SET search_path TO beer_tracker;

ALTER TABLE organization_invitations
  ALTER COLUMN team_id DROP NOT NULL;

COMMENT ON TABLE organization_invitations IS
  'Приглашение по email в организацию; команда опциональна; токен только в виде hash';
