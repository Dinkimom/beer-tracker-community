export interface AdminTeamMember {
  pending_product_invitation: boolean;
  product_planner_is_team_lead: boolean | null;
  product_team_access: boolean;
  product_user_id: string | null;
  product_user_in_org: boolean;
  role_slug: string | null;
  staff_display_name: string;
  staff_email: string | null;
  staff_id: string;
  staff_tracker_user_id: string | null;
}

export interface AdminStaffRow {
  display_name: string;
  email: string | null;
  id: string;
}

export interface AdminTeamRow {
  active: boolean;
  id: string;
  slug: string;
  title: string;
  tracker_board_id: string;
  tracker_queue_key: string;
}

export interface AdminTrackerCatalogTeamBinding {
  id: string;
  title: string;
  tracker_board_id: string;
  tracker_queue_key: string;
}

export interface AdminTrackerCatalogPayload {
  boards: { id: number; name: string }[];
  queues: { key: string; name: string }[];
  teams: AdminTrackerCatalogTeamBinding[];
}

export function teamTitleUsingQueue(
  teams: readonly AdminTrackerCatalogTeamBinding[],
  queueKey: string
): string | null {
  const q = queueKey.trim();
  const row = teams.find((t) => String(t.tracker_queue_key).trim() === q);
  return row?.title ?? null;
}

export function teamTitleUsingBoard(
  teams: readonly AdminTrackerCatalogTeamBinding[],
  boardId: number
): string | null {
  const row = teams.find((t) => {
    const n = Number.parseInt(String(t.tracker_board_id), 10);
    return Number.isFinite(n) && n === boardId;
  });
  return row?.title ?? null;
}
