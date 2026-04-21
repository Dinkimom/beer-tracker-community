'use client';

import type { Comment, Developer } from '@/types';

import { useDraggable } from '@dnd-kit/core';
import * as Popover from '@radix-ui/react-popover';
import { useCallback, useState, useRef, useEffect } from 'react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { getInitials } from '@/utils/displayUtils';

interface OccupancyCommentCardProps {
  comment: Comment;
  /** Высота контейнера ячейки */
  containerHeight: number;
  /** Карта разработчиков — для резолва автора по comment.assigneeId */
  developerMap: Map<string, Developer>;
  /** Открыть попап сразу в режиме редактирования (при создании новой заметки) */
  initialEdit?: boolean;
  /** Смещение внутри ячейки (px) */
  offsetX: number;
  offsetY: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}

const CIRCLE_SIZE = 22;

export function OccupancyCommentCard({
  comment,
  offsetX,
  offsetY,
  initialEdit = false,
  containerHeight,
  developerMap,
  onDelete,
  onUpdate,
}: OccupancyCommentCardProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(initialEdit);
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [text, setText] = useState(comment.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Заметка только что создана и попап открыт впервые — «Отмена» без сохранения удаляет её.
   * Сбрасываем после первого успешного прохода через handleSave (кнопка «Сохранить» или закрытие с сохранением).
   */
  const deleteOnCancelWithoutSaveRef = useRef(initialEdit);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `comment:${comment.id}`,
    data: { type: 'comment' as const, comment },
    disabled: isPopoverOpen,
  });

  // Фокус в textarea при открытии попапа в режиме редактирования (контент в Portal — ждём отрисовку)
  useEffect(() => {
    if (!isEditing || !isPopoverOpen) return;
    let cancelled = false;
    const focusTextarea = () => {
      if (cancelled) return;
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    };
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(focusTextarea);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [isEditing, isPopoverOpen]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(56, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    if (isEditing) adjustTextareaHeight();
  }, [isEditing, text, adjustTextareaHeight]);

  const handleSave = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== comment.text) {
      onUpdate(comment.id, trimmed);
    } else if (!trimmed) {
      setText(comment.text);
    }
    setIsEditing(false);
    deleteOnCancelWithoutSaveRef.current = false;
  }, [text, comment.text, comment.id, onUpdate]);

  const discardNewNoteOrRevertEdit = useCallback(() => {
    if (deleteOnCancelWithoutSaveRef.current) {
      onDelete(comment.id);
      setIsPopoverOpen(false);
      setIsEditing(false);
      return;
    }
    setText(comment.text);
    setIsEditing(false);
  }, [comment.text, comment.id, onDelete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      discardNewNoteOrRevertEdit();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(comment.id);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // При закрытии — сохраняем если редактировали
      if (isEditing) handleSave();
      setIsEditing(false);
    }
    setIsPopoverOpen(open);
  };

  const dndOnPointerDown = (listeners as { onPointerDown?: (e: React.PointerEvent) => void } | undefined)?.onPointerDown;

  const maxTop = Math.max(0, containerHeight - CIRCLE_SIZE);
  const clampedTop = Math.min(Math.max(0, offsetY), maxTop);

  const baseStyle = {
    position: 'absolute' as const,
    left: offsetX,
    top: clampedTop,
    zIndex: isDragging ? ZIndex.dragPreview : ZIndex.contentInteractive,
  };

  const authorDev = developerMap.get(comment.assigneeId);
  const resolvedAuthor = authorDev
    ? { display: authorDev.name, avatarUrl: authorDev.avatarUrl ?? null }
    : undefined;

  return (
    <Popover.Root open={isPopoverOpen} onOpenChange={handleOpenChange}>
      <Popover.Anchor
        ref={setNodeRef}
        {...attributes}
        {...{ ...listeners, onPointerDown: undefined }}
        className={`flex items-center justify-center rounded-full select-none transition-all duration-150 ${
          isDragging
            ? 'opacity-0 pointer-events-none'
            : isPopoverOpen
              ? 'scale-110 shadow-md ring-2 ring-yellow-400 dark:ring-yellow-500 cursor-grab active:cursor-grabbing'
              : 'cursor-grab active:cursor-grabbing hover:scale-110 hover:shadow-md'
        } bg-yellow-200 dark:bg-yellow-700 border border-yellow-400 dark:border-yellow-500 shadow-sm`}
        style={{
          ...baseStyle,
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) setIsPopoverOpen((o) => !o);
        }}
        onPointerDown={(e) => {
          dndOnPointerDown?.(e);
          e.stopPropagation();
        }}
      >
        <Icon className="w-3 h-3 text-yellow-700 dark:text-yellow-300 pointer-events-none" name="comment" />
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          className={`${ZIndex.class('tooltip')} w-72 rounded-lg bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 outline-none`}
          side="top"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => {
            // Не даём фокус уйти в шапку/кнопки — сразу в поле заметки (доп. страховка к useEffect)
            if (isEditing) {
              e.preventDefault();
              queueMicrotask(() => {
                requestAnimationFrame(() => {
                  const el = textareaRef.current;
                  if (!el) return;
                  el.focus({ preventScroll: true });
                  el.select();
                });
              });
            }
          }}
        >
          {/* Шапка: автор и дата */}
          {resolvedAuthor && (
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <Avatar
                avatarUrl={resolvedAuthor.avatarUrl ?? undefined}
                className="flex-shrink-0 shadow-sm"
                initials={getInitials(resolvedAuthor.display)}
                initialsVariant="primary"
                size="lg"
              />
              <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {resolvedAuthor.display}
                </div>
                {comment.createdAt && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(comment.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Тело: текст или textarea */}
          <div className="px-3 pt-2.5 pb-1 max-h-[240px] overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                className="w-full min-h-[3.5rem] bg-transparent border border-gray-200 dark:border-gray-600 rounded-md outline-none resize-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 p-2 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                placeholder="Введите текст заметки..."
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  adjustTextareaHeight();
                }}
                onInput={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed min-h-[1.5rem]">
                {comment.text || <span className="text-gray-400 italic">Заметка</span>}
              </p>
            )}
          </div>

          {/* Футер: кнопки */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-700">
            {isEditing ? (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  className="!min-h-0 text-xs !px-2 !py-1 text-gray-500 hover:!text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
                  type="button"
                  variant="ghost"
                  onClick={discardNewNoteOrRevertEdit}
                >
                  Отмена
                </Button>
                <Button
                  className="!min-h-0 text-xs !px-2.5 !py-1"
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                >
                  Сохранить
                </Button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  className="!min-h-0 items-center gap-1 text-xs !px-2 !py-1 text-gray-500 hover:!text-gray-700 dark:text-gray-400 dark:hover:!text-gray-200"
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                >
                  <Icon className="h-3.5 w-3.5" name="edit" />
                  Редактировать
                </Button>
                <Button
                  className="!min-h-0 items-center gap-1 text-xs !px-2 !py-1 text-red-500 hover:!bg-red-50 hover:!text-red-600 dark:text-red-400 dark:hover:!bg-red-900/20 dark:hover:!text-red-300"
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                >
                  <Icon className="h-3.5 w-3.5" name="trash" />
                  Удалить
                </Button>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
