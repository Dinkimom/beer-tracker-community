'use client';

import type { VacationEntry } from '@/types/quarterly';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

import { Button } from '@/components/Button';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { VacationUpsertModal } from '@/features/swimlane/components/VacationUpsertModal';
import { createVacationEntry, deleteVacationEntry, fetchVacationEntriesForMember, updateVacationEntry } from '@/lib/beerTrackerApi';

export interface VacationsModalProps {
  boardId: number;
  isOpen: boolean;
  memberId: string;
  memberName: string;
  onClose: () => void;
}

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

function formatRange(v: VacationEntry) {
  return `${formatRuLongDate(v.startDate)} — ${formatRuLongDate(v.endDate)}`;
}

function daysInclusive(startIso: string, endIso: string): number | null {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : null;
}

export function VacationsModal({
  boardId,
  isOpen,
  memberId,
  memberName,
  onClose,
}: VacationsModalProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<VacationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editing, setEditing] = useState<VacationEntry | null>(null);
  const { confirm, DialogComponent } = useConfirmDialog();

  const title = useMemo(() => `Отпуска — ${memberName}`, [memberName]);
  const isLoadingVisible = loading;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetchVacationEntriesForMember({ boardId, memberId })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
      })
      .catch((e) => {
        console.error(e);
        toast.error('Не удалось загрузить отпуска');
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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const patchBoardVacationsCache = (patch: (prev: VacationEntry[]) => VacationEntry[]) => {
    queryClient.setQueryData<VacationEntry[]>(['boardVacations', boardId], (prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return patch(safePrev);
    });
  };

  const renderDays = (v: VacationEntry) => {
    const days = daysInclusive(v.startDate, v.endDate);
    return days != null ? (
      <div className="text-xs text-gray-500 dark:text-gray-300">
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h2>
          </div>
          <HeaderIconButton aria-label="Закрыть" title="Закрыть" onClick={onClose}>
            <Icon className="h-5 w-5" name="close" />
          </HeaderIconButton>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Список отпусков
              </span>
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
              {isLoadingVisible ? (
                <span className="text-xs text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
                  <Icon className="w-4 h-4 animate-spin" name="spinner" />
                  Загрузка…
                </span>
              ) : null}
            </div>

            {!loading && items.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-300">
                Нет отпусков.
              </div>
            ) : null}

            {items.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                {items.map((v) => (
                  <li
                    key={v.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {formatRange(v)}
                      </div>
                      {renderDays(v)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <HeaderIconButton
                        aria-label="Редактировать отпуск"
                        className="!h-9 !w-9 text-gray-500 hover:!bg-gray-100 hover:!text-gray-900 dark:text-gray-300 dark:hover:!bg-gray-700 dark:hover:!text-gray-100"
                        title="Редактировать"
                        onClick={() => {
                          setEditing(v);
                          setUpsertOpen(true);
                        }}
                      >
                        <Icon className="h-4 w-4" name="edit" />
                      </HeaderIconButton>
                      <HeaderIconButton
                        aria-label="Удалить отпуск"
                        className="!h-9 !w-9 text-red-500 hover:!bg-red-50 hover:!text-red-700 dark:text-red-400 dark:hover:!bg-red-900/20 dark:hover:!text-red-200"
                        title="Удалить"
                        onClick={async () => {
                          const ok = await confirm(
                            `Удалить отпуск ${formatRange(v)}?`,
                            { title: 'Удаление отпуска', variant: 'destructive', confirmText: 'Удалить' }
                          );
                          if (!ok) return;
                          try {
                            await deleteVacationEntry({ boardId, id: v.id, memberId });
                            setItems((prev) => prev.filter((x) => x.id !== v.id));
                            patchBoardVacationsCache((prev) => prev.filter((x) => x.id !== v.id));
                            toast.success('Отпуск удалён');
                          } catch (e) {
                            console.error(e);
                            toast.error('Не удалось удалить отпуск');
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
      <VacationUpsertModal
        initial={editing ? { startDate: editing.startDate, endDate: editing.endDate } : null}
        isOpen={upsertOpen}
        title={editing ? 'Редактировать отпуск' : 'Добавить отпуск'}
        onClose={() => setUpsertOpen(false)}
        onSubmit={async ({ startDate, endDate }) => {
          try {
            if (editing) {
              const updated = await updateVacationEntry({
                boardId,
                endDate,
                id: editing.id,
                memberId,
                memberName,
                startDate,
              });
              setItems((prev) =>
                prev
                  .map((x) => (x.id === updated.id ? updated : x))
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              patchBoardVacationsCache((prev) =>
                prev
                  .map((x) => (x.id === updated.id ? updated : x))
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
              );
              toast.success('Отпуск обновлён');
              return;
            }

            const created = await createVacationEntry({
              boardId,
              endDate,
              memberId,
              memberName,
              startDate,
            });
            setItems((prev) => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
            patchBoardVacationsCache((prev) =>
              [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate))
            );
            toast.success('Отпуск добавлен');
          } catch (e) {
            console.error(e);
            toast.error(editing ? 'Не удалось обновить отпуск' : 'Не удалось добавить отпуск');
          }
        }}
      />
      {DialogComponent}
    </>,
    document.body
  );
}

