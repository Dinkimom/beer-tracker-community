/**
 * Проверки: очередь / доска уже привязаны к другой команде организации.
 */

import type { TeamRow } from './types';

export function findTeamBlockingQueue(
  teams: readonly TeamRow[],
  queueKey: string,
  excludeTeamId?: string
): TeamRow | null {
  const q = queueKey.trim();
  for (const t of teams) {
    if (excludeTeamId != null && t.id === excludeTeamId) {
      continue;
    }
    if (String(t.tracker_queue_key).trim() === q) {
      return t;
    }
  }
  return null;
}

export function findTeamBlockingBoard(
  teams: readonly TeamRow[],
  boardId: number,
  excludeTeamId?: string
): TeamRow | null {
  if (!Number.isFinite(boardId) || boardId <= 0) {
    return null;
  }
  for (const t of teams) {
    if (excludeTeamId != null && t.id === excludeTeamId) {
      continue;
    }
    const n = Number.parseInt(String(t.tracker_board_id), 10);
    if (Number.isFinite(n) && n === boardId) {
      return t;
    }
  }
  return null;
}
