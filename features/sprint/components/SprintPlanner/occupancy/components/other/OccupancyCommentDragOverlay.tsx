'use client';

import type { Comment } from '@/types';

import { DragOverlay, useDndMonitor } from '@dnd-kit/core';
import { useState } from 'react';

/** Превью перетаскиваемой заметки (рендерится внутри DndContext, использует useDndMonitor) */
export function OccupancyCommentDragOverlay() {
  const [draggingComment, setDraggingComment] = useState<Comment | null>(null);
  useDndMonitor({
    onDragCancel: () => setDraggingComment(null),
    onDragEnd: () => setDraggingComment(null),
    onDragStart: (event) => {
      if (event.active.data.current?.type === 'comment') {
        setDraggingComment(event.active.data.current.comment as Comment);
      }
    },
  });
  return (
    <DragOverlay dropAnimation={null}>
      {draggingComment ? (
        <div
          className="flex items-center justify-center rounded-full bg-yellow-200 dark:bg-yellow-700 border border-yellow-400 dark:border-yellow-500 shadow-md cursor-grabbing ring-2 ring-yellow-400 dark:ring-yellow-500 scale-110"
          style={{ height: 22, width: 22 }}
        >
          <svg className="w-3 h-3 text-yellow-700 dark:text-yellow-300 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" fillRule="evenodd" />
          </svg>
        </div>
      ) : null}
    </DragOverlay>
  );
}
