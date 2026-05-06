'use client';

import type { BoardAvailabilityEvent, BoardAvailabilityEventType } from '@/types/quarterly';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

import { Avatar, type AvatarInitialsVariant } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { AvailabilityEventUpsertModal } from '@/features/swimlane/components/AvailabilityEventUpsertModal';
import {
  createBoardAvailabilityEvent,
  deleteBoardAvailabilityEvent,
  fetchBoardAvailabilityEventsForMember,
  updateBoardAvailabilityEvent,
} from '@/lib/beerTrackerApi';
import { getInitials } from '@/utils/displayUtils';

export interface BoardAvailabilityModalProps {
  boardId: number;
  isOpen: boolean;
  memberAvatarUrl?: string | null;
  memberId: string;
  memberInitialsVariant?: AvatarInitialsVariant;
  memberName: string;
  onClose: () => void;
}

const EVENT_TYPE_LABEL: Record<BoardAvailabilityEventType, string> = {
  vacation: 'Отпуск',
  tech_sprint: 'Техспринт',
  sick_leave: 'Больничный',
  duty: 'Дежурство',
};

function formatRuLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;

  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(d);

  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${day} ${month} ${year}`;
}

function formatRange(ev: BoardAvailabilityEvent) {
  return `${formatRuLongDate(ev.startDate)} — ${formatRuLongDate(ev.endDate)}`;
}

function daysInclusive(startIso: string, endIso: string): number | null {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : null;
}

function eventSubtitle(ev: BoardAvailabilityEvent): string {
  const base = EVENT_TYPE_LABEL[ev.eventType];
  if (ev.eventType === 'tech_sprint' && ev.techSprintSubtype) {
    return `${base} (${ev.techSprintSubtype.toUpperCase()})`;
  }
  return base;
}

export function BoardAvailabilityModal({
  boardId,
  isOpen,
  memberAvatarUrl,
  memberId,
  memberInitialsVariant = 'default',
  memberName,
  onClose,
}: BoardAvailabilityModalProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BoardAvailabilityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editing, setEditing] = useState<BoardAvailabilityEvent | null>(null);
  const { confirm, DialogComponent } = useConfirmDialog();

  const isLoadingVisible = loading;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetchBoardAvailabilityEventsForMember({ boardId, memberId })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
      })
      .catch((e) => {
        console.error(e);
        toast.error('Не удалось загрузить события');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, boardId, memberId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (upsertOpen) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, upsertOpen]);

  if (!isOpen) return null;

  const patchBoardEventsCache = (patch: (prev: BoardAvailabilityEvent[]) => BoardAvailabilityEvent[]) => {
    queryClient.setQueryData<BoardAvailabilityEvent[]>(['boardAvailabilityEvents', boardId], (prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return patch(safePrev);
    });
  };

  const renderDays = (ev: BoardAvailabilityEvent) => {
    const days = daysInclusive(ev.startDate, ev.endDate);
    return days != null ? (
      <div
        className="text-xs text-gray-500 dark:text-gray-300"
        title="Календарные дни; первый и последний день включены"
      >
        {days} дн.
      </div>
    ) : null;
  };

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70 cursor-pointer"
      style={{ zIndex: ZIndex.modalBackdrop }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-hidden flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-4 pe-14 dark:border-gray-700">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar
              avatarUrl={memberAvatarUrl}
              initials={getInitials(memberName)}
              initialsVariant={memberInitialsVariant}
              size="lg"
              title={memberName}
            />
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100" title={memberName}>
              {memberName}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {items.length > 0 ? (
              <Button
                className="!h-9 text-sm font-semibold"
                type="button"
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setUpsertOpen(true);
                }}
              >
                <Icon className="h-4 w-4" name="plus" />
                Добавить
              </Button>
            ) : null}
            {isLoadingVisible ? (
              <span className="text-xs text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
                <Icon className="h-4 w-4 animate-spin" name="spinner" />
                Загрузка…
              </span>
            ) : null}
          </div>
          <HeaderIconButton
            aria-label="Закрыть"
            className="absolute end-3 top-1/2 z-10 -translate-y-1/2 text-gray-600 hover:!bg-gray-100 hover:!text-gray-900 dark:text-gray-300 dark:hover:!bg-gray-700 dark:hover:!text-gray-100"
            title="Закрыть"
            onClick={onClose}
          >
            <Icon className="h-5 w-5" name="close" />
          </HeaderIconButton>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5">
          <div className="space-y-2">
            {!loading && items.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center dark:border-gray-600 dark:bg-gray-900/40">
                <p className="text-sm text-gray-600 dark:text-gray-400">Пока нет событий.</p>
                <Button
                  className="!h-9 text-sm font-semibold"
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setUpsertOpen(true);
                  }}
                >
                  <Icon className="h-4 w-4" name="plus" />
                  Добавить
                </Button>
              </div>
            ) : null}

            {items.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                {items.map((ev) => (
                  <li
                    key={ev.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                        {eventSubtitle(ev)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {formatRange(ev)}
                      </div>
                      {renderDays(ev)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <HeaderIconButton
                        aria-label="Редактировать событие"
                        className="!h-9 !w-9 text-gray-500 hover:!bg-gray-100 hover:!text-gray-900 dark:text-gray-300 dark:hover:!bg-gray-700 dark:hover:!text-gray-100"
                        title="Редактировать"
                        onClick={() => {
                          setEditing(ev);
                          setUpsertOpen(true);
                        }}
                      >
                        <Icon className="h-4 w-4" name="edit" />
                      </HeaderIconButton>
                      <HeaderIconButton
                        aria-label="Удалить событие"
                        className="!h-9 !w-9 text-red-500 hover:!bg-red-50 hover:!text-red-700 dark:text-red-400 dark:hover:!bg-red-900/20 dark:hover:!text-red-200"
                        title="Удалить"
                        onClick={async () => {
                          const ok = await confirm(
                            `Удалить «${eventSubtitle(ev)}» ${formatRange(ev)}?`,
                            { title: 'Удаление события', variant: 'destructive', confirmText: 'Удалить' }
                          );
                          if (!ok) return;
                          try {
                            await deleteBoardAvailabilityEvent({ boardId, id: ev.id, memberId });
                            setItems((prev) => prev.filter((x) => x.id !== ev.id));
                            patchBoardEventsCache((prev) => prev.filter((x) => x.id !== ev.id));
                            toast.success('Событие удалено');
                          } catch (e) {
                            console.error(e);
                            toast.error('Не удалось удалить событие');
                          }
                        }}
                      >
                        <Icon className="h-4 w-4" name="trash" />
                      </HeaderIconButton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {content}
      <AvailabilityEventUpsertModal
        initial={
          editing
            ? {
                startDate: editing.startDate,
                endDate: editing.endDate,
                eventType: editing.eventType,
                techSprintSubtype: editing.techSprintSubtype,
              }
            : null
        }
        isOpen={upsertOpen}
        title={editing ? 'Редактировать событие' : 'Добавить событие'}
        onClose={() => setUpsertOpen(false)}
        onSubmit={async ({ startDate, endDate, eventType: et, techSprintSubtype: tst }) => {
          try {
            if (editing) {
              const updated = await updateBoardAvailabilityEvent({
                boardId,
                endDate,
                eventType: et,
                id: editing.id,
                memberId,
                memberName,
                startDate,
                ...(et === 'tech_sprint' ? { techSprintSubtype: tst } : {}),
              });
              setItems((prev) =>
                prev
                  .map((x) => (x.id === updated.id ? updated : x))
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              patchBoardEventsCache((prev) =>
                prev
                  .map((x) => (x.id === updated.id ? updated : x))
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              toast.success('Событие обновлено');
              return;
            }

            const created = await createBoardAvailabilityEvent({
              boardId,
              endDate,
              eventType: et,
              memberId,
              memberName,
              startDate,
              ...(et === 'tech_sprint' ? { techSprintSubtype: tst } : {}),
            });
            setItems((prev) => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
            patchBoardEventsCache((prev) =>
              [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
            toast.success('Событие добавлено');
          } catch (e) {
            console.error(e);
            toast.error(editing ? 'Не удалось обновить событие' : 'Не удалось добавить событие');
          }
        }}
      />
      {DialogComponent}
    </>,
    document.body
  );
}
