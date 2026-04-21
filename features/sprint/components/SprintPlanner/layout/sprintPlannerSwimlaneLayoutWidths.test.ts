import { describe, expect, it } from 'vitest';

import { WORKING_DAYS } from '@/constants';
import {
  SPRINT_PLANNER_DAY_MAX_WIDTH_PX,
  sprintPlannerDaysHeaderContentWidthCss,
  sprintPlannerFullTimelineWidthExpr,
  sprintPlannerMaxTimelineWidthPx,
  sprintPlannerSwimlaneTimelineWidthCss,
} from '@/features/sprint/components/SprintPlanner/layout/sprintPlannerSwimlaneLayoutWidths';

describe('sprintPlannerSwimlaneLayoutWidths', () => {
  it('max timeline width matches working days × day max', () => {
    expect(sprintPlannerMaxTimelineWidthPx()).toBe(WORKING_DAYS * SPRINT_PLANNER_DAY_MAX_WIDTH_PX);
  });

  it('full timeline expr subtracts participants and sidebar', () => {
    expect(sprintPlannerFullTimelineWidthExpr(200, 64)).toBe('calc(200vw - 200px - 64px)');
  });

  it('swimlane timeline in full mode uses min(full expr, max px)', () => {
    const maxPx = sprintPlannerMaxTimelineWidthPx();
    expect(sprintPlannerSwimlaneTimelineWidthCss('full', 180, 0)).toBe(
      `min(calc(200vw - 180px - 0px), ${maxPx}px)`
    );
  });

  it('swimlane timeline in compact mode is 100%', () => {
    expect(sprintPlannerSwimlaneTimelineWidthCss('compact', 180, 0)).toBe('100%');
  });

  it('days header content width in full mode matches participants + min timeline', () => {
    const maxPx = sprintPlannerMaxTimelineWidthPx();
    expect(sprintPlannerDaysHeaderContentWidthCss('full', 200, 48)).toBe(
      `calc(200px + min(calc(200vw - 200px - 48px), ${maxPx}px))`
    );
  });

  it('days header content width in compact mode is 100%', () => {
    expect(sprintPlannerDaysHeaderContentWidthCss('compact', 200, 48)).toBe('100%');
  });
});
