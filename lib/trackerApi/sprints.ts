/**
 * Tracker API: спринты (только сервер).
 */

import type { SprintInfo } from '@/types/tracker';
import type { AxiosInstance } from 'axios';

import { isAxiosError } from 'axios';

import { requireTrackerAxiosForApiRoute } from '../trackerAxiosFactory';

function parseBoardIdFromTracker(raw: number | string | null | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchSprintInfo(
  sprintId: number,
  axiosInstance?: AxiosInstance
): Promise<SprintInfo> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const { data } = await api.get<SprintInfo>(`/sprints/${sprintId}`);

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    version: data.version,
  };
}

/** Ответ PATCH/GET спринта в Tracker может содержать board — нужен для сброса кэша списка спринтов доски */
type SprintPayloadWithBoard = SprintInfo & { board?: { id?: number | string } };

function sprintInfoFromPayload(data: SprintPayloadWithBoard): SprintInfo & { boardId?: number } {
  const boardId = parseBoardIdFromTracker(data.board?.id);
  const base: SprintInfo & { boardId?: number } = {
    id: data.id,
    name: data.name,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    version: data.version,
  };
  if (boardId != null) {
    base.boardId = boardId;
  }
  return base;
}

async function patchSprintStatus(
  api: AxiosInstance,
  sprintId: number,
  status: 'archived' | 'draft' | 'in_progress' | 'released',
  version?: number
): Promise<SprintPayloadWithBoard> {
  const headers: Record<string, string> = {};

  if (version !== undefined) {
    headers['If-Match'] = `"${version}"`;
  }

  const { data } = await api.patch<SprintPayloadWithBoard>(
    `/sprints/${sprintId}`,
    { status },
    { headers }
  );
  return data;
}

async function fetchSprintPayload(
  api: AxiosInstance,
  sprintId: number
): Promise<SprintPayloadWithBoard> {
  const { data } = await api.get<SprintPayloadWithBoard>(`/sprints/${sprintId}`);
  return data;
}

async function getSprintBoardId(
  api: AxiosInstance,
  sprintId: number
): Promise<number | undefined> {
  try {
    const full = await fetchSprintPayload(api, sprintId);
    return parseBoardIdFromTracker(full.board?.id);
  } catch {
    return undefined;
  }
}

export async function updateTrackerSprintStatus(
  sprintId: number,
  status: 'archived' | 'draft' | 'in_progress' | 'released',
  version?: number,
  axiosInstance?: AxiosInstance
): Promise<(SprintInfo & { boardId?: number }) | null> {
  try {
    const api = requireTrackerAxiosForApiRoute(axiosInstance);
    let data: SprintPayloadWithBoard;
    try {
      data = await patchSprintStatus(api, sprintId, status, version);
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 412 || version === undefined) {
        throw error;
      }

      const currentSprint = await fetchSprintPayload(api, sprintId);
      data = currentSprint.status === status
        ? currentSprint
        : await patchSprintStatus(api, sprintId, status, currentSprint.version);
    }

    const sprint = sprintInfoFromPayload(data);

    if (sprint.boardId == null) {
      const boardId = await getSprintBoardId(api, sprintId);
      if (boardId != null) {
        sprint.boardId = boardId;
      }
    }

    return sprint;
  } catch (error) {
    console.error(`Failed to update sprint ${sprintId} status:`, error);
    return null;
  }
}
