import { describe, expect, it } from 'vitest';

import {
  buildPlannedLayoutSnapshot,
  computeBaselineStretch,
  computeBaselineStripOpacity,
  computeSwimlaneOverdueBaselineStrips,
  computeTaskLayerCardOpacity,
} from './taskLayerTaskLayout';

describe('buildPlannedLayoutSnapshot', () => {
  it('uses planned fields when set', () => {
    const snap = buildPlannedLayoutSnapshot({
      assignee: 'a',
      duration: 3,
      plannedDuration: 9,
      plannedStartDay: 1,
      plannedStartPart: 0,
      startDay: 0,
      startPart: 0,
      taskId: 't1',
    });
    expect(snap.plannedDuration).toBe(9);
    expect(snap.plannedStartDay).toBe(1);
  });
});

describe('computeBaselineStretch', () => {
  it('returns null when planned end not before current cell', () => {
    expect(
      computeBaselineStretch({ status: 'todo' } as never, 20, 10)
    ).toBeNull();
  });

  it('returns strip when todo/in-progress and gap exists', () => {
    const r = computeBaselineStretch({ status: 'todo' } as never, 5, 10);
    expect(r).toEqual({ baselineStart: 5, baselineWidth: 5 });
  });
});

describe('computeSwimlaneOverdueBaselineStrips', () => {
  const todo = { status: 'todo' } as never;

  it('returns one strip per segment end that is before current cell', () => {
    const strips = computeSwimlaneOverdueBaselineStrips(
      todo,
      [
        { startDay: 0, startPart: 0, duration: 2 },
        { startDay: 0, startPart: 2, duration: 1 },
      ],
      10
    );
    expect(strips).toEqual([
      { baselineStart: 2, baselineWidth: 8 },
      { baselineStart: 3, baselineWidth: 7 },
    ]);
  });

  it('skips segment not yet overdue', () => {
    const strips = computeSwimlaneOverdueBaselineStrips(
      todo,
      [
        { startDay: 0, startPart: 0, duration: 2 },
        { startDay: 0, startPart: 2, duration: 5 },
      ],
      4
    );
    expect(strips).toEqual([{ baselineStart: 2, baselineWidth: 2 }]);
  });
});

describe('computeBaselineStripOpacity', () => {
  it('uses hover highlight for active task id', () => {
    expect(
      computeBaselineStripOpacity({
        activeTaskDuration: 3,
        assigneeId: 'a',
        baselineStart: 0,
        baselineWidth: 5,
        hoveredCell: null,
        hoveredTaskId: 'x',
        isDraggingTask: true,
        taskId: 'x',
      })
    ).toBe(1);
  });
});

describe('computeTaskLayerCardOpacity', () => {
  it('full opacity when activeTask set', () => {
    expect(
      computeTaskLayerCardOpacity({
        activeTask: { id: '1' } as never,
        factHoveredTaskId: null,
        hoverConnectedTaskIds: null,
        segmentEditTaskId: null,
        taskId: '2',
      })
    ).toBe(1);
  });
});
