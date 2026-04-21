/**
 * Хук для управления логикой CommentCard
 */

import type { Comment } from '@/types';

import { useState } from 'react';

import { useCommentDragging } from './useCommentDragging';
import { useCommentEditing } from './useCommentEditing';
import { useCommentTextTruncation } from './useCommentTextTruncation';

interface UseCommentCardProps {
  comment: Comment;
  defaultNoteLabel: string;
  onDelete: (id: string) => void;
  onPositionUpdate: (id: string, x: number, y: number, assigneeId?: string) => void;
  onUpdate: (id: string, text: string) => void;
}

export function useCommentCard({
  comment,
  defaultNoteLabel,
  onUpdate,
  onDelete,
  onPositionUpdate,
}: UseCommentCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const editing = useCommentEditing({ comment, emptyNoteLabel: defaultNoteLabel, onUpdate });
  const dragging = useCommentDragging({
    comment,
    isEditing: editing.isEditing,
    onPositionUpdate,
  });
  const textTruncation = useCommentTextTruncation({
    text: editing.text,
    isEditing: editing.isEditing,
    isDragging: dragging.isDragging,
    emptyNoteLabel: defaultNoteLabel,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(comment.id);
  };

  return {
    isEditing: editing.isEditing,
    text: editing.text,
    setText: editing.setText,
    textareaRef: editing.textareaRef,
    contentRef: textTruncation.contentRef,
    isDragging: dragging.isDragging,
    isHovered,
    setIsHovered,
    isTextTruncated: textTruncation.isTextTruncated,
    currentX: dragging.currentX,
    currentY: dragging.currentY,
    handleDoubleClick: editing.handleDoubleClick,
    handleBlur: editing.handleBlur,
    handleKeyDown: editing.handleKeyDown,
    handleDelete,
    handleMouseDown: dragging.handleMouseDown,
  };
}

