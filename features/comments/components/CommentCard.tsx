'use client';

import type { Comment } from '@/types';

import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

import { CommentCardContent } from './CommentCard/components/CommentCardContent';
import { CommentCardDeleteButton } from './CommentCard/components/CommentCardDeleteButton';
import { CommentCardTooltip } from './CommentCard/components/CommentCardTooltip';
import { useCommentCard } from './CommentCard/hooks/useCommentCard';

interface CommentCardProps {
  comment: Comment;
  onDelete: (id: string) => void;
  onPositionUpdate: (id: string, x: number, y: number, assigneeId?: string) => void;
  onUpdate: (id: string, text: string) => void;
}

export function CommentCard({ comment, onUpdate, onDelete, onPositionUpdate }: CommentCardProps) {
  const { t } = useI18n();
  const defaultNoteLabel = t('comments.defaultNote');
  const {
    isEditing,
    text,
    setText,
    textareaRef,
    contentRef,
    isDragging,
    isHovered,
    setIsHovered,
    isTextTruncated,
    currentX,
    currentY,
    handleDoubleClick,
    handleBlur,
    handleKeyDown,
    handleDelete,
    handleMouseDown,
  } = useCommentCard({
    comment,
    defaultNoteLabel,
    onUpdate,
    onDelete,
    onPositionUpdate,
  });

  return (
    <>
      <div
        className={`bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 shadow-md hover:shadow-lg transition-all duration-200 select-none rounded-sm ${
          isDragging ? 'opacity-60 rotate-0' : ''
        } ${isEditing ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-400 dark:border-blue-500 rotate-0' : 'hover:border-yellow-300 dark:hover:border-yellow-600'}`}
        style={{
          position: 'absolute',
          left: `${currentX}px`,
          top: `${currentY}px`,
          width: `${comment.width}px`,
          height: '60px', // Полная высота ячейки
          cursor: isEditing ? 'text' : 'move',
          zIndex: ZIndex.overlay,
          transform: isDragging ? 'none' : 'rotate(-0.5deg)',
        }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="p-2.5 relative h-full flex items-center overflow-visible">
          <CommentCardContent
            contentRef={contentRef}
            emptyDisplayText={defaultNoteLabel}
            isEditing={isEditing}
            notePlaceholder={t('comments.placeholder')}
            text={text}
            textareaRef={textareaRef}
            onBlur={handleBlur}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Кнопка удаления - показывается при наведении */}
          {!isEditing && isHovered && <CommentCardDeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Tooltip с полным текстом при наведении, если текст обрезан - вне основного контейнера */}
      {isHovered && isTextTruncated && !isEditing && (
        <CommentCardTooltip emptyDisplayText={defaultNoteLabel} text={text} x={comment.x} y={comment.y} />
      )}
    </>
  );
}
