import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * GET /api/features/[featureId]/documents/[documentId]/versions/[versionId]
 * Получить содержимое конкретной версии документа
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string; versionId: string }> | { featureId: string; documentId: string; versionId: string } }
) {
  try {
    const { featureId, documentId, versionId } = await resolveParams(params);

    // Проверяем, что документ существует и принадлежит featureId
    const docCheck = await query(
      `SELECT id FROM feature_documents
       WHERE id = $1 AND feature_id = $2`,
      [documentId, featureId]
    );

    if (docCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Получаем версию документа
    const result = await query(
      `SELECT 
        id,
        document_id as "documentId",
        feature_id as "featureId",
        content,
        name,
        version_number as "versionNumber",
        created_at as "createdAt"
      FROM document_versions
      WHERE id = $1 AND document_id = $2`,
      [versionId, documentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ version: result.rows[0] });
  } catch (error) {
    console.error('Error fetching document version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document version' },
      { status: 500 }
    );
  }
}
