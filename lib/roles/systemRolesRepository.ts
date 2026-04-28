/**
 * Чтение "системных" ролей из external master-контракта:
 * overseer.staff_roles + overseer.roles.
 */

import type { DomainRole, Platform } from '@/lib/roles/catalog';

import { query } from '@/lib/db';

export interface SystemRoleRow {
  created_at: Date;
  domain_role: DomainRole;
  id: string;
  platforms: Platform[];
  slug: string;
  sort_order: number;
  title: string;
  updated_at: Date;
}

function parseDomainRole(value: string): DomainRole {
  if (value === 'developer' || value === 'tester' || value === 'other') return value;
  return 'other';
}

function inferDomainRole(slug: string, title: string): DomainRole {
  const text = `${slug} ${title}`.toLowerCase();
  if (text.includes('qa') || text.includes('test') || text.includes('тест')) {
    return 'tester';
  }
  if (
    text.includes('dev') ||
    text.includes('backend') ||
    text.includes('frontend') ||
    text.includes('front') ||
    text.includes('teamlead') ||
    text.includes('lead')
  ) {
    return 'developer';
  }
  return 'other';
}

function parsePlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Platform => x === 'back' || x === 'web');
}

function inferPlatforms(slug: string, title: string, domainRole: DomainRole): Platform[] {
  if (domainRole !== 'developer') return [];
  const text = `${slug} ${title}`.toLowerCase();
  if (text.includes('backend') || text.includes('back') || text.includes('бек')) {
    return ['back'];
  }
  if (text.includes('frontend') || text.includes('front') || text.includes('фронт')) {
    return ['web'];
  }
  return ['web', 'back'];
}

function mapRow(r: {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  created_at: Date | null;
  updated_at: Date | null;
}): SystemRoleRow {
  const domainRole = parseDomainRole(inferDomainRole(r.slug, r.title));
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    domain_role: domainRole,
    platforms: parsePlatforms(inferPlatforms(r.slug, r.title, domainRole)),
    sort_order: r.sort_order,
    created_at: r.created_at ?? new Date(0),
    updated_at: r.updated_at ?? new Date(0),
  };
}

/** Все активные роли из overseer.roles. */
export async function listSystemRoles(): Promise<SystemRoleRow[]> {
  const res = await query<{
    id: string;
    slug: string;
    title: string;
    sort_order: number;
    created_at: Date | null;
    updated_at: Date | null;
  }>(
    `SELECT
        r.uid::text AS id,
        COALESCE(NULLIF(TRIM(r.slug), ''), CONCAT('overseer-role-', r.uid::text)) AS slug,
        COALESCE(NULLIF(TRIM(r.title), ''), CONCAT('Role ', r.uid::text)) AS title,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(NULLIF(TRIM(r.title), ''), NULLIF(TRIM(r.slug), ''), r.uid::text)
        )::int AS sort_order,
        NULL::timestamptz AS created_at,
        NULL::timestamptz AS updated_at
     FROM overseer.roles r
     WHERE COALESCE(r.active, TRUE) = TRUE
     ORDER BY sort_order ASC, slug ASC`
  );
  return res.rows.map(mapRow);
}

/** Проверка коллизии slug c ролями из overseer.roles (регистронезависимо). */
export async function systemRoleSlugExists(slug: string): Promise<boolean> {
  const res = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM overseer.roles r
     WHERE COALESCE(r.active, TRUE) = TRUE
       AND lower(COALESCE(NULLIF(TRIM(r.slug), ''), CONCAT('overseer-role-', r.uid::text))) = lower($1)
     LIMIT 1`,
    [slug]
  );
  return res.rows.length > 0;
}
