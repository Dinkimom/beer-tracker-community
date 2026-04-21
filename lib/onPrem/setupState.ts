import { query } from '@/lib/db';

export interface OnPremSetupState {
  hasOrganizations: boolean;
  hasUsers: boolean;
  /**
   * Есть хотя бы одна учётная запись продукта (`users`).
   * Не путать с «в БД есть строка organizations»: без пользователя онбординг админа ещё не завершён.
   */
  initialized: boolean;
}

interface SetupStateRow {
  has_organizations: boolean;
  has_users: boolean;
}

export async function readOnPremSetupState(): Promise<OnPremSetupState> {
  const res = await query<SetupStateRow>(
    `SELECT
       EXISTS(SELECT 1 FROM organizations) AS has_organizations,
       EXISTS(SELECT 1 FROM users) AS has_users`
  );
  const row = res.rows[0];
  const hasOrganizations = Boolean(row?.has_organizations);
  const hasUsers = Boolean(row?.has_users);
  return {
    hasOrganizations,
    hasUsers,
    initialized: hasUsers,
  };
}
