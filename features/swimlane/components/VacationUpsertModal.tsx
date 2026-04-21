'use client';

import type { VacationEntry } from '@/types/quarterly';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';

export interface VacationUpsertModalSubmitArgs {
  endDate: string;
  startDate: string;
}

export interface VacationUpsertModalProps {
  initial?: Pick<VacationEntry, 'endDate' | 'startDate'> | null;
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (args: VacationUpsertModalSubmitArgs) => Promise<void> | void;
}

export function VacationUpsertModal({
  initial = null,
  isOpen,
  title,
  onClose,
  onSubmit,
}: VacationUpsertModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStartDate(initial?.startDate ?? '');
    setEndDate(initial?.endDate ?? '');
  }, [isOpen, initial?.endDate, initial?.startDate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const canSubmit = Boolean(startDate && endDate) && !submitting;

  const submitLabel = useMemo(() => (initial ? 'Сохранить' : 'Добавить'), [initial]);

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70 cursor-pointer"
      style={{ zIndex: ZIndex.modalBackdrop }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h3>
          <HeaderIconButton aria-label="Закрыть" title="Закрыть" onClick={onClose}>
            <Icon className="h-5 w-5" name="close" />
          </HeaderIconButton>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Начало</span>
              <input
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 cursor-text"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-300">Конец</span>
              <input
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 cursor-text"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              className="!h-10 hover:!bg-gray-100 dark:hover:!bg-gray-700"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              className="!h-10"
              disabled={!canSubmit}
              type="button"
              variant="primary"
              onClick={async () => {
                if (!startDate || !endDate) return;
                setSubmitting(true);
                try {
                  await onSubmit({ startDate, endDate });
                  onClose();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? <Icon className="h-4 w-4 animate-spin" name="spinner" /> : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

