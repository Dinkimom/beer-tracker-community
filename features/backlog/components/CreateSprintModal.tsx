'use client';

import type { SprintListItem } from '@/types/tracker';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { useI18n } from '@/contexts/LanguageContext';
import { ZIndex } from '@/constants';

// Спринты всегда длятся 2 недели
const SPRINT_DURATION_WEEKS = 2;

interface CreateSprintModalProps {
  isOpen: boolean;
  sprints: SprintListItem[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7 - 1);
  return result;
}

/**
 * Генерирует следующее название спринта на основе последнего.
 * Формат названий: "Prefix ГГНН" где ГГ - год, НН - номер.
 * Например: "Booking 2501" → "Booking 2502"
 */
function generateNextSprintName(sprints: SprintListItem[], copySuffix: string): string {
  if (sprints.length === 0) {
    const year = new Date().getFullYear() % 100;
    return `Sprint ${year}01`;
  }

  const sortedSprints = [...sprints].sort((a, b) => b.id - a.id);
  const lastSprint = sortedSprints[0];
  const lastName = lastSprint.name;

  const match = lastName.match(/^(.+?)(\d{4})$/);

  if (match) {
    const prefix = match[1].trim();
    const numberPart = parseInt(match[2], 10);
    const nextNumber = numberPart + 1;
    return `${prefix} ${nextNumber}`;
  }

  return `${lastName} (${copySuffix})`;
}

export function CreateSprintModal({
  isOpen,
  onClose,
  onSubmit,
  sprints,
}: CreateSprintModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endDate = useMemo(() => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = addWeeks(start, SPRINT_DURATION_WEEKS);
    return formatDateForInput(end);
  }, [startDate]);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);

      setStartDate(formatDateForInput(nextMonday));
      setName(generateNextSprintName(sprints, t('backlog.createSprintModal.nameCopySuffix')));
    }
  }, [isOpen, sprints, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        startDate,
        endDate,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create sprint:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70"
      style={{ zIndex: ZIndex.modalBackdrop }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">
              {t('backlog.createSprintModal.title')}
            </h2>

            {/* Название спринта */}
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                htmlFor="sprint-name"
              >
                {t('backlog.createSprintModal.sprintNameLabel')}
              </label>
              <Input
                autoFocus
                className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                id="sprint-name"
                placeholder={t('backlog.createSprintModal.namePlaceholder')}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Начало — конец (спринт всегда 2 недели) */}
            <div className="mb-5">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                {t('backlog.createSprintModal.dateRangeLabel')}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Input
                    className="px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <span className="text-gray-500 dark:text-gray-400">—</span>
                <div className="relative flex-1">
                  <Input
                    className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed [&::-webkit-calendar-picker-indicator]:hidden"
                    readOnly
                    title={t('backlog.createSprintModal.endDateTitle', {
                      date: formatDateForDisplay(endDate),
                    })}
                    type="date"
                    value={endDate}
                  />
                </div>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3">
              <Button
                className="flex-1 py-2.5 text-sm disabled:cursor-not-allowed"
                disabled={isSubmitting}
                fullWidth
                variant="secondary"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={!name.trim() || !startDate || isSubmitting}
                fullWidth
                type="submit"
                variant="primary"
              >
                {isSubmitting && (
                  <Icon className="w-4 h-4 animate-spin" name="spinner" />
                )}
                {t('backlog.createSprintModal.submit')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
