import { NextRequest, NextResponse } from 'next/server';

import { pool, qualifyBeerTrackerTables, query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * GET /api/stories/[storyKey]/task-positions
 * Получить все позиции задач для стори
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> | { storyKey: string } }
) {
  try {
    const { storyKey } = await resolveParams(params);

    const result = await query(
      `SELECT 
        task_key as "taskKey",
        position_x as "positionX",
        position_y as "positionY"
      FROM story_task_positions
      WHERE story_key = $1`,
      [storyKey]
    );

    return NextResponse.json({ positions: result.rows });
  } catch (error) {
    console.error('[GET /task-positions] Error fetching task positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task positions' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stories/[storyKey]/task-positions
 * Обновить позиции задач для стори
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> | { storyKey: string } }
) {
  try {
    const { storyKey } = await resolveParams(params);
    const body = await request.json();

    if (!Array.isArray(body.positions)) {
      console.error('[PUT /task-positions] Invalid body:', { body });
      return NextResponse.json(
        { error: 'positions must be an array' },
        { status: 400 }
      );
    }

    // Используем транзакцию для атомарного обновления
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Удаляем старые позиции
      await client.query(
        qualifyBeerTrackerTables('DELETE FROM story_task_positions WHERE story_key = $1'),
        [storyKey]
      );

      // Вставляем новые позиции (округляем до целых чисел)
      let insertedCount = 0;
      for (const pos of body.positions) {
        if (pos.taskKey && typeof pos.positionX === 'number' && typeof pos.positionY === 'number') {
          await client.query(
            qualifyBeerTrackerTables(`INSERT INTO story_task_positions (story_key, task_key, position_x, position_y)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (story_key, task_key) 
             DO UPDATE SET position_x = $3, position_y = $4, updated_at = CURRENT_TIMESTAMP`),
            [storyKey, pos.taskKey, Math.round(pos.positionX), Math.round(pos.positionY)]
          );
          insertedCount++;
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({ success: true, insertedCount });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PUT /task-positions] Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[PUT /task-positions] Error updating task positions:', error);
    return NextResponse.json(
      { error: 'Failed to update task positions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

