-- Роль organization_members.team_lead (тимлид организации без прав админа).

SET search_path TO beer_tracker;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('org_admin', 'member', 'team_lead'));
