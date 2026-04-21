/**
 * Канонический путь к планировщику спринта (доска + спринт в URL для прямых ссылок).
 * Query-параметры (page, tab, фильтры) добавляются отдельно.
 */
export function buildPlannerPath(boardId: number, sprintId: number): string {
  return `/planner/${boardId}/sprint/${sprintId}`;
}

const PLANNER_PATH_RE = /^\/planner\/(\d+)\/sprint\/(\d+)(?:\/|$)/;

export function parsePlannerPath(pathname: string): { boardId: number; sprintId: number } | null {
  const m = pathname.match(PLANNER_PATH_RE);
  if (!m) return null;
  return { boardId: parseInt(m[1], 10), sprintId: parseInt(m[2], 10) };
}

export function isPlannerPath(pathname: string): boolean {
  return PLANNER_PATH_RE.test(pathname);
}
