/**
 * Хук для определения обрезки текста комментария
 */

import { useState, useRef, useEffect } from 'react';

interface UseCommentTextTruncationProps {
  emptyNoteLabel: string;
  isDragging: boolean;
  isEditing: boolean;
  text: string;
}

export function useCommentTextTruncation({
  text,
  isEditing,
  isDragging,
  emptyNoteLabel,
}: UseCommentTextTruncationProps) {
  const [isTextTruncated, setIsTextTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Проверяем, обрезан ли текст
  useEffect(() => {
    if (contentRef.current && !isEditing && !isDragging) {
      const element = contentRef.current;
      // Используем более надежный способ проверки обрезки текста
      // Создаем временный элемент для измерения полной ширины текста
      const tempElement = document.createElement('div');
      tempElement.style.position = 'absolute';
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'nowrap';
      tempElement.style.fontSize = window.getComputedStyle(element).fontSize;
      tempElement.style.fontFamily = window.getComputedStyle(element).fontFamily;
      tempElement.style.fontWeight = window.getComputedStyle(element).fontWeight;
      tempElement.textContent = text || emptyNoteLabel;

      document.body.appendChild(tempElement);
      const fullWidth = tempElement.offsetWidth;
      const containerWidth = element.clientWidth;
      document.body.removeChild(tempElement);

      setIsTextTruncated(fullWidth > containerWidth);
    }
  }, [text, isEditing, isDragging, emptyNoteLabel]);

  return {
    isTextTruncated,
    contentRef,
  };
}

