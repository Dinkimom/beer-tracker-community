'use client';

/**
 * Внешний `DndContext` планера (задачи + reorder строк разработчика).
 * Внутри `children` возможны **вложенные** `DndContext` (канбан, DnD комментариев в занятости) — см. раздел в `SprintPlanner/README.md`.
 */

import type { DragContextRef } from '@/features/swimlane/hooks/useDragAndDrop/hooks/useDragEnd';
import type { Developer, Task } from '@/types';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';

import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';

import { isActiveDeveloperRowDrag, runDeveloperRowDragEndIfApplicable } from './sprintPlannerDndHelpers';

export interface SprintPlannerDndShellProps {
  activeTask: Task | null;
  children: ReactNode;
  developers: Developer[];
  developersManagement: {
    handleDragEnd: (activeDeveloperId: string, overDeveloperId: string) => void;
  };
  dragAndDrop: {
    handleDragEnd: (event: DragEndEvent) => void;
    handleDragOver: (event: DragOverEvent) => void;
    handleDragStart: (event: DragStartEvent) => void;
    resetDragState: () => void;
  };
  dragContextRef: DragContextRef;
  isDragFromSidebar: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  setIsDragFromSidebar: (value: boolean) => void;
}

export function SprintPlannerDndShell({
  activeTask,
  children,
  developers,
  developersManagement,
  dragAndDrop,
  dragContextRef,
  isDragFromSidebar,
  setIsDragFromSidebar,
  sidebarOpen,
  sidebarWidth,
}: SprintPlannerDndShellProps) {
  return (
    <DndContext
      autoScroll={false}
      collisionDetection={closestCenter}
      onDragAbort={() => {
        dragAndDrop.resetDragState();
      }}
      onDragCancel={() => {
        dragAndDrop.resetDragState();
      }}
      onDragEnd={(event) => {
        setIsDragFromSidebar(false);
        // Только явный kind developer-row — не по префиксу id (ключ задачи может быть `swimlane-…`, в onDragEnd data иногда пустой).
        if (isActiveDeveloperRowDrag(event.active)) {
          dragContextRef.current = null;
          runDeveloperRowDragEndIfApplicable(event, developersManagement.handleDragEnd);
          return;
        }
        dragAndDrop.handleDragEnd(event);
        dragContextRef.current = null;
      }}
      onDragOver={(event) => {
        if (isActiveDeveloperRowDrag(event.active)) {
          return;
        }
        dragAndDrop.handleDragOver(event);
      }}
      onDragStart={(event) => {
        if (isActiveDeveloperRowDrag(event.active)) {
          return;
        }
        const fromSidebar =
          (event.active.data?.current as { source?: string } | undefined)?.source === 'sidebar';
        setIsDragFromSidebar(fromSidebar);
        dragContextRef.current = {
          isDragFromSidebar: fromSidebar,
          sidebarOpen,
          sidebarWidth,
        };
        dragAndDrop.handleDragStart(event);
      }}
    >
      {children}
      <DragOverlay dropAnimation={isDragFromSidebar ? undefined : null}>
        {isDragFromSidebar && activeTask ? (
          <div className="w-[380px]">
            <TaskCard
              className="opacity-90 rotate-3"
              developers={developers}
              isDragging
              task={activeTask}
              variant="sidebar"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
