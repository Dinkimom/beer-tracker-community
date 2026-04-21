import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';


interface DraftTaskRow {
  created_at: string;
  id: string;
  linked_task_ids: string;
  name: string;
  position_x: number;
  position_y: number;
  story_key: string;
  story_points: number | null;
  tags: string;
  test_points: number | null;
  updated_at: string;
}

// GET /api/stories/[storyKey]/draft-tasks - получить драфт-задачи для стори
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> }
) {
  try {
    const { storyKey } = await params;

    const result = await query(
      `SELECT * FROM story_draft_tasks WHERE story_key = $1 ORDER BY created_at ASC`,
      [storyKey]
    );

    const tasks = result.rows as DraftTaskRow[];

    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      tags: JSON.parse(task.tags || '[]'),
      storyPoints: task.story_points,
      testPoints: task.test_points,
      linkedTaskIds: JSON.parse(task.linked_task_ids || '[]'),
      position: {
        x: task.position_x,
        y: task.position_y,
      },
      isFromTracker: false,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }));

    return NextResponse.json({ tasks: formattedTasks });
  } catch (error) {
    console.error('Failed to fetch draft tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft tasks' },
      { status: 500 }
    );
  }
}

// POST /api/stories/[storyKey]/draft-tasks - создать драфт-задачу
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> }
) {
  try {
    const { storyKey } = await params;
    const body = await request.json();

    const {
      id,
      name = '',
      tags = [],
      storyPoints,
      testPoints,
      linkedTaskIds = [],
      position = { x: 0, y: 0 },
    } = body;

    const taskId = id || crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO story_draft_tasks (id, story_key, name, tags, story_points, test_points, linked_task_ids, position_x, position_y, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        taskId,
        storyKey,
        name,
        JSON.stringify(tags),
        storyPoints ?? null,
        testPoints ?? null,
        JSON.stringify(linkedTaskIds),
        position.x,
        position.y,
        now,
        now,
      ]
    );

    return NextResponse.json({
      task: {
        id: taskId,
        name,
        tags,
        storyPoints,
        testPoints,
        linkedTaskIds,
        position,
        isFromTracker: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('Failed to create draft task:', error);
    return NextResponse.json(
      { error: 'Failed to create draft task' },
      { status: 500 }
    );
  }
}

// PUT /api/stories/[storyKey]/draft-tasks - обновить драфт-задачу
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> }
) {
  try {
    const { storyKey } = await params;
    const body = await request.json();

    const { id, name, tags, storyPoints, testPoints, linkedTaskIds, position } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Собираем поля для обновления
    const updates: string[] = ['updated_at = $1'];
    const values: (number | string | null)[] = [now];
    let paramIndex = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(tags));
    }
    if (storyPoints !== undefined) {
      updates.push(`story_points = $${paramIndex++}`);
      values.push(storyPoints);
    }
    if (testPoints !== undefined) {
      updates.push(`test_points = $${paramIndex++}`);
      values.push(testPoints);
    }
    if (linkedTaskIds !== undefined) {
      updates.push(`linked_task_ids = $${paramIndex++}`);
      values.push(JSON.stringify(linkedTaskIds));
    }
    if (position !== undefined) {
      updates.push(`position_x = $${paramIndex++}`);
      values.push(position.x);
      updates.push(`position_y = $${paramIndex++}`);
      values.push(position.y);
    }

    values.push(id, storyKey);

    await query(
      `UPDATE story_draft_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND story_key = $${paramIndex}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update draft task:', error);
    return NextResponse.json(
      { error: 'Failed to update draft task' },
      { status: 500 }
    );
  }
}

// DELETE /api/stories/[storyKey]/draft-tasks - удалить драфт-задачу
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> }
) {
  try {
    const { storyKey } = await params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await query(
      `DELETE FROM story_draft_tasks WHERE id = $1 AND story_key = $2`,
      [taskId, storyKey]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete draft task:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft task' },
      { status: 500 }
    );
  }
}
