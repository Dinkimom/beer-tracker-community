import type { DraftTask, PlannedItemType } from '@/types/quarterly';

import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { query } from '@/lib/db';
import { parseTags } from '@/lib/parseTags';

/**
 * GET /api/drafts?boardId=X
 * Получить все драфты для доски
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardIdParam = searchParams.get('boardId');

    if (!boardIdParam) {
      return NextResponse.json(
        { error: 'boardId обязателен' },
        { status: 400 }
      );
    }

    const boardId = parseInt(boardIdParam, 10);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'boardId должен быть числом' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT * FROM draft_tasks 
       WHERE board_id = $1 
       ORDER BY created_at DESC`,
      [boardId]
    );

    const drafts: DraftTask[] = result.rows.map(row => {
      const tags = parseTags(row.tags);

      // Определяем type на основе hierarchy_level, если поле type отсутствует или null
      const hierarchyLevel = row.hierarchy_level ?? 0;
      let draftType: PlannedItemType = row.type as PlannedItemType;
      if (!draftType || draftType === 'draft') {
        // Если type отсутствует или равен 'draft', определяем по hierarchy_level
        if (hierarchyLevel === 0) draftType = 'epic';
        else if (hierarchyLevel === 1) draftType = 'story';
        else if (hierarchyLevel === 2) draftType = 'task';
        else draftType = 'draft';
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        epicId: row.epic_id,
        epicKey: row.epic_key,
        tags,
        storyPoints: row.story_points,
        testPoints: row.test_points,
        boardId: row.board_id,
        hierarchyLevel,
        type: draftType,
        parentId: row.parent_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('[GET /api/drafts] Error:', error);
    return handleApiError(error, 'Failed to get drafts');
  }
}

/**
 * POST /api/drafts
 * Создать новый драфт
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      epicId,
      epicKey,
      tags,
      storyPoints,
      testPoints,
      boardId
    } = body;

    if (!title || !boardId) {
      return NextResponse.json(
        { error: 'title и boardId обязательны' },
        { status: 400 }
      );
    }

    const boardIdNum = typeof boardId === 'string' ? parseInt(boardId, 10) : boardId;
    if (isNaN(boardIdNum)) {
      return NextResponse.json(
        { error: 'boardId должен быть числом' },
        { status: 400 }
      );
    }

    // Определяем hierarchyLevel, type и parentId из body, если они переданы
    const hierarchyLevel = body.hierarchyLevel ?? 0;
    const type = body.type || 'draft';
    const parentId = body.parentId || null;

    // Проверяем, существует ли поле type в таблице
    // Если нет, используем старую схему без type
    let result;
    try {
      result = await query(
        `INSERT INTO draft_tasks (
          id, title, description, epic_id, epic_key, tags,
          story_points, test_points, board_id, hierarchy_level, type, parent_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *`,
        [
          id,
          title,
          description || null,
          epicId || null,
          epicKey || null,
          JSON.stringify(tags || []),
          storyPoints || null,
          testPoints || null,
          boardIdNum,
          hierarchyLevel,
          type,
          parentId,
        ]
      );
    } catch (error: unknown) {
      // Если ошибка связана с отсутствием поля type, пробуем без него
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('column "type"') || errorMessage.includes('does not exist')) {
        console.warn('[POST /api/drafts] Field "type" does not exist, using fallback');
        result = await query(
          `INSERT INTO draft_tasks (
            id, title, description, epic_id, epic_key, tags,
            story_points, test_points, board_id, hierarchy_level, parent_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING *`,
          [
            id,
            title,
            description || null,
            epicId || null,
            epicKey || null,
            JSON.stringify(tags || []),
            storyPoints || null,
            testPoints || null,
            boardIdNum,
            hierarchyLevel,
            parentId,
          ]
        );
      } else {
        throw error;
      }
    }

    const draft = result.rows[0];

    // Определяем type на основе hierarchy_level, если поле type отсутствует
    const draftType = draft.type || (draft.hierarchy_level === 0 ? 'epic' : 'draft');

    return NextResponse.json({
      id: draft.id,
      title: draft.title,
      description: draft.description,
      epicId: draft.epic_id,
      epicKey: draft.epic_key,
      tags: parseTags(draft.tags),
      storyPoints: draft.story_points,
      testPoints: draft.test_points,
      boardId: draft.board_id,
      hierarchyLevel: draft.hierarchy_level ?? 0,
      type: draftType,
      parentId: draft.parent_id,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to create draft');
  }
}

/**
 * PUT /api/drafts
 * Обновить существующий драфт
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      tags,
      storyPoints,
      testPoints,
      boardId,
      type,
      hierarchyLevel,
      parentId,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id обязателен' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'title обязателен' },
        { status: 400 }
      );
    }

    const boardIdNum = typeof boardId === 'string' ? parseInt(boardId, 10) : boardId;
    if (isNaN(boardIdNum)) {
      return NextResponse.json(
        { error: 'boardId должен быть числом' },
        { status: 400 }
      );
    }

    // Определяем hierarchyLevel и type из body, если они переданы
    const finalHierarchyLevel = hierarchyLevel ?? 0;
    const finalType = type || 'draft';
    const finalParentId = parentId || null;

    // Обновляем драфт
    let result;
    try {
      result = await query(
        `UPDATE draft_tasks SET
          title = $1,
          description = $2,
          tags = $3,
          story_points = $4,
          test_points = $5,
          hierarchy_level = $6,
          type = $7,
          parent_id = $8,
          updated_at = NOW()
        WHERE id = $9
        RETURNING *`,
        [
          title,
          description || null,
          JSON.stringify(tags || []),
          storyPoints || null,
          testPoints || null,
          finalHierarchyLevel,
          finalType,
          finalParentId,
          id,
        ]
      );
    } catch (error: unknown) {
      // Если ошибка связана с отсутствием поля type, пробуем без него
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('column "type"') || errorMessage.includes('does not exist')) {
        console.warn('[PUT /api/drafts] Field "type" does not exist, using fallback');
        result = await query(
          `UPDATE draft_tasks SET
            title = $1,
            description = $2,
            tags = $3,
            story_points = $4,
            test_points = $5,
            hierarchy_level = $6,
            parent_id = $7,
            updated_at = NOW()
          WHERE id = $8
          RETURNING *`,
          [
            title,
            description || null,
            JSON.stringify(tags || []),
            storyPoints || null,
            testPoints || null,
            finalHierarchyLevel,
            finalParentId,
            id,
          ]
        );
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const draft = result.rows[0];

    // Больше не нужно синхронизировать с planned_items
    // Данные для отображения теперь берутся из availableTasks по ключу
    // В planned_items хранятся только ключи и метаданные плана (phases, order)

    // Определяем type на основе hierarchy_level, если поле type отсутствует
    const draftType = draft.type || (draft.hierarchy_level === 0 ? 'epic' : 'draft');

    return NextResponse.json({
      id: draft.id,
      title: draft.title,
      description: draft.description,
      epicId: draft.epic_id,
      epicKey: draft.epic_key,
      tags: parseTags(draft.tags),
      storyPoints: draft.story_points,
      testPoints: draft.test_points,
      boardId: draft.board_id,
      hierarchyLevel: draft.hierarchy_level ?? 0,
      type: draftType,
      parentId: draft.parent_id,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update draft');
  }
}

/**
 * DELETE /api/drafts?id=UUID
 * Удалить драфт
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
      `DELETE FROM draft_tasks WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to delete draft');
  }
}
