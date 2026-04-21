-- Супер-админ продукта: доступ ко всем организациям в админке (флаг на users, не в organization_members).

SET search_path TO beer_tracker;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_super_admin IS 'Полный доступ в админке ко всем организациям; выбор org через cookie';
