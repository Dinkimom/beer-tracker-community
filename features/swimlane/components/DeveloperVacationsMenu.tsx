'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';

export interface DeveloperVacationsMenuProps {
  boardId: number | null;
  memberId: string;
  memberName: string;
  onEditAvailability: (args: { boardId: number; memberId: string; memberName: string }) => void;
}

export function DeveloperVacationsMenu({
  boardId,
  memberId,
  memberName,
  onEditAvailability,
}: DeveloperVacationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!boardId) {
    return null;
  }

  const button = (
    <Button
      aria-label="Меню исполнителя"
      className="!inline-flex !min-h-0 items-center justify-center rounded-md !px-2 !py-1 text-gray-400 hover:!bg-gray-100 hover:!text-gray-700 dark:hover:!bg-gray-800 dark:hover:!text-gray-200"
      title="Действия"
      type="button"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
        setOpen(true);
      }}
    >
      <span className="select-none text-lg leading-none">⋯</span>
    </Button>
  );

  if (!open || !anchorEl) return button;

  const r = anchorEl.getBoundingClientRect();
  const left = Math.min(window.innerWidth - 8, Math.max(8, r.right));
  const top = Math.min(window.innerHeight - 8, Math.max(8, r.bottom + 6));

  return (
    <>
      {button}
      {createPortal(
        <>
          <div
            aria-hidden
            className="fixed inset-0 bg-transparent"
            style={{ zIndex: ZIndex.contextMenu - 1 }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="fixed min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            style={{ left, top, zIndex: ZIndex.contextMenu }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              className="h-auto min-h-0 w-full cursor-pointer rounded-none border-0 !justify-start !gap-2 !px-3 !py-2.5 text-left text-sm text-gray-700 shadow-none hover:!bg-gray-50 dark:text-gray-200 dark:hover:!bg-gray-700/50"
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onEditAvailability({ boardId, memberId, memberName });
              }}
            >
              <Icon className="h-4 w-4 text-gray-500 dark:text-gray-300" name="edit" />
              События доступности
            </Button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

