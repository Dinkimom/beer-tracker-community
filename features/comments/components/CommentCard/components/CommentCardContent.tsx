'use client';

/**
 * Компонент содержимого CommentCard
 */

interface CommentCardContentProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  emptyDisplayText: string;
  isEditing: boolean;
  notePlaceholder: string;
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onBlur: () => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function CommentCardContent({
  isEditing,
  text,
  textareaRef,
  contentRef,
  emptyDisplayText,
  notePlaceholder,
  onBlur,
  onChange,
  onKeyDown,
}: CommentCardContentProps) {
  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        className="w-full bg-transparent border-none outline-none resize-none text-xs font-normal text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
        placeholder={notePlaceholder}
        style={{ height: '20px', lineHeight: '20px' }}
        value={text}
        onBlur={onBlur}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <div
      ref={contentRef}
      className="text-xs font-normal text-gray-800 dark:text-gray-200 w-full truncate whitespace-nowrap"
    >
      {text || emptyDisplayText}
    </div>
  );
}

