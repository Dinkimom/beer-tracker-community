-- Независимая таблица отпусков (без привязки к квартальному плану),
-- чтобы отпуск мог пересекать границы кварталов.

CREATE TABLE IF NOT EXISTS beer_tracker.vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vacations_board ON beer_tracker.vacations(board_id);
CREATE INDEX IF NOT EXISTS idx_vacations_member ON beer_tracker.vacations(member_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON beer_tracker.vacations(start_date, end_date);

COMMENT ON TABLE beer_tracker.vacations IS 'Отпуска участников команды (независимо от квартального плана)';

