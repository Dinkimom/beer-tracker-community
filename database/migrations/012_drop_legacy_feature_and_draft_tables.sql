-- Удаление устаревших таблиц, связанных с фичами, документами,
-- сториз-доской, драфт-задачами и техспринтами/отпусками.
-- Запуск: psql -U ... -d windmill-integrations -f database/migrations/012_drop_legacy_feature_and_draft_tables.sql

SET search_path TO beer_tracker;

-- Порядок важен из-за внешних ключей

-- Версии документов зависят от feature_documents
DROP TABLE IF EXISTS beer_tracker.document_versions CASCADE;

-- Таблицы документов и диаграмм фич
DROP TABLE IF EXISTS beer_tracker.feature_grooming_todos CASCADE;
DROP TABLE IF EXISTS beer_tracker.feature_grooming_diagrams CASCADE;
DROP TABLE IF EXISTS beer_tracker.feature_diagrams CASCADE;
DROP TABLE IF EXISTS beer_tracker.feature_documents CASCADE;
DROP TABLE IF EXISTS beer_tracker.features CASCADE;

-- Типы документов
DROP TABLE IF EXISTS beer_tracker.document_types CASCADE;

-- Стори: позиции задач, драфты и связи
DROP TABLE IF EXISTS beer_tracker.story_task_links CASCADE;
DROP TABLE IF EXISTS beer_tracker.story_draft_tasks CASCADE;
DROP TABLE IF EXISTS beer_tracker.story_task_positions CASCADE;

-- Драфт-задачи для квартального планирования
DROP TABLE IF EXISTS beer_tracker.draft_tasks CASCADE;

-- Техспринты и отпуска
DROP TABLE IF EXISTS beer_tracker.tech_sprint_entries CASCADE;
DROP TABLE IF EXISTS beer_tracker.vacation_entries CASCADE;

