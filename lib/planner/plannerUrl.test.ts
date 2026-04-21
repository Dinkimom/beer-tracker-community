import { describe, expect, it } from 'vitest';

import { buildPlannerPath, isPlannerPath, parsePlannerPath } from './plannerUrl';

describe('plannerUrl', () => {
  it('buildPlannerPath', () => {
    expect(buildPlannerPath(12, 34)).toBe('/planner/12/sprint/34');
  });

  it('parsePlannerPath', () => {
    expect(parsePlannerPath('/planner/12/sprint/34')).toEqual({ boardId: 12, sprintId: 34 });
    expect(parsePlannerPath('/planner/12/sprint/34/extra')).toEqual({ boardId: 12, sprintId: 34 });
    expect(parsePlannerPath('/')).toBeNull();
  });

  it('isPlannerPath', () => {
    expect(isPlannerPath('/planner/1/sprint/2')).toBe(true);
    expect(isPlannerPath('/')).toBe(false);
  });
});
