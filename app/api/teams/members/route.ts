import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { roleCatalogEntriesToResolutionSlices } from '@/lib/roles/catalog';
import { getEffectiveRoles } from '@/lib/roles/effectiveCatalog';
import { listOrgRoles } from '@/lib/roles/orgRolesRepository';
import { listSystemRoles } from '@/lib/roles/systemRolesRepository';
import {
  enrichPlannerTeamMembersFromTracker,
  fetchTeamMembersByBoardIdForOrg,
} from '@/lib/staffTeams';
import { convertTeamMembersToDevelopers } from '@/lib/teamMemberUtils';
import { BoardIdQuerySchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * GET /api/teams/members?boardId={boardId}
 * Участники команды из PostgreSQL приложения (teams / staff / team_members) в разрезе tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const { organizationId } = tenantResult.ctx;

    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');

    const validation = validateRequest(BoardIdQuerySchema, { boardId });
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const boardIdNum = parseInt(validation.data.boardId, 10);

    if (isNaN(boardIdNum)) {
      return NextResponse.json(
        { error: 'boardId must be a valid number' },
        { status: 400 }
      );
    }

    const [teamMembersRaw, systemRows, orgRows] = await Promise.all([
      fetchTeamMembersByBoardIdForOrg(organizationId, boardIdNum),
      listSystemRoles(),
      listOrgRoles(organizationId),
    ]);

    const teamMembers = await enrichPlannerTeamMembersFromTracker(
      organizationId,
      teamMembersRaw
    );

    const roleCtx = roleCatalogEntriesToResolutionSlices(
      getEffectiveRoles(systemRows, orgRows)
    );
    const developers = convertTeamMembersToDevelopers(teamMembers, roleCtx);

    return NextResponse.json({
      teamMembers,
      developers,
      count: teamMembers.length,
    });
  } catch (error) {
    return handleApiError(error, 'fetch team members');
  }
}
