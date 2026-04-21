/**
 * Подключение к PostgreSQL для сущностей beer-tracker.
 * Параметры — `POSTGRES_*` / `PG*` (`getPostgresConfig`). В SQL — схема `beer_tracker.*`.
 */

import type { QueryParams } from '@/types';

import { type QueryResult, type QueryResultRow, Pool } from 'pg';

import { getBeerTrackerSchema, getPostgresConfig } from './env';

const config = getPostgresConfig();

function createPool() {
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_TIMEOUT || '30000', 10),
    statement_timeout: 10_000,
    // В окружениях с pgbouncer (transaction pooling) prepared statements могут ломаться:
    // `prepared statement "... " does not exist`. Simple protocol избегает этого класса ошибок.
    queryMode: 'simple' as unknown as never,
  } as never);
}

// В режиме разработки Next.js HMR переоценивает модули при каждом hot-reload,
// создавая новые экземпляры Pool без закрытия старых → исчерпание max_connections.
// Глобальный синглтон решает эту проблему.
const globalForPool = globalThis as typeof globalThis & { __beerTrackerPool?: Pool };
const pool: Pool = globalForPool.__beerTrackerPool ?? createPool();
if (process.env.NODE_ENV !== 'production') {
  globalForPool.__beerTrackerPool = pool;
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const BEER_TRACKER_TABLES = [
  'comments',
  'issue_changelog_events',
  'issue_snapshots',
  'occupancy_task_order',
  'organization_invitations',
  'organization_members',
  'organization_secrets',
  'organizations',
  'org_roles',
  'planned_items',
  'quarterly_plan_participants',
  'quarterly_plan_v2_epics',
  'quarterly_plan_v2_story_phases',
  'quarterly_plans',
  'sprint_goals',
  'staff',
  'system_roles',
  'sync_runs',
  'task_links',
  'task_position_segments',
  'task_positions',
  'team_members',
  'teams',
  'user_team_memberships',
  'users',
  'vacations',
] as const;

function schemaQualified(): string {
  const s = getBeerTrackerSchema();
  return s.includes('-') ? `"${s}"` : s;
}

/** Подставляет схему перед таблицами beer_tracker (для использования в query и при ручном `pool.connect`). */
export function qualifyBeerTrackerTables(sql: string): string {
  const schema = schemaQualified();
  let out = sql;
  for (const table of BEER_TRACKER_TABLES) {
    out = out.replace(new RegExp(`\\b(FROM|INTO|UPDATE|JOIN)\\s+${table}\\b`, 'gi'), `$1 ${schema}.${table}`);
  }
  return out;
}

export { pool };

/** T — тип строки результата; по умолчанию any, чтобы существующие маршруты не ломали вывод типов. */
export async function query<T extends QueryResultRow = any>( // eslint-disable-line @typescript-eslint/no-explicit-any -- см. комментарий выше
  text: string,
  params?: QueryParams
): Promise<QueryResult<T>> {
  return await pool.query<T>(qualifyBeerTrackerTables(text), params);
}
