/**
 * Хук для управления редактированием комментария
 */

import type { Comment } from '@/types';

import { useState, useRef, useEffect } from 'react';

interface UseCommentEditingProps {
  comment: Comment;
  emptyNoteLabel: string;
  onUpdate: (id: string, text: string) => void;
}

export function useCommentEditing({ comment, onUpdate, emptyNoteLabel }: UseCommentEditingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Автофокус при редактировании
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Авторазмер textarea (одна строка)
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '24px'; // Фиксированная высота одной строки
    }
  }, [text, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (text.trim() !== comment.text) {
      onUpdate(comment.id, text.trim() || emptyNoteLabel);
    } else if (!text.trim()) {
      setText(comment.text); // Восстанавливаем, если пусто
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setText(comment.text);
      setIsEditing(false);
    }
  };

  return {
    isEditing,
    text,
    setText,
    textareaRef,
    handleDoubleClick,
    handleBlur,
    handleKeyDown,
  };
}

