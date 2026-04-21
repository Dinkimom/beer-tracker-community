import type { DragEndEvent } from '@dnd-kit/core';

import { describe, expect, it, vi } from 'vitest';

import { SWIMLANE_DEVELOPER_ROW_DRAG_KIND } from '@/features/swimlane/utils/swimlaneDragIds';

import { runDeveloperRowDragEndIfApplicable } from './sprintPlannerDndHelpers';

function makeDragEndEvent(partial: {
  activeId: string;
  activeData?: { kind?: string };
  overId?: string;
}): DragEndEvent {
  return {
    active: {
      id: partial.activeId,
      data: { current: partial.activeData ?? { kind: SWIMLANE_DEVELOPER_ROW_DRAG_KIND } },
    },
    over: partial.overId
      ? { id: partial.overId, data: { current: {} }, rect: {} as never, disabled: false }
      : null,
  } as DragEndEvent;
}

describe('runDeveloperRowDragEndIfApplicable', () => {
  it('calls onReorder when over is swimlane droppable', () => {
    const onReorder = vi.fn();
    runDeveloperRowDragEndIfApplicable(
      makeDragEndEvent({
        activeId: 'swimlane-dev-a',
        overId: 'swimlane-dev-b',
      }),
      onReorder
    );
    expect(onReorder).toHaveBeenCalledWith('dev-a', 'dev-b');
  });

  it('does not call onReorder when over is missing', () => {
    const onReorder = vi.fn();
    runDeveloperRowDragEndIfApplicable(
      makeDragEndEvent({
        activeId: 'swimlane-dev-a',
        overId: undefined,
      }),
      onReorder
    );
    expect(onReorder).not.toHaveBeenCalled();
  });
});
