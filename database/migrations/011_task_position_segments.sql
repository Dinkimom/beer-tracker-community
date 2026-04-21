-- Отрезки фазы занятости (дробление одной фазы на несколько непересекающихся отрезков)
-- Запуск: psql -U ... -d windmill-integrations -f database/migrations/011_task_position_segments.sql

SET search_path TO beer_tracker;

CREATE TABLE IF NOT EXISTS beer_tracker.task_position_segments (
    sprint_id INTEGER NOT NULL,
    task_id VARCHAR(255) NOT NULL,
    segment_index INTEGER NOT NULL CHECK (segment_index >= 0),
    start_day INTEGER NOT NULL CHECK (start_day >= 0 AND start_day < 10),
    start_part INTEGER NOT NULL CHECK (start_part >= 0 AND start_part < 3),
    duration INTEGER NOT NULL CHECK (duration > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sprint_id, task_id, segment_index),
    CONSTRAINT fk_task_position
        FOREIGN KEY (sprint_id, task_id)
        REFERENCES beer_tracker.task_positions(sprint_id, task_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_task_position_segments_position
    ON beer_tracker.task_position_segments(sprint_id, task_id);

COMMENT ON TABLE beer_tracker.task_position_segments IS 'Отрезки фазы занятости (дробление плановой фазы на несколько отрезков)';
