import { NextRequest, NextResponse } from 'next/server';

import { apiCache, cacheKeys, invalidateCache } from '@/lib/cache';
import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { CreateDocumentSchema, formatValidationError, validateRequest } from '@/lib/validation';

// Кэшируем документы на 3 минуты
const DOCUMENTS_CACHE_TTL = 3 * 60; // 3 минуты в секундах

/**
 * GET /api/features/[featureId]/documents
 * Получить все документы фичи
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

    // Проверяем кэш
    const cacheKey = cacheKeys.featureDocuments(featureId);
    const cachedData = apiCache.get<{ documents: unknown[] }>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

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
      WHERE d.feature_id = $1
      ORDER BY d.display_order ASC, d.created_at ASC`,
      [featureId]
    );

    const responseData = { documents: result.rows };

    // Сохраняем в кэш
    apiCache.set(cacheKey, responseData, DOCUMENTS_CACHE_TTL);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features/[featureId]/documents
 * Создать новый документ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateDocumentSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { name, content, type } = validation.data;

    // Получаем document_type_id по коду типа
    const documentTypeResult = await query(
      `SELECT id, content_format FROM document_types WHERE code = $1`,
      [type]
    );

    if (documentTypeResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Document type '${type}' not found` },
        { status: 400 }
      );
    }
    const finalDocumentTypeId = documentTypeResult.rows[0].id;
    const contentFormat = documentTypeResult.rows[0].content_format;

    // Обрабатываем контент в зависимости от формата
    let finalContent = content;
    if (contentFormat === 'jsonb') {
      // Для JSONB устанавливаем дефолт - пустой объект, если content пустой или невалидный
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        finalContent = JSON.stringify({});
      } else if (typeof content === 'object' && content !== null) {
        finalContent = JSON.stringify(content);
      } else if (typeof content === 'string') {
        // Если пришел JSON-строка для JSONB, проверяем валидность
        try {
          JSON.parse(content);
          finalContent = content;
        } catch {
          return NextResponse.json(
            { error: 'Content for JSONB type must be valid JSON string' },
            { status: 400 }
          );
        }
      }
    } else if (contentFormat === 'text' && typeof content !== 'string') {
      finalContent = String(content);
    }

    // Получаем максимальный display_order для установки нового
    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
       FROM feature_documents
       WHERE feature_id = $1`,
      [featureId]
    );
    const displayOrder = maxOrderResult.rows[0]?.next_order || 0;

    const result = await query(
      `INSERT INTO feature_documents (feature_id, document_type_id, name, content, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING 
         id,
         name,
         content,
         document_type_id as "documentTypeId",
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [featureId, finalDocumentTypeId, name, finalContent, displayOrder]
    );

    // Версии создаются только при закрытии документа, не при создании

    // Получаем информацию о типе документа для ответа
    const typeResult = await query(
      `SELECT code, icon_name as "iconName", editor_type as "editorType"
       FROM document_types
       WHERE id = $1`,
      [finalDocumentTypeId]
    );
    const docType = typeResult.rows[0];
    const documentRow = result.rows[0];

    const responseData = {
      document: {
        id: documentRow.id,
        name: documentRow.name,
        content: documentRow.content,
        documentTypeId: documentRow.documentTypeId,
        displayOrder: documentRow.displayOrder,
        createdAt: documentRow.createdAt,
        updatedAt: documentRow.updatedAt,
        type: docType?.code || 'markdown',
        iconName: docType?.iconName,
        editorType: docType?.editorType,
      },
    };

    // Инвалидируем кэш документов фичи
    invalidateCache.feature(featureId);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}

