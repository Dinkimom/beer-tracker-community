/**
 * API квартального планирования: планы, элементы, связи, участники, доступность, эпики/стори.
 */

import type { StoryPhasePosition } from '@/features/quarterly-planning-v2/types';
import type { Developer } from '@/types';
import type { VacationEntry } from '@/types/quarterly';

import { getPlannerBeerTrackerApi } from '../plannerBeerTrackerApiOverride';

export async function fetchTeamMembers(boardId: number): Promise<Developer[]> {
  try {
    const { data } = await getPlannerBeerTrackerApi().get(`/teams/members?boardId=${boardId}`);
    return data.developers || [];
  } catch (error) {
    console.error(`Failed to fetch team members for board ${boardId}:`, error);
    return [];
  }
}

/** Ответ GET /api/quarterly-plans/v2 */
export interface QuarterlyPlanV2Response {
  epicKeys: string[];
  planId: string;
  /** План продактов из planned_items (по спринтам) для сравнения с планом команды */
  productPlanStoryPhases?: Record<string, StoryPhasePosition>;
  /** Ключи родительских тикетов, у которых по плану фаза заканчивается в запрошенном спринте (для сегмента «релиз») */
  releaseInSprintKeys?: string[];
  storyPhases: Record<string, StoryPhasePosition>;
}

/** Опции запроса плана v2 для страницы спринта: только фазы по заданным родительским ключам в указанном спринте. */
export interface FetchQuarterlyPlanV2SprintOptions {
  parentKeys: string[];
  sprintId: number;
}

/** Загрузить план квартального планирования v2 (эпики + фазы стори). При передаче sprintOptions — только фазы для parentKeys в этом спринте (эпики агрегируются). */
export async function fetchQuarterlyPlanV2(
  boardId: number,
  year: number,
  quarter: number,
  sprintOptions?: FetchQuarterlyPlanV2SprintOptions
): Promise<QuarterlyPlanV2Response> {
  let url = `/quarterly-plans/v2?boardId=${boardId}&year=${year}&quarter=${quarter}`;
  if (sprintOptions?.parentKeys?.length && sprintOptions.sprintId != null) {
    url += `&parentKeys=${sprintOptions.parentKeys.map(encodeURIComponent).join(',')}&sprintId=${sprintOptions.sprintId}`;
  }
  const { data } = await getPlannerBeerTrackerApi().get<QuarterlyPlanV2Response>(url);
  return data;
}

/** Сохранить план квартального планирования v2. */
export async function saveQuarterlyPlanV2(
  boardId: number,
  year: number,
  quarter: number,
  epicKeys: string[],
  storyPhases: Record<string, StoryPhasePosition>
): Promise<{ success: boolean; planId?: string }> {
  const { data } = await getPlannerBeerTrackerApi().put<{ success: boolean; planId: string }>(
    '/quarterly-plans/v2',
    { boardId, year, quarter, epicKeys, storyPhases }
  );
  return { success: true, planId: data.planId };
}

export async function fetchVacationEntriesForMember(options: {
  boardId: number;
  memberId: string;
}): Promise<VacationEntry[]> {
  const { boardId, memberId } = options;
  const { data } = await getPlannerBeerTrackerApi().get<{ vacations: VacationEntry[] }>(
    `/quarterly-plans/availability/vacations?boardId=${boardId}&memberId=${encodeURIComponent(memberId)}`
  );
  return data.vacations ?? [];
}

export async function fetchVacationEntriesForBoard(boardId: number): Promise<VacationEntry[]> {
  const { data } = await getPlannerBeerTrackerApi().get<{ vacations: VacationEntry[] }>(
    `/quarterly-plans/availability/vacations?boardId=${boardId}`
  );
  return data.vacations ?? [];
}

export async function createVacationEntry(options: {
  boardId: number;
  memberId: string;
  memberName: string;
  startDate: string;
  endDate: string;
}): Promise<VacationEntry> {
  const { data } = await getPlannerBeerTrackerApi().post<VacationEntry>(
    '/quarterly-plans/availability/vacations',
    options
  );
  return data;
}

export async function updateVacationEntry(options: {
  boardId: number;
  endDate: string;
  id: string;
  memberId: string;
  memberName: string;
  startDate: string;
}): Promise<VacationEntry> {
  const { data } = await getPlannerBeerTrackerApi().patch<VacationEntry>(
    '/quarterly-plans/availability/vacations',
    options
  );
  return data;
}

export async function deleteVacationEntry(options: {
  boardId: number;
  id: string;
  memberId: string;
}): Promise<{ deleted: number; success: boolean }> {
  const { boardId, id, memberId } = options;
  const { data } = await getPlannerBeerTrackerApi().delete<{ deleted: number; success: boolean }>(
    `/quarterly-plans/availability/vacations?id=${encodeURIComponent(id)}&boardId=${boardId}&memberId=${encodeURIComponent(memberId)}`
  );
  return data;
}
