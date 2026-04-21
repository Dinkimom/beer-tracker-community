/**
 * Tracker API: спринты (только сервер).
 */

import type { SprintInfo } from '@/types/tracker';
import type { AxiosInstance } from 'axios';

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

export async function updateTrackerSprintStatus(
  sprintId: number,
  status: 'archived' | 'draft' | 'in_progress' | 'released',
  version?: number,
  axiosInstance?: AxiosInstance
): Promise<(SprintInfo & { boardId?: number }) | null> {
  try {
    const api = requireTrackerAxiosForApiRoute(axiosInstance);
    const headers: Record<string, string> = {};

    if (version !== undefined) {
      headers['If-Match'] = `"${version}"`;
    }

    const { data } = await api.patch<SprintPayloadWithBoard>(
      `/sprints/${sprintId}`,
      { status },
      { headers }
    );

    let boardId = parseBoardIdFromTracker(data.board?.id);

    if (boardId == null) {
      try {
        const { data: full } = await api.get<SprintPayloadWithBoard>(`/sprints/${sprintId}`);
        boardId = parseBoardIdFromTracker(full.board?.id);
      } catch {
        /* доска не критична для ответа клиенту */
      }
    }

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
  } catch (error) {
    console.error(`Failed to update sprint ${sprintId} status:`, error);
    return null;
  }
}
