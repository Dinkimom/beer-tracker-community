import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * GET /api/features/[featureId]/documents/[documentId]/versions
 * Получить список версий документа (changelog)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; documentId: string }> | { featureId: string; documentId: string } }
) {
  try {
    const { featureId, documentId } = await resolveParams(params);

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

    // Получаем все версии документа, отсортированные по дате создания (новые первыми)
    const result = await query(
      `SELECT 
        id,
        version_number as "versionNumber",
        created_at as "createdAt",
        name
      FROM document_versions
      WHERE document_id = $1
      ORDER BY created_at DESC`,
      [documentId]
    );

    return NextResponse.json({ versions: result.rows });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document versions' },
      { status: 500 }
    );
  }
}
