import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { query } from '@/lib/db';

function parseDateOnly(value: string): Date | null {
  // ожидаем YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // проверим, что дата не "перепрыгнула" (например 2026-02-31)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function toIsoDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  // pg может вернуть "2026-04-01" или "2026-04-01T00:00:00.000Z"
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * GET /api/quarterly-plans/availability/vacations?boardId=&memberId=
 * Список отпусков участника (независимо от квартального плана).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardIdParam = searchParams.get('boardId');
    const memberId = searchParams.get('memberId');

    if (!boardIdParam) {
      return NextResponse.json(
        { error: 'boardId обязателен' },
        { status: 400 }
      );
    }

    const boardId = Number(boardIdParam);
    if (Number.isNaN(boardId)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const result = memberId
      ? await query(
          `SELECT id, board_id, member_id, member_name, start_date, end_date
           FROM vacations
           WHERE board_id = $1 AND member_id = $2
           ORDER BY start_date ASC, end_date ASC`,
          [boardId, memberId]
        )
      : await query(
          `SELECT id, board_id, member_id, member_name, start_date, end_date
           FROM vacations
           WHERE board_id = $1
           ORDER BY member_name ASC, start_date ASC, end_date ASC`,
          [boardId]
        );

    const vacations = result.rows.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      startDate: toIsoDateOnly(row.start_date),
      endDate: toIsoDateOnly(row.end_date),
    }));

    return NextResponse.json({ vacations });
  } catch (error) {
    return handleApiError(error, 'Failed to get vacations');
  }
}

/**
 * POST /api/quarterly-plans/availability/vacations
 * Body: { boardId, memberId, memberName, startDate, endDate }
 * Добавить отпуск участнику.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, memberId, memberName, startDate, endDate } = body ?? {};

    if (!boardId || !memberId || !memberName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'boardId, memberId, memberName, startDate, endDate обязательны' },
        { status: 400 }
      );
    }

    const boardIdNum = Number(boardId);
    if (Number.isNaN(boardIdNum)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const start = parseDateOnly(String(startDate));
    const end = parseDateOnly(String(endDate));
    if (!start || !end) {
      return NextResponse.json({ error: 'Некорректный формат даты (ожидается YYYY-MM-DD)' }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json({ error: 'endDate должна быть >= startDate' }, { status: 400 });
    }

    const insertResult = await query(
      `INSERT INTO vacations (board_id, member_id, member_name, start_date, end_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, board_id, member_id, member_name, start_date, end_date`,
      [boardIdNum, memberId, memberName, String(startDate), String(endDate)]
    );

    const row = insertResult.rows[0];
    return NextResponse.json({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      startDate: toIsoDateOnly(row.start_date),
      endDate: toIsoDateOnly(row.end_date),
    });
  } catch (error) {
    return handleApiError(error, 'Failed to create vacation');
  }
}

/**
 * PATCH /api/quarterly-plans/availability/vacations
 * Body: { id, boardId, memberId, memberName, startDate, endDate }
 * Обновить отпуск.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, boardId, memberId, memberName, startDate, endDate } = body ?? {};

    if (!id || !boardId || !memberId || !memberName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'id, boardId, memberId, memberName, startDate, endDate обязательны' },
        { status: 400 }
      );
    }

    const boardIdNum = Number(boardId);
    if (Number.isNaN(boardIdNum)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const start = parseDateOnly(String(startDate));
    const end = parseDateOnly(String(endDate));
    if (!start || !end) {
      return NextResponse.json({ error: 'Некорректный формат даты (ожидается YYYY-MM-DD)' }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json({ error: 'endDate должна быть >= startDate' }, { status: 400 });
    }

    const updateResult = await query(
      `UPDATE vacations
       SET member_name = $1, start_date = $2, end_date = $3, updated_at = NOW()
       WHERE id = $4 AND board_id = $5 AND member_id = $6
       RETURNING id, member_id, member_name, start_date, end_date`,
      [memberName, String(startDate), String(endDate), id, boardIdNum, memberId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Отпуск не найден' }, { status: 404 });
    }

    const row = updateResult.rows[0];
    return NextResponse.json({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      startDate: toIsoDateOnly(row.start_date),
      endDate: toIsoDateOnly(row.end_date),
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update vacation');
  }
}

/**
 * DELETE /api/quarterly-plans/availability/vacations?id=...&boardId=...&memberId=...
 * Удалить отпуск.
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const boardIdParam = searchParams.get('boardId');
    const memberId = searchParams.get('memberId');

    if (!id || !boardIdParam || !memberId) {
      return NextResponse.json(
        { error: 'id, boardId и memberId обязательны' },
        { status: 400 }
      );
    }

    const boardId = Number(boardIdParam);
    if (Number.isNaN(boardId)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const del = await query(
      `DELETE FROM vacations WHERE id = $1 AND board_id = $2 AND member_id = $3`,
      [id, boardId, memberId]
    );

    return NextResponse.json({ success: true, deleted: del.rowCount ?? 0 });
  } catch (error) {
    return handleApiError(error, 'Failed to delete vacation');
  }
}

