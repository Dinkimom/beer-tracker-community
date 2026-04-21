import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> | { storyKey: string } }
) {
  try {
    const { storyKey } = await resolveParams(params);

    if (!storyKey) {
      return NextResponse.json(
        { error: 'storyKey is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT 
        id,
        from_task_id,
        to_task_id,
        created_at
      FROM story_task_links 
      WHERE story_key = $1
      ORDER BY created_at`,
      [storyKey]
    );

    return NextResponse.json({ links: result.rows });
  } catch (error) {
    console.error('Error fetching story task links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story task links' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> | { storyKey: string } }
) {
  try {
    const { storyKey } = await resolveParams(params);
    const body = await request.json();

    if (!storyKey) {
      return NextResponse.json(
        { error: 'storyKey is required' },
        { status: 400 }
      );
    }

    const { fromTaskId, toTaskId, id } = body;

    if (!fromTaskId || !toTaskId) {
      return NextResponse.json(
        { error: 'fromTaskId and toTaskId are required' },
        { status: 400 }
      );
    }

    if (fromTaskId === toTaskId) {
      return NextResponse.json(
        { error: 'Cannot link task to itself' },
        { status: 400 }
      );
    }

    // Если передан id, используем его, иначе генерируем новый
    const linkId = id || `link-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const result = await query(
      `INSERT INTO story_task_links (id, story_key, from_task_id, to_task_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (story_key, from_task_id, to_task_id) 
      DO NOTHING
      RETURNING *`,
      [linkId, storyKey, fromTaskId, toTaskId]
    );

    if (result.rows.length === 0) {
      // Связь уже существует
      return NextResponse.json(
        { error: 'Link already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json({ link: result.rows[0] });
  } catch (error) {
    console.error('Error saving story task link:', error);
    return NextResponse.json(
      { error: 'Failed to save story task link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storyKey: string }> | { storyKey: string } }
) {
  try {
    const { storyKey } = await resolveParams(params);
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');
    const fromTaskId = searchParams.get('fromTaskId');
    const toTaskId = searchParams.get('toTaskId');

    if (!storyKey) {
      return NextResponse.json(
        { error: 'storyKey is required' },
        { status: 400 }
      );
    }

    if (linkId) {
      // Удаляем по ID связи
      await query(
        'DELETE FROM story_task_links WHERE story_key = $1 AND id = $2',
        [storyKey, linkId]
      );
    } else if (fromTaskId && toTaskId) {
      // Удаляем по fromTaskId и toTaskId
      await query(
        'DELETE FROM story_task_links WHERE story_key = $1 AND from_task_id = $2 AND to_task_id = $3',
        [storyKey, fromTaskId, toTaskId]
      );
    } else {
      return NextResponse.json(
        { error: 'linkId or (fromTaskId and toTaskId) is required' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting story task link:', error);
    return NextResponse.json(
      { error: 'Failed to delete story task link' },
      { status: 500 }
    );
  }
}
