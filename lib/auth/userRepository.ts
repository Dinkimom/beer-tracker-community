/**
 * Учётные записи продукта (таблица users).
 */

import { query } from '@/lib/db';

export interface UserRow {
  created_at: Date;
  email: string;
  email_verified_at: Date | null;
  id: string;
  is_super_admin: boolean;
  password_hash: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `SELECT id, email, password_hash, email_verified_at, is_super_admin, created_at
     FROM users
     WHERE email = LOWER(TRIM($1))`,
    [email.trim().toLowerCase()]
  );
  return res.rows[0] ?? null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `SELECT id, email, password_hash, email_verified_at, is_super_admin, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return res.rows[0] ?? null;
}

export async function insertUser(email: string, passwordHash: string): Promise<UserRow> {
  const res = await query<UserRow>(
    `INSERT INTO users (email, password_hash)
     VALUES (LOWER(TRIM($1)), $2)
     RETURNING id, email, password_hash, email_verified_at, is_super_admin, created_at`,
    [email.trim().toLowerCase(), passwordHash]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('insertUser: no row returned');
  }
  return row;
}
