-- Системная организация для /demo/planner (tenant в БД без ручного DEMO_PRODUCT_ORGANIZATION_ID).

SET search_path TO beer_tracker;

INSERT INTO organizations (id, name, slug, tracker_org_id, settings)
VALUES (
    'f0000000-0000-4000-8000-000000000001',
    'Demo (Beer Tracker)',
    '__beer_tracker_system_demo__',
    '',
    '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
