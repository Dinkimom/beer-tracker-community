'use client';

import type { Anchor } from '@/types';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

import { ZIndex } from '@/constants';

import { useSingleTooltipGroup } from './SingleTooltipGroupContext';

export type TextTooltipAlign = 'center' | 'end' | 'start';
export type TextTooltipSide = Anchor;

const CURSOR_OFFSET_PX = 12;

interface TextTooltipProps {
  /** Выравнивание по стороне */
  align?: TextTooltipAlign;
  /** Элемент-триггер (при наведении показывается тултип) */
  children: React.ReactElement;
  /** Контент тултипа (строка или React-элемент) */
  content: React.ReactNode;
  /** Дополнительные классы для контента */
  contentClassName?: string;
  /** Задержка перед показом (мс) */
  delayDuration?: number;
  /** Отключить тултип (например, когда content пустой) */
  disabled?: boolean;
  /** Показывать тултип в точке наведения курсора (вместо сверху по центру триггера) */
  followCursor?: boolean;
  /** Интерактивный режим (позволяет скролл и клики внутри тултипа) */
  interactive?: boolean;
  /** Сторона позиционирования относительно триггера */
  side?: TextTooltipSide;
  /** Отступ от триггера (px) */
  sideOffset?: number;
  /**
   * Уникальный id в рамках группы (SingleTooltipGroupProvider).
   * В группе одновременно виден только один тултип.
   */
  singleInGroupId?: string;
}

const tooltipContentClass =
  'w-max max-w-[90vw] whitespace-normal rounded px-2 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 shadow-lg';

/**
 * Текстовый тултип на Radix UI.
 * Рендерится в body через Portal, позиционируется рядом с триггером.
 * С опцией followCursor — в месте наведения курсора.
 */
export function TextTooltip({
  children,
  content,
  delayDuration = 300,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  contentClassName = '',
  disabled = false,
  followCursor = false,
  interactive = false,
  singleInGroupId,
}: TextTooltipProps) {
  const [open, setOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const group = useSingleTooltipGroup();

  useEffect(() => {
    if (singleInGroupId && group?.openId != null && group.openId !== singleInGroupId) {
      queueMicrotask(() => setOpen(false));
    }
  }, [singleInGroupId, group?.openId]);

  if (disabled || content == null || content === '') {
    return children;
  }

  const trigger = followCursor ? (
    <span
      style={{ display: 'contents' }}
      onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}
    >
      {children}
    </span>
  ) : (
    children
  );

  const effectiveOpen =
    singleInGroupId && group
      ? open && group.openId === singleInGroupId
      : open;

  const handleOpenChange = (next: boolean) => {
    if (singleInGroupId && group) {
      if (next) group.setOpenId(singleInGroupId);
      else if (group.openId === singleInGroupId) group.setOpenId(null);
    }
    setOpen(next);
  };

  return (
    <Tooltip.Provider
      delayDuration={delayDuration}
      disableHoverableContent={!interactive}
      skipDelayDuration={100}
    >
      <Tooltip.Root open={effectiveOpen} onOpenChange={handleOpenChange}>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          {followCursor ? (
            effectiveOpen && (
              <div
                className={`${ZIndex.class('tooltip')} ${tooltipContentClass} ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${contentClassName}`}
                style={{
                  position: 'fixed',
                  left: cursorPos.x + CURSOR_OFFSET_PX,
                  top: cursorPos.y + CURSOR_OFFSET_PX,
                }}
              >
                {content}
              </div>
            )
          ) : (
            <Tooltip.Content
              align={align}
              className={`${ZIndex.class('tooltip')} ${tooltipContentClass} ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${contentClassName}`}
              collisionPadding={8}
              side={side}
              sideOffset={sideOffset}
            >
              {content}
            </Tooltip.Content>
          )}
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
