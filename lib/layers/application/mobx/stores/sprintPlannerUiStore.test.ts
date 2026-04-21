import type { Task } from '@/types';

import { describe, expect, it } from 'vitest';

import { SprintPlannerUiStore } from './sprintPlannerUiStore';

function minimalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    link: 'https://example.com/task-1',
    name: 'Task',
    team: 'Web',
    ...overrides,
  };
}

describe('SprintPlannerUiStore', () => {
  it('clearTransientUiOnSprintChange сбрасывает поиск, меню, сегменты, комментарий, hover и модалку учёта работ', () => {
    const store = new SprintPlannerUiStore();
    const task = minimalTask();

    store.setGlobalNameFilter('foo');
    store.setSegmentEditTaskId('seg-1');
    store.setContextMenuTaskId('ctx-task');
    store.setContextMenu({
      position: { x: 10, y: 20 },
      task,
    });
    store.setOpenCommentEditId('comment-1');
    store.setHoveredTaskId('hover-1');
    store.setAccountWorkModal(task);

    const commentsBefore = store.commentsVisible;
    const sidebarBefore = store.sidebarOpen;

    store.clearTransientUiOnSprintChange();

    expect(store.globalNameFilter).toBe('');
    expect(store.segmentEditTaskId).toBeNull();
    expect(store.contextMenu).toBeNull();
    expect(store.contextMenuTaskId).toBeNull();
    expect(store.openCommentEditId).toBeNull();
    expect(store.hoveredTaskId).toBeNull();
    expect(store.accountWorkModal).toBeNull();
    expect(store.commentsVisible).toBe(commentsBefore);
    expect(store.sidebarOpen).toBe(sidebarBefore);
  });
});
