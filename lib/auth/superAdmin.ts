import { query } from '@/lib/db';

/**
 * Супер-админ продукта: обход членства в organization_members для tenant и админки.
 */
export async function isProductSuperAdmin(userId: string): Promise<boolean> {
  const res = await query<{ is_super_admin: boolean }>(
    `SELECT is_super_admin FROM users WHERE id = $1`,
    [userId]
  );
  return Boolean(res.rows[0]?.is_super_admin);
}
