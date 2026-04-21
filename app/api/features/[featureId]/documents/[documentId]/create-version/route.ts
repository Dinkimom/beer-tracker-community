import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * POST /api/features/[featureId]/documents/[documentId]/create-version
 * Создать версию документа (вызывается при закрытии документа)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string }> | { featureId: string; documentId: string } }
) {
  try {
    const { featureId, documentId } = await resolveParams(params);

    // Получаем текущий документ
    const currentDocResult = await query(
      `SELECT name, content FROM feature_documents
       WHERE id = $1 AND feature_id = $2`,
      [documentId, featureId]
    );

    if (currentDocResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const currentDoc = currentDocResult.rows[0];

    // Проверяем, есть ли уже такая версия (чтобы не создавать дубликаты)
    // Сравниваем с последней версией
    const lastVersionResult = await query(
      `SELECT content, name FROM document_versions
       WHERE document_id = $1
       ORDER BY version_number DESC
       LIMIT 1`,
      [documentId]
    );

    const lastVersion = lastVersionResult.rows[0];
    const currentContent = currentDoc.content ?? '';
    const lastVersionContent = lastVersion?.content ?? '';

    // Создаем версию только если содержимое изменилось с момента последней версии
    if (lastVersion && currentContent === lastVersionContent && currentDoc.name === lastVersion.name) {
      return NextResponse.json({
        message: 'No changes since last version',
        versionCreated: false
      });
    }

    // Получаем максимальный номер версии для этого документа
    const maxVersionResult = await query(
      `SELECT COALESCE(MAX(version_number), 0) as max_version
       FROM document_versions
       WHERE document_id = $1`,
      [documentId]
    );
    const nextVersionNumber = (maxVersionResult.rows[0]?.max_version || 0) + 1;

    // Создаем новую версию с текущим содержимым и именем
    const versionResult = await query(
      `INSERT INTO document_versions (document_id, feature_id, content, name, version_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, version_number, created_at`,
      [
        documentId,
        featureId,
        currentContent,
        currentDoc.name || '',
        nextVersionNumber,
      ]
    );

    return NextResponse.json({
      version: versionResult.rows[0],
      versionCreated: true,
    });
  } catch (error: unknown) {
    // Логируем ошибку, но не возвращаем ошибку клиенту
    // Это может произойти если таблица document_versions не существует
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('Could not create document version (table may not exist):', errorMessage);

    return NextResponse.json({
      message: 'Version creation skipped (table may not exist)',
      versionCreated: false,
    });
  }
}
