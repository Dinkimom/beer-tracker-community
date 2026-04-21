-- Цели спринта (Delivery и Discovery) в beer_tracker
-- Запуск: psql -U ... -d windmill-integrations -f database/migrations/010_sprint_goals.sql

SET search_path TO beer_tracker;

CREATE TABLE IF NOT EXISTS beer_tracker.sprint_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id INTEGER NOT NULL,
    team TEXT,
    text TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('delivery', 'discovery')),
    done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sprint_goals_sprint ON beer_tracker.sprint_goals(sprint_id);
CREATE INDEX idx_sprint_goals_sprint_type ON beer_tracker.sprint_goals(sprint_id, goal_type);

CREATE TRIGGER update_sprint_goals_updated_at
    BEFORE UPDATE ON beer_tracker.sprint_goals
    FOR EACH ROW EXECUTE FUNCTION beer_tracker.update_updated_at_column();

COMMENT ON TABLE beer_tracker.sprint_goals IS 'Цели спринта (Delivery и Discovery)';
