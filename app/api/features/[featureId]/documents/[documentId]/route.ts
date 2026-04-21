import type { QueryParams } from '@/types';

import { NextRequest, NextResponse } from 'next/server';

import { invalidateCache } from '@/lib/cache';
import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { UpdateDocumentSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * GET /api/features/[featureId]/documents/[documentId]
 * Получить документ по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string }> | { featureId: string; documentId: string } }
) {
  try {
    const { featureId, documentId } = await resolveParams(params);

    const result = await query(
      `SELECT 
        d.id,
        d.name,
        d.content,
        d.document_type_id as "documentTypeId",
        dt.code as type,
        dt.icon_name as "iconName",
        dt.editor_type as "editorType",
        d.display_order as "displayOrder",
        d.created_at as "createdAt",
        d.updated_at as "updatedAt"
      FROM feature_documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      WHERE d.id = $1 AND d.feature_id = $2`,
      [documentId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features/[featureId]/documents/[documentId]
 * Обновить документ
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string }> | { featureId: string; documentId: string } }
) {
  try {
    const { featureId, documentId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateDocumentSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { name, content } = validation.data;

    const updates: string[] = [];
    const values: QueryParams = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (content !== undefined) {
      updates.push(`content = $${paramIndex}`);
      values.push(content);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(documentId, featureId);

    const result = await query(
      `UPDATE feature_documents
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND feature_id = $${paramIndex + 1}
       RETURNING 
         id,
         name,
         content,
         document_type_id as "documentTypeId",
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Получаем информацию о типе документа для ответа
    const typeResult = await query(
      `SELECT code, icon_name as "iconName", editor_type as "editorType"
       FROM document_types
       WHERE id = $1`,
      [result.rows[0].documentTypeId]
    );
    const docType = typeResult.rows[0];

    // Инвалидируем кэш документов фичи
    invalidateCache.feature(featureId);

    return NextResponse.json({
      document: {
        ...result.rows[0],
        type: docType?.code || 'markdown',
        iconName: docType?.iconName,
        editorType: docType?.editorType,
      },
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/features/[featureId]/documents/[documentId]
 * Удалить документ
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string }> | { featureId: string; documentId: string } }
) {
  try {
    const { featureId, documentId } = await resolveParams(params);

    const result = await query(
      `DELETE FROM feature_documents
       WHERE id = $1 AND feature_id = $2
       RETURNING id`,
      [documentId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Инвалидируем кэш документов фичи
    invalidateCache.feature(featureId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

