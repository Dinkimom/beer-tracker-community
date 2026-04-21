import type { StoryPhasePosition } from '@/features/quarterly-planning-v2/types';
import type { Quarter } from '@/types/quarterly';

import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';

import {
  buildFilteredStoryPhasesForSprint,
  ensureQuarterlyPlanId,
  loadProductPlanStoryPhases,
  resolveQuarterlyPlanIdForPut,
} from './quarterlyPlansV2RouteHelpers';

/**
 * GET /api/quarterly-plans/v2?boardId=&year=&quarter=
 * Загрузить план v2: эпики и фазы стори. При отсутствии записи в quarterly_plans создаём её.
 * Опционально: &parentKeys=KEY1,KEY2,&sprintId= — вернуть фазы только для этих родительских тикетов в указанном спринте (эпики агрегируются из стори).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');
    const year = searchParams.get('year');
    const quarter = searchParams.get('quarter');
    const parentKeysParam = searchParams.get('parentKeys');
    const sprintIdParam = searchParams.get('sprintId');

    if (!boardId || !year || !quarter) {
      return NextResponse.json(
        { error: 'boardId, year и quarter обязательны' },
        { status: 400 }
      );
    }

    const boardIdNum = parseInt(boardId, 10);
    const yearNum = parseInt(year, 10);
    const quarterNum = parseInt(quarter, 10);
    if (Number.isNaN(boardIdNum) || Number.isNaN(yearNum) || Number.isNaN(quarterNum)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const planId = await ensureQuarterlyPlanId(boardIdNum, yearNum, quarterNum);

    const epicsResult = await query(
      `SELECT epic_key, display_order FROM quarterly_plan_v2_epics
       WHERE plan_id = $1 ORDER BY display_order ASC`,
      [planId]
    );

    const phasesResult = await query(
      `SELECT story_key, sprint_index, start_day, duration_days
       FROM quarterly_plan_v2_story_phases WHERE plan_id = $1`,
      [planId]
    );

    const epicKeys = epicsResult.rows.map((r: { epic_key: string }) => r.epic_key);

    const allStoryPhases: Record<string, StoryPhasePosition> = {};
    for (const row of phasesResult.rows as Array<{
      duration_days: number;
      sprint_index: number;
      start_day: number;
      story_key: string;
    }>) {
      allStoryPhases[row.story_key] = {
        sprintIndex: row.sprint_index,
        startDay: row.start_day,
        durationDays: row.duration_days,
      };
    }

    let storyPhases: Record<string, StoryPhasePosition> = allStoryPhases;
    let releaseInSprintKeysResult: string[] | undefined;

    const trackerApi = await getTrackerApiFromRequest(request);
    const { data: allSprintsFromTracker } = await trackerApi.get<
      Array<{ endDate: string; id: number; name?: string; startDate: string }>
    >(`/boards/${boardIdNum}/sprints`);
    const allSprintsForQuarter = allSprintsFromTracker ?? [];

    if (parentKeysParam?.trim() && sprintIdParam != null && sprintIdParam !== '') {
      const parentKeys = parentKeysParam
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const sprintIdNum = parseInt(sprintIdParam, 10);
      if (parentKeys.length > 0 && !Number.isNaN(sprintIdNum)) {
        const filtered = await buildFilteredStoryPhasesForSprint(
          parentKeys,
          sprintIdNum,
          boardIdNum,
          yearNum,
          quarterNum as Quarter,
          allStoryPhases,
          epicKeys,
          allSprintsForQuarter,
          request
        );
        storyPhases = filtered.storyPhases;
        releaseInSprintKeysResult = filtered.releaseInSprintKeys;
      }
    }

    const productPlanStoryPhases = await loadProductPlanStoryPhases(
      planId,
      allSprintsForQuarter,
      yearNum,
      quarterNum as Quarter
    );

    const json: {
      epicKeys: string[];
      planId: string;
      productPlanStoryPhases: Record<string, StoryPhasePosition>;
      releaseInSprintKeys?: string[];
      storyPhases: Record<string, StoryPhasePosition>;
    } = {
      planId,
      epicKeys,
      storyPhases,
      productPlanStoryPhases,
    };
    if (releaseInSprintKeysResult) json.releaseInSprintKeys = releaseInSprintKeysResult;
    return NextResponse.json(json);
  } catch (error) {
    return handleApiError(error, 'load quarterly plan v2');
  }
}

/**
 * PUT /api/quarterly-plans/v2
 * Body: { boardId: number, year: number, quarter: number, epicKeys: string[], storyPhases: Record<string, { sprintIndex, startDay, durationDays }> }
 * Сохранить план v2.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, year, quarter, epicKeys, storyPhases } = body;

    if (boardId == null || year == null || quarter == null) {
      return NextResponse.json(
        { error: 'boardId, year и quarter обязательны' },
        { status: 400 }
      );
    }

    const boardIdNum = Number(boardId);
    const yearNum = Number(year);
    const quarterNum = Number(quarter);
    if (Number.isNaN(boardIdNum) || Number.isNaN(yearNum) || Number.isNaN(quarterNum)) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const planId = await resolveQuarterlyPlanIdForPut(boardIdNum, yearNum, quarterNum);

    await query(`DELETE FROM quarterly_plan_v2_epics WHERE plan_id = $1`, [planId]);

    const epicKeysList = Array.isArray(epicKeys) ? (epicKeys as string[]) : [];
    for (let i = 0; i < epicKeysList.length; i++) {
      await query(
        `INSERT INTO quarterly_plan_v2_epics (plan_id, epic_key, display_order)
         VALUES ($1, $2, $3)`,
        [planId, epicKeysList[i], i]
      );
    }

    await query(`DELETE FROM quarterly_plan_v2_story_phases WHERE plan_id = $1`, [planId]);

    const phases =
      storyPhases && typeof storyPhases === 'object'
        ? (storyPhases as Record<string, StoryPhasePosition>)
        : {};
    for (const [storyKey, pos] of Object.entries(phases)) {
      if (
        !pos ||
        typeof pos.sprintIndex !== 'number' ||
        typeof pos.startDay !== 'number' ||
        typeof pos.durationDays !== 'number'
      ) {
        continue;
      }
      await query(
        `INSERT INTO quarterly_plan_v2_story_phases (plan_id, story_key, sprint_index, start_day, duration_days, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [planId, storyKey, pos.sprintIndex, pos.startDay, pos.durationDays]
      );
    }

    return NextResponse.json({ success: true, planId });
  } catch (error) {
    return handleApiError(error, 'save quarterly plan v2');
  }
}
