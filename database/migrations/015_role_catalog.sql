-- Глобальный справочник системных ролей и пользовательские роли организации (каталог ролей Phase 2).

CREATE TABLE IF NOT EXISTS beer_tracker.system_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    domain_role TEXT NOT NULL DEFAULT 'other',
    platforms JSONB NOT NULL DEFAULT '[]',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_system_roles_slug UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_system_roles_sort ON beer_tracker.system_roles (sort_order);

CREATE TRIGGER update_system_roles_updated_at
    BEFORE UPDATE ON beer_tracker.system_roles
    FOR EACH ROW EXECUTE FUNCTION beer_tracker.update_updated_at_column();

COMMENT ON TABLE beer_tracker.system_roles IS 'Глобальные системные роли (сид в миграции); не удалять через org_admin UI';

INSERT INTO beer_tracker.system_roles (slug, title, domain_role, platforms, sort_order) VALUES
    ('frontend', 'Фронтенд', 'developer', '["web"]', 10),
    ('backend', 'Бэкенд', 'developer', '["back"]', 20),
    ('qa', 'QA', 'tester', '[]', 30),
    ('teamlead', 'Тимлид', 'developer', '["web","back"]', 40)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS beer_tracker.org_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES beer_tracker.organizations (id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    domain_role TEXT NOT NULL DEFAULT 'other',
    platforms JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_org ON beer_tracker.org_roles (organization_id);

CREATE TRIGGER update_org_roles_updated_at
    BEFORE UPDATE ON beer_tracker.org_roles
    FOR EACH ROW EXECUTE FUNCTION beer_tracker.update_updated_at_column();

COMMENT ON TABLE beer_tracker.org_roles IS 'Пользовательские роли организации';
