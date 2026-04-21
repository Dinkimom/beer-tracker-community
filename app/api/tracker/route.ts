import type { Developer } from '@/types';

import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { getQueryParam } from '@/lib/api-utils';
import { sortTasksByOccupancyOrder } from '@/lib/api/sortTasksByOccupancyOrder';
import { query } from '@/lib/db';
import { roleCatalogEntriesToResolutionSlices } from '@/lib/roles/catalog';
import { getEffectiveRoles } from '@/lib/roles/effectiveCatalog';
import { listOrgRoles } from '@/lib/roles/orgRolesRepository';
import { listSystemRoles } from '@/lib/roles/systemRolesRepository';
import {
  enrichPlannerTeamMembersFromTracker,
  fetchTeamMembersByBoardIdForOrg,
  getStaffByTrackerUserIdsInOrg,
} from '@/lib/staffTeams';
import { convertTeamMembersToDevelopers } from '@/lib/teamMemberUtils';
import {
  fetchSprintInfo,
  fetchTrackerIssues,
  mapTrackerIssueToTask,
} from '@/lib/trackerApi';
import { loadTrackerIntegrationForOrganization } from '@/lib/trackerIntegration';
import { SprintIdQuerySchema, formatValidationError, validateRequest } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const { organizationId } = tenantResult.ctx;

    const sprintId = getQueryParam(request, 'sprintId');
    const boardId = getQueryParam(request, 'boardId');
    const statusFilter = getQueryParam(request, 'statusFilter');

    const validation = validateRequest(SprintIdQuerySchema, { sprintId });
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const sprintIdNum = parseInt(validation.data.sprintId, 10);

    if (isNaN(sprintIdNum)) {
      return NextResponse.json(
        { error: 'sprintId must be a valid number' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);

    const [issues, sprintInfo, integration] = await Promise.all([
      fetchTrackerIssues(sprintIdNum, trackerApi),
      fetchSprintInfo(sprintIdNum, trackerApi),
      loadTrackerIntegrationForOrganization(organizationId),
    ]);

    let tasks = issues.map((issue) => mapTrackerIssueToTask(issue, integration));

    try {
      const orderResult = await query(
        `SELECT parent_ids as "parentIds", task_orders as "taskOrders"
         FROM occupancy_task_order
         WHERE organization_id = $1 AND sprint_id = $2`,
        [organizationId, sprintIdNum]
      );
      const orderRow = orderResult.rows[0];
      if (orderRow?.parentIds != null || orderRow?.taskOrders != null) {
        const order = {
          parentIds: orderRow.parentIds ?? [],
          taskOrders: orderRow.taskOrders ?? {},
        };
        tasks = sortTasksByOccupancyOrder(tasks, order);
      }
    } catch (orderErr) {
      console.warn('[GET /api/tracker] Could not apply occupancy order:', orderErr);
    }

    if (statusFilter === 'active' || statusFilter === 'completed') {
      const isClosed = (t: { originalStatus?: string }) =>
        (t.originalStatus ?? '').toLowerCase() === 'closed';
      tasks = statusFilter === 'completed'
        ? tasks.filter(isClosed)
        : tasks.filter((t) => !isClosed(t));
    }

    let developers: Developer[] = [];
    if (boardId) {
      const boardIdNum = parseInt(boardId, 10);
      if (!isNaN(boardIdNum)) {
        try {
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
          developers = convertTeamMembersToDevelopers(teamMembers, roleCtx);
        } catch (err) {
          console.warn('Failed to fetch team members from PostgreSQL:', err);
        }
      }
    }

    const missingAvatarIds = developers
      .filter((d) => !d.avatarUrl)
      .map((d) => d.id);

    if (missingAvatarIds.length > 0) {
      try {
        const employees = await getStaffByTrackerUserIdsInOrg(
          organizationId,
          missingAvatarIds
        );
        const avatarMap = new Map(
          employees
            .filter((e) => e.avatarUrl)
            .map((e) => [e.trackerId, e.avatarUrl!])
        );
        developers = developers.map((d) =>
          !d.avatarUrl && avatarMap.has(d.id)
            ? { ...d, avatarUrl: avatarMap.get(d.id) }
            : d
        );
      } catch (err) {
        console.warn('Failed to fetch avatars for assignees from staff:', err);
      }
    }

    return NextResponse.json({
      developers,
      sprintInfo,
      tasks,
    });
  } catch (error) {
    return handleApiError(error, 'fetch data from Tracker');
  }
}
