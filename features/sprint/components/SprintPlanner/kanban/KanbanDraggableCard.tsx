'use client';

import type { Task, Developer } from '@/types';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';

import { kanbanTaskId } from './kanbanDndUtils';

interface KanbanDraggableCardProps {
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  developers: Developer[];
  task: Task;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onTaskClick?: (taskId: string) => void;
}

export function KanbanDraggableCard({
  task,
  developers,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  onTaskClick,
  onContextMenu,
}: KanbanDraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: kanbanTaskId(task.id),
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  const dimOthers =
    contextMenuBlurOtherCards &&
    contextMenuTaskId != null &&
    contextMenuTaskId !== task.id;
  const menuOpenHere = contextMenuTaskId === task.id;

  return (
    <div
      ref={setNodeRef}
      className={`cursor-grab active:cursor-grabbing rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
        menuOpenHere ? 'overflow-visible relative z-20' : 'overflow-hidden'
      } ${
        dimOthers
          ? 'opacity-50 pointer-events-none transition-opacity duration-200'
          : ''
      }`}
      data-context-menu-source="task-card"
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onTaskClick?.(task.id)}
      onContextMenu={(e) => onContextMenu?.(e, task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTaskClick?.(task.id);
        }
      }}
    >
      <TaskCard
        assigneeName={task.assigneeName}
        className="pointer-events-none"
        developers={developers}
        isContextMenuOpen={menuOpenHere}
        task={task}
        variant="sidebar"
      />
    </div>
  );
}
