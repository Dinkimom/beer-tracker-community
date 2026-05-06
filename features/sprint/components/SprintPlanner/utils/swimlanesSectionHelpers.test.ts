import type { Task, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';

import { describe, expect, it } from 'vitest';

import {
  buildDeveloperAvailabilityMap,
  computeHoverConnectedTaskIds,
} from '@/features/sprint/components/SprintPlanner/utils/swimlanesSectionHelpers';
import { techSprintEntryToBoardEvent, vacationEntryToBoardEvent } from '@/features/sprint/utils/quarterlyAvailabilityNormalize';

describe('buildDeveloperAvailabilityMap', () => {
  it('returns empty when availability is missing', () => {
    expect(buildDeveloperAvailabilityMap(undefined, [{ id: 'a' }])).toEqual(new Map());
    expect(buildDeveloperAvailabilityMap(null, [{ id: 'a' }])).toEqual(new Map());
  });

  it('maps only developers with vacations or tech sprints', () => {
    const availability: QuarterlyAvailability = {
      planId: 'p1',
      techSprints: [
        {
          endDate: '2025-01-05',
          id: 'ts1',
          memberId: 'u1',
          memberName: 'A',
          startDate: '2025-01-01',
          type: 'back',
        },
      ],
      vacations: [
        {
          endDate: '2025-02-10',
          id: 'v1',
          memberId: 'u2',
          memberName: 'B',
          startDate: '2025-02-01',
        },
      ],
    };
    const map = buildDeveloperAvailabilityMap(availability, [
      { id: 'u1' },
      { id: 'u2' },
      { id: 'u3' },
    ]);
    expect(map.size).toBe(2);
    expect(map.get('u1')?.boardEvents).toEqual([techSprintEntryToBoardEvent(availability.techSprints[0]!)]);
    expect(map.get('u2')?.boardEvents).toEqual([vacationEntryToBoardEvent(availability.vacations[0]!)]);
    expect(map.has('u3')).toBe(false);
  });

  it('prefers boardEvents when provided', () => {
    const availability: QuarterlyAvailability = {
      boardEvents: [
        {
          id: 'b1',
          memberId: 'u9',
          memberName: 'X',
          startDate: '2025-03-01',
          endDate: '2025-03-02',
          eventType: 'duty',
        },
      ],
      planId: 'p1',
      techSprints: [],
      vacations: [],
    };
    const map = buildDeveloperAvailabilityMap(availability, [{ id: 'u9' }]);
    expect(map.get('u9')?.boardEvents).toEqual(availability.boardEvents);
  });
});

describe('computeHoverConnectedTaskIds', () => {
  it('returns null when no hovered task', () => {
    expect(computeHoverConnectedTaskIds(null, [], undefined, undefined)).toBeNull();
  });

  it('includes link endpoints', () => {
    const set = computeHoverConnectedTaskIds(
      'a',
      [
        { fromTaskId: 'a', toTaskId: 'b' },
        { fromTaskId: 'c', toTaskId: 'd' },
      ],
      undefined,
      undefined
    );
    expect(set).toEqual(new Set(['a', 'b']));
  });

  it('adds QA pair when both tasks on board', () => {
    const qaTasksMap = new Map<string, Task>([
      ['dev1', { id: 'qa1' } as Task],
    ]);
    const taskPositions = new Map<string, TaskPosition>([
      ['dev1', {} as TaskPosition],
      ['qa1', {} as TaskPosition],
    ]);
    const set = computeHoverConnectedTaskIds('dev1', [], qaTasksMap, taskPositions);
    expect(set?.has('qa1')).toBe(true);
  });
});
