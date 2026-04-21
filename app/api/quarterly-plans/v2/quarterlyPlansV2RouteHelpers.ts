import type { StoryPhasePosition } from '@/features/quarterly-planning-v2/types';
import type { Quarter } from '@/types/quarterly';
import type { AxiosInstance } from 'axios';
import type { NextRequest } from 'next/server';

import { filterSprintsByQuarter, WORKING_DAYS_PER_SPRINT } from '@/features/quarterly-planning-v2/utils/quarterSprints';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';
import { fetchEpicStories } from '@/lib/trackerApi/issues';

export function clipPhaseToSprint(
  phase: StoryPhasePosition,
  sprintIndexInQuarter: number
): StoryPhasePosition | null {
  const phaseStartQ = phase.sprintIndex * WORKING_DAYS_PER_SPRINT + phase.startDay;
  const phaseEndQ = phaseStartQ + phase.durationDays - 1;
  const sprintStartQ = sprintIndexInQuarter * WORKING_DAYS_PER_SPRINT;
  const sprintEndQ = sprintStartQ + WORKING_DAYS_PER_SPRINT - 1;
  const segStart = Math.max(phaseStartQ, sprintStartQ);
  const segEnd = Math.min(phaseEndQ, sprintEndQ);
  if (segStart > segEnd) return null;
  const durationDays = segEnd - segStart + 1;
  const startDay = segStart - sprintStartQ;
  return {
    sprintIndex: sprintIndexInQuarter,
    startDay,
    durationDays,
  };
}

export async function aggregateEpicPhase(
  epicKey: string,
  boardId: number,
  storyPhases: Record<string, StoryPhasePosition>,
  sprintIndexInQuarter: number,
  sprintEndQ: number,
  request: NextRequest,
  trackerApiOverride?: AxiosInstance
): Promise<{ releaseInSprint: boolean; segment: StoryPhasePosition } | null> {
  try {
    const trackerApi = trackerApiOverride ?? (await getTrackerApiFromRequest(request));
    const stories = await fetchEpicStories(epicKey, boardId, trackerApi);
    const segments: StoryPhasePosition[] = [];
    let releaseInSprint = false;
    for (const story of stories) {
      const key = story.key;
      if (!key) continue;
      const phase = storyPhases[key];
      if (phase) {
        const phaseEndQ =
          phase.sprintIndex * WORKING_DAYS_PER_SPRINT + phase.startDay + phase.durationDays - 1;
        if (phaseEndQ <= sprintEndQ) releaseInSprint = true;
        const segment = clipPhaseToSprint(phase, sprintIndexInQuarter);
        if (segment) segments.push(segment);
      }
    }
    if (segments.length === 0) return null;
    const minStart = Math.min(...segments.map((p) => p.startDay));
    const maxEnd = Math.max(...segments.map((p) => p.startDay + p.durationDays));
    return {
      segment: {
        sprintIndex: sprintIndexInQuarter,
        startDay: minStart,
        durationDays: Math.max(1, maxEnd - minStart),
      },
      releaseInSprint,
    };
  } catch (err) {
    console.warn('[quarterly-plans/v2] aggregate epic phase for', epicKey, err);
    return null;
  }
}

export async function ensureQuarterlyPlanId(
  boardIdNum: number,
  yearNum: number,
  quarterNum: number
): Promise<string> {
  const planResult = await query(
    `SELECT id FROM quarterly_plans
       WHERE board_id = $1 AND year = $2 AND quarter = $3`,
    [boardIdNum, yearNum, quarterNum]
  );

  if (planResult.rows.length === 0) {
    const insertResult = await query(
      `INSERT INTO quarterly_plans (board_id, year, quarter, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
      [boardIdNum, yearNum, quarterNum]
    );
    return insertResult.rows[0].id;
  }
  return planResult.rows[0].id;
}

/** Как ensureQuarterlyPlanId, но при существующей записи обновляет updated_at (для PUT). */
export async function resolveQuarterlyPlanIdForPut(
  boardIdNum: number,
  yearNum: number,
  quarterNum: number
): Promise<string> {
  const planResult = await query(
    `SELECT id FROM quarterly_plans
       WHERE board_id = $1 AND year = $2 AND quarter = $3`,
    [boardIdNum, yearNum, quarterNum]
  );

  if (planResult.rows.length === 0) {
    const insertResult = await query(
      `INSERT INTO quarterly_plans (board_id, year, quarter, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
      [boardIdNum, yearNum, quarterNum]
    );
    return insertResult.rows[0].id;
  }
  const planId = planResult.rows[0].id;
  await query(`UPDATE quarterly_plans SET updated_at = NOW() WHERE id = $1`, [planId]);
  return planId;
}

export async function buildFilteredStoryPhasesForSprint(
  parentKeys: string[],
  sprintIdNum: number,
  boardIdNum: number,
  yearNum: number,
  quarterNum: Quarter,
  allStoryPhases: Record<string, StoryPhasePosition>,
  epicKeys: string[],
  allSprintsForQuarter: Array<{ id: number; name?: string; startDate: string; endDate: string }>,
  request: NextRequest,
  trackerApiOverride?: AxiosInstance
): Promise<{ releaseInSprintKeys: string[]; storyPhases: Record<string, StoryPhasePosition> }> {
  const quarterSprints = filterSprintsByQuarter(allSprintsForQuarter, yearNum, quarterNum);
  const sprintIndexInQuarter = quarterSprints.findIndex((s) => s.id === sprintIdNum);
  if (sprintIndexInQuarter < 0) {
    return { releaseInSprintKeys: [], storyPhases: {} };
  }

  const filtered: Record<string, StoryPhasePosition> = {};
  const releaseInSprintKeys: string[] = [];
  const sprintEndQ = sprintIndexInQuarter * WORKING_DAYS_PER_SPRINT + WORKING_DAYS_PER_SPRINT - 1;
  const epicKeysSet = new Set(epicKeys);

  for (const key of parentKeys) {
    const phase = allStoryPhases[key];
    if (phase) {
      const segment = clipPhaseToSprint(phase, sprintIndexInQuarter);
      if (segment) {
        filtered[key] = segment;
        const phaseEndQ =
          phase.sprintIndex * WORKING_DAYS_PER_SPRINT + phase.startDay + phase.durationDays - 1;
        if (phaseEndQ <= sprintEndQ) releaseInSprintKeys.push(key);
        continue;
      }
    }
    if (epicKeysSet.has(key)) {
      const result = await aggregateEpicPhase(
        key,
        boardIdNum,
        allStoryPhases,
        sprintIndexInQuarter,
        sprintEndQ,
        request,
        trackerApiOverride
      );
      if (result) {
        filtered[key] = result.segment;
        if (result.releaseInSprint) releaseInSprintKeys.push(key);
      }
    }
  }

  return { releaseInSprintKeys, storyPhases: filtered };
}

export async function loadProductPlanStoryPhases(
  planId: string,
  allSprintsForQuarter: Array<{ id: number; name?: string; startDate: string; endDate: string }>,
  yearNum: number,
  quarterNum: Quarter
): Promise<Record<string, StoryPhasePosition>> {
  const productPlanStoryPhases: Record<string, StoryPhasePosition> = {};
  try {
    const plannedItemsResult = await query(
      `SELECT source_key, phases FROM planned_items
         WHERE plan_id = $1 AND type = 'story' AND source_key IS NOT NULL`,
      [planId]
    );
    const quarterSprints = filterSprintsByQuarter(allSprintsForQuarter, yearNum, quarterNum);
    for (const row of plannedItemsResult.rows as Array<{ source_key: string; phases: string | unknown }>) {
      let phases: Array<{ sprintId?: number | string }> = [];
      if (row.phases) {
        phases =
          typeof row.phases === 'string'
            ? JSON.parse(row.phases)
            : (row.phases as Array<{ sprintId?: number | string }>);
      }
      const phaseWithSprint = phases.find((p) => p.sprintId != null);
      if (!phaseWithSprint?.sprintId || quarterSprints.length === 0) continue;
      const sprintIdNum = Number(phaseWithSprint.sprintId);
      const idx = quarterSprints.findIndex((s) => s.id === sprintIdNum);
      if (idx < 0) continue;
      productPlanStoryPhases[row.source_key] = {
        sprintIndex: idx,
        startDay: 0,
        durationDays: 5,
      };
    }
  } catch (productErr) {
    console.warn('[quarterly-plans/v2] product plan from planned_items:', productErr);
  }
  return productPlanStoryPhases;
}
