import type { SegmentWithPhase } from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';
import type { SwimlaneInProgressFactSegment } from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';
import type { StatusPhaseCell } from '@/lib/planner-timeline';

import { describe, expect, it } from 'vitest';

import {
  buildArrowPairsForSameTask,
  buildLanes,
  hexToRgbaArrow,
  isClosedFactPhase,
  swimlaneFactBarElementId,
} from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';

const DEFAULT_PHASE_CELL: StatusPhaseCell = {
  durationMs: 0,
  endCell: 0,
  endTime: null,
  startCell: 0,
  startTime: '',
  statusKey: 'inProgress',
  statusName: '',
};

const DEFAULT_SEG: SwimlaneInProgressFactSegment = {
  durationMs: 0,
  endTime: null,
  endTimeMs: 0,
  laneIndex: 0,
  startTime: '',
  startTimeMs: 0,
  statusKey: 'inProgress',
  statusName: '',
  taskId: '',
};

function phaseCell(partial: Partial<StatusPhaseCell> & Pick<StatusPhaseCell, 'endCell' | 'startCell'>): StatusPhaseCell {
  return { ...DEFAULT_PHASE_CELL, ...partial };
}

function segBase(
  partial: Partial<SwimlaneInProgressFactSegment> &
    Pick<SwimlaneInProgressFactSegment, 'endTimeMs' | 'laneIndex' | 'startTimeMs' | 'taskId'>
): SwimlaneInProgressFactSegment {
  return { ...DEFAULT_SEG, ...partial };
}

function item(phase: StatusPhaseCell, seg: SwimlaneInProgressFactSegment): SegmentWithPhase {
  return { phase, seg };
}

describe('isClosedFactPhase', () => {
  it('returns true for closed status (case/spaces)', () => {
    expect(isClosedFactPhase(phaseCell({ statusKey: 'Closed', startCell: 0, endCell: 1 }))).toBe(true);
    expect(isClosedFactPhase(phaseCell({ statusKey: ' closed ', startCell: 0, endCell: 1 }))).toBe(true);
  });

  it('returns false for other statuses', () => {
    expect(isClosedFactPhase(phaseCell({ statusKey: 'inProgress', startCell: 0, endCell: 1 }))).toBe(false);
  });
});

describe('swimlaneFactBarElementId', () => {
  it('builds stable id from layer and segment times', () => {
    expect(
      swimlaneFactBarElementId('row-1', {
        endTimeMs: 2,
        startTimeMs: 1,
        taskId: 't1',
      })
    ).toBe('factbar_row-1_t1_1_2');
  });

  it('sanitizes layer id to allowed chars', () => {
    expect(
      swimlaneFactBarElementId('a/b:c', {
        endTimeMs: 0,
        startTimeMs: 0,
        taskId: 't',
      })
    ).toMatch(/^factbar_a_b_c_t_0_0$/);
  });
});

describe('hexToRgbaArrow', () => {
  it('converts #RRGGBB to rgba', () => {
    expect(hexToRgbaArrow('#ff8040', 0.55)).toBe('rgba(255, 128, 64, 0.55)');
  });

  it('returns input when not a hex color', () => {
    expect(hexToRgbaArrow('red', 0.5)).toBe('red');
  });
});

describe('buildArrowPairsForSameTask', () => {
  it('returns empty when fewer than two segments per task', () => {
    const s = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 1, endTimeMs: 2 });
    const p = phaseCell({ startCell: 0, endCell: 1 });
    expect(buildArrowPairsForSameTask([item(p, s)], 'L')).toEqual([]);
  });

  it('links consecutive segments of same task by start time', () => {
    const s1 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 10, endTimeMs: 20 });
    const s2 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 5, endTimeMs: 8 });
    const s3 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 30, endTimeMs: 40 });
    const p1 = phaseCell({ startCell: 1, endCell: 2 });
    const p2 = phaseCell({ startCell: 0, endCell: 1 });
    const p3 = phaseCell({ startCell: 3, endCell: 4 });
    const pairs = buildArrowPairsForSameTask(
      [item(p1, s1), item(p2, s2), item(p3, s3)],
      'L'
    );
    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.from).toBe(swimlaneFactBarElementId('L', s2));
    expect(pairs[0]!.to).toBe(swimlaneFactBarElementId('L', s1));
    expect(pairs[1]!.from).toBe(swimlaneFactBarElementId('L', s1));
    expect(pairs[1]!.to).toBe(swimlaneFactBarElementId('L', s3));
  });

  it('does not pair different tasks', () => {
    const s1 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 1, endTimeMs: 2 });
    const s2 = segBase({ taskId: 'b', laneIndex: 0, startTimeMs: 3, endTimeMs: 4 });
    const p = phaseCell({ startCell: 0, endCell: 1 });
    expect(buildArrowPairsForSameTask([item(p, s1), item(p, s2)], 'L')).toEqual([]);
  });
});

describe('buildLanes', () => {
  it('returns empty for empty input', () => {
    expect(buildLanes([])).toEqual([]);
  });

  it('groups by laneIndex and sorts lanes by earliest startCell', () => {
    const s0 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 1, endTimeMs: 2 });
    const s1 = segBase({ taskId: 'b', laneIndex: 1, startTimeMs: 1, endTimeMs: 2 });
    const pLate = phaseCell({ startCell: 5, endCell: 6 });
    const pEarly = phaseCell({ startCell: 1, endCell: 2 });
    const lanes = buildLanes([
      item(pLate, s0),
      item(pEarly, s1),
    ]);
    expect(lanes).toHaveLength(2);
    expect(lanes[0]![0]!.phase.startCell).toBe(1);
    expect(lanes[1]![0]!.phase.startCell).toBe(5);
  });

  it('sorts items within lane by startCell', () => {
    const s1 = segBase({ taskId: 'a', laneIndex: 0, startTimeMs: 1, endTimeMs: 2 });
    const s2 = segBase({ taskId: 'b', laneIndex: 0, startTimeMs: 3, endTimeMs: 4 });
    const p2 = phaseCell({ startCell: 4, endCell: 5 });
    const p1 = phaseCell({ startCell: 1, endCell: 2 });
    const lanes = buildLanes([item(p2, s2), item(p1, s1)]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.map((x) => x.phase.startCell)).toEqual([1, 4]);
  });
});
