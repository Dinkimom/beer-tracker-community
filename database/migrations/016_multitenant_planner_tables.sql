-- Tenant isolation for planner tables
-- Adds organization_id and updates keys/constraints to avoid cross-org collisions.

SET search_path TO beer_tracker;

ALTER TABLE beer_tracker.task_positions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

ALTER TABLE beer_tracker.task_position_segments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

ALTER TABLE beer_tracker.task_links
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

ALTER TABLE beer_tracker.comments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

ALTER TABLE beer_tracker.sprint_goals
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

ALTER TABLE beer_tracker.occupancy_task_order
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE;

DO $$
DECLARE
  default_org UUID;
BEGIN
  SELECT id INTO default_org
  FROM beer_tracker.organizations
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF default_org IS NOT NULL THEN
    UPDATE beer_tracker.task_positions SET organization_id = default_org WHERE organization_id IS NULL;
    UPDATE beer_tracker.task_position_segments SET organization_id = default_org WHERE organization_id IS NULL;
    UPDATE beer_tracker.task_links SET organization_id = default_org WHERE organization_id IS NULL;
    UPDATE beer_tracker.comments SET organization_id = default_org WHERE organization_id IS NULL;
    UPDATE beer_tracker.sprint_goals SET organization_id = default_org WHERE organization_id IS NULL;
    UPDATE beer_tracker.occupancy_task_order SET organization_id = default_org WHERE organization_id IS NULL;
  END IF;
END $$;

ALTER TABLE beer_tracker.task_positions
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE beer_tracker.task_position_segments
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE beer_tracker.task_links
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE beer_tracker.comments
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE beer_tracker.sprint_goals
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE beer_tracker.occupancy_task_order
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE beer_tracker.task_position_segments
  DROP CONSTRAINT IF EXISTS fk_task_position;
ALTER TABLE beer_tracker.task_positions
  DROP CONSTRAINT IF EXISTS task_positions_pkey;
ALTER TABLE beer_tracker.task_position_segments
  DROP CONSTRAINT IF EXISTS task_position_segments_pkey;
ALTER TABLE beer_tracker.task_links
  DROP CONSTRAINT IF EXISTS unique_link;
ALTER TABLE beer_tracker.occupancy_task_order
  DROP CONSTRAINT IF EXISTS occupancy_task_order_pkey;

ALTER TABLE beer_tracker.task_positions
  ADD CONSTRAINT task_positions_pkey PRIMARY KEY (organization_id, sprint_id, task_id);

ALTER TABLE beer_tracker.task_position_segments
  ADD CONSTRAINT task_position_segments_pkey PRIMARY KEY (organization_id, sprint_id, task_id, segment_index);

ALTER TABLE beer_tracker.task_position_segments
  ADD CONSTRAINT fk_task_position
    FOREIGN KEY (organization_id, sprint_id, task_id)
    REFERENCES beer_tracker.task_positions(organization_id, sprint_id, task_id)
    ON DELETE CASCADE;

ALTER TABLE beer_tracker.task_links
  ADD CONSTRAINT unique_link UNIQUE (organization_id, sprint_id, from_task_id, to_task_id);

ALTER TABLE beer_tracker.occupancy_task_order
  ADD CONSTRAINT occupancy_task_order_pkey PRIMARY KEY (organization_id, sprint_id);

CREATE INDEX IF NOT EXISTS idx_task_positions_org_sprint
  ON beer_tracker.task_positions (organization_id, sprint_id);
CREATE INDEX IF NOT EXISTS idx_task_position_segments_position
  ON beer_tracker.task_position_segments (organization_id, sprint_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_org_sprint
  ON beer_tracker.task_links (organization_id, sprint_id);
CREATE INDEX IF NOT EXISTS idx_comments_org_sprint
  ON beer_tracker.comments (organization_id, sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_goals_org_sprint
  ON beer_tracker.sprint_goals (organization_id, sprint_id);
