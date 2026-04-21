import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { query } from '@/lib/db';

/**
 * GET /api/quarterly-plans/participants?boardId=X&year=Y&quarter=Z
 * Получить участников квартального плана
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');
    const year = searchParams.get('year');
    const quarter = searchParams.get('quarter');

    if (!boardId || !year || !quarter) {
      return NextResponse.json(
        { error: 'boardId, year и quarter обязательны' },
        { status: 400 }
      );
    }

    const planResult = await query(
      `SELECT id FROM quarterly_plans 
       WHERE board_id = $1 AND year = $2 AND quarter = $3`,
      [boardId, year, quarter]
    );

    if (planResult.rows.length === 0) {
      return NextResponse.json({ participants: [] });
    }

    const planId = planResult.rows[0].id;

    const participantsResult = await query(
      `SELECT * FROM quarterly_plan_participants 
       WHERE plan_id = $1 
       ORDER BY member_name`,
      [planId]
    );

    const participants = participantsResult.rows.map(row => {
      let platforms = row.platforms || [];
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms);
        } catch {
          platforms = [];
        }
      }

      return {
        id: row.id,
        memberId: row.member_id,
        memberName: row.member_name,
        role: row.role,
        platforms: platforms || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ participants });
  } catch (error) {
    return handleApiError(error, 'Failed to get quarterly plan participants');
  }
}

/**
 * POST /api/quarterly-plans/participants
 * Добавить участника в квартальный план
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, year, quarter, memberId, memberName, role, platforms } = body;

    if (!boardId || !year || !quarter || !memberId || !memberName) {
      return NextResponse.json(
        { error: 'boardId, year, quarter, memberId и memberName обязательны' },
        { status: 400 }
      );
    }

    const planResult = await query(
      `SELECT id FROM quarterly_plans 
       WHERE board_id = $1 AND year = $2 AND quarter = $3`,
      [boardId, year, quarter]
    );

    let planId: string;
    if (planResult.rows.length === 0) {
      const createResult = await query(
        `INSERT INTO quarterly_plans (board_id, year, quarter) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [boardId, year, quarter]
      );
      planId = createResult.rows[0].id;
    } else {
      planId = planResult.rows[0].id;
    }

    const result = await query(
      `INSERT INTO quarterly_plan_participants 
       (plan_id, member_id, member_name, role, platforms) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (plan_id, member_id) 
       DO UPDATE SET 
         member_name = EXCLUDED.member_name,
         role = EXCLUDED.role,
         platforms = EXCLUDED.platforms,
         updated_at = NOW()
       RETURNING *`,
      [
        planId,
        memberId,
        memberName,
        role || 'developer',
        JSON.stringify(platforms || []),
      ]
    );

    const participant = result.rows[0];
    let platformsArray = participant.platforms || [];
    if (typeof platformsArray === 'string') {
      try {
        platformsArray = JSON.parse(platformsArray);
      } catch {
        platformsArray = [];
      }
    }

    return NextResponse.json({
      id: participant.id,
      memberId: participant.member_id,
      memberName: participant.member_name,
      role: participant.role,
      platforms: platformsArray,
      createdAt: participant.created_at,
      updatedAt: participant.updated_at,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to add quarterly plan participant');
  }
}

/**
 * DELETE /api/quarterly-plans/participants?id=UUID
 * Удалить участника из квартального плана
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id обязателен' },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM quarterly_plan_participants WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to delete quarterly plan participant');
  }
}
