-- Кеш changelog + комментариев на задачу (одна строка на organization_id + issue_key).

DROP INDEX IF EXISTS beer_tracker.idx_changelog_org_issue_time;

DROP TABLE IF EXISTS beer_tracker.issue_changelog_events;

CREATE TABLE beer_tracker.issue_changelog_events (
    organization_id UUID NOT NULL REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE,
    issue_key TEXT NOT NULL,
    changelog JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, issue_key)
);

CREATE INDEX idx_issue_changelog_org_synced ON beer_tracker.issue_changelog_events (organization_id, synced_at DESC);

COMMENT ON TABLE beer_tracker.issue_changelog_events IS 'Кеш ответа Tracker: changelog + comments по задаче (синк и API)';
