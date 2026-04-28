import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';
import { BatchLinksSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * Батч сохранение связей между задачами в спринте
 * Позволяет сохранить множество связей одним запросом
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;
    const onPrem = isOnPremMode();

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(BatchLinksSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { links } = validation.data;

    // Используем транзакцию для атомарности операции
    await query('BEGIN');

    try {
      // Удаляем существующие связи для обновляемых связей
      const linkIds = links.map((l) => l.id);
      if (linkIds.length > 0) {
        const placeholders = linkIds.map((_, i) => `$${i + (onPrem ? 2 : 3)}`).join(', ');
        await query(
          `DELETE FROM task_links 
           WHERE ${onPrem ? `sprint_id = $1 AND id IN (${placeholders})` : `organization_id = $1 AND sprint_id = $2 AND id IN (${placeholders})`}`,
          onPrem ? [sprintId, ...linkIds] : [organizationId, sprintId, ...linkIds]
        );
      }

      // Вставляем все связи одним запросом
      // Используем правильную нумерацию параметров
      const valuesParts: string[] = [];
      const params: Array<number | string | null> = [];

      links.forEach((link, index) => {
        const baseIndex = index * (onPrem ? 6 : 7) + 1;
        valuesParts.push(
          onPrem
            ? `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`
            : `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`
        );
        if (onPrem) {
          params.push(
            link.id,
            sprintId,
            link.fromTaskId,
            link.toTaskId,
            link.fromAnchor ?? null,
            link.toAnchor ?? null
          );
        } else {
          params.push(
            link.id,
            organizationId,
            sprintId,
            link.fromTaskId,
            link.toTaskId,
            link.fromAnchor ?? null,
            link.toAnchor ?? null
          );
        }
      });

      await query(
        onPrem
          ? `INSERT INTO task_links (
               id, sprint_id, from_task_id, to_task_id, from_anchor, to_anchor
             ) VALUES ${valuesParts.join(', ')}
             ON CONFLICT (sprint_id, from_task_id, to_task_id)
             DO UPDATE SET
               from_anchor = EXCLUDED.from_anchor,
               to_anchor = EXCLUDED.to_anchor`
          : `INSERT INTO task_links (
               id, organization_id, sprint_id, from_task_id, to_task_id, from_anchor, to_anchor
             ) VALUES ${valuesParts.join(', ')}
             ON CONFLICT (organization_id, sprint_id, from_task_id, to_task_id)
             DO UPDATE SET
               from_anchor = EXCLUDED.from_anchor,
               to_anchor = EXCLUDED.to_anchor`,
        params
      );

      await query('COMMIT');

      return NextResponse.json({
        success: true,
        count: links.length,
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error saving batch links:', error);
    return NextResponse.json(
      { error: 'Failed to save batch links' },
      { status: 500 }
    );
  }
}

