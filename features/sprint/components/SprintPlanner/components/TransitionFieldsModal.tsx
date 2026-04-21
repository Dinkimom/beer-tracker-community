'use client';

import type { TransitionField } from '@/lib/beerTrackerApi';
import type { Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { Input } from '@/components/Input';
import { TextArea } from '@/components/TextArea';
import { ZIndex } from '@/constants';
import { SprintSelector } from '@/features/sprint/components/SprintSelector';
import { TRANSITION_FIELD_ID_TO_TASK_KEY } from '@/features/sprint/utils/mergeTransitionFieldsIntoTask';
import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';

import { UserSelector } from './UserSelector';

interface TransitionFieldsModalProps {
  fields: TransitionField[];
  isOpen: boolean;
  sprints?: SprintListItem[];
  targetStatusDisplay?: string;
  task?: Task | null;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

function getTaskFieldValue(task: Task | null | undefined, fieldId: string): string {
  if (!task) return '';
  const taskKey = TRANSITION_FIELD_ID_TO_TASK_KEY[fieldId] ?? fieldId;
  const v = (task as unknown as Record<string, unknown>)[taskKey];
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  // array: sprint/sprints — [{ id, display }], bizErpTeam/productTeam — [string]
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    return typeof first === 'object' && first !== null && 'id' in first
      ? String((first as { id: string }).id)
      : String(first);
  }
  return '';
}

export function TransitionFieldsModal({
  fields,
  isOpen,
  sprints = [],
  task,
  targetStatusDisplay,
  onClose,
  onSubmit,
}: TransitionFieldsModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Проставляем значения из задачи при открытии модалки
  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const v = getTaskFieldValue(task, f.id);
      if (v) initial[f.id] = v;
    }
    setValues(initial);
  }, [isOpen, task, fields]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const required = fields.filter((f) => f.required);
      const missing = required.filter((f) => !values[f.id]?.trim());
      if (missing.length > 0) {
        setError(`Заполните обязательные поля: ${missing.map((f) => f.display).join(', ')}`);
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {};
        for (const f of fields) {
          const v = values[f.id];
          if (v === undefined || v === '') continue;
          // sprint — Tracker ожидает [{ id: string }]
          if (f.id === 'sprint' && f.schemaType === 'array') {
            body[f.id] = [{ id: v }];
          } else if (f.schemaType === 'array') {
            body[f.id] = [v];
          } else {
            body[f.id] = v;
          }
        }
        await onSubmit(body);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка при переходе');
      } finally {
        setIsSubmitting(false);
      }
    },
    [fields, values, onSubmit, onClose]
  );

  if (!isOpen) return null;

  const inputClassName = 'mt-1 block min-h-[38px] rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:ring-blue-500';

  const renderField = (field: TransitionField) => {
    const value = values[field.id] ?? '';
    const schemaType = field.schemaType;
    const options = field.options;

    // Поля со списком значений — CustomSelect
    if (options && options.length > 0) {
      const selectOptions = [{ label: '— выбрать —', value: '' }, ...options.map((opt) => ({ label: opt, value: opt }))];
      return (
        <CustomSelect<string>
          key={field.id}
          className="mt-1 w-full"
          options={selectOptions}
          title={field.display}
          value={value}
          onChange={(v) => handleChange(field.id, v)}
        />
      );
    }

    // string, comment — textarea для многострочного
    if (field.id === 'comment' || schemaType === 'string') {
      const isLongText = field.id === 'comment' || (schemaType === 'string' && field.display?.toLowerCase().includes('коммент'));
      if (isLongText) {
        return (
          <TextArea
            key={field.id}
            className={inputClassName}
            placeholder={field.display}
            required={field.required}
            rows={3}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
          />
        );
      }
    }

    // date
    if (schemaType === 'date') {
      return (
        <Input
          key={field.id}
          className={inputClassName}
          placeholder={field.display}
          required={field.required}
          type="date"
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
        />
      );
    }

    // sprint — селектор спринта (спринты текущей доски)
    if (field.id === 'sprint') {
      const sprintId = value ? parseInt(value, 10) : null;
      return (
        <SprintSelector
          key={field.id}
          className="mt-1 w-full"
          inModal
          selectedSprintId={Number.isNaN(sprintId) ? null : sprintId}
          sprints={sprints}
          onSprintChange={(id) => handleChange(field.id, id !== null ? String(id) : '')}
        />
      );
    }

    // user — селектор пользователя (поиск по имени, загрузка по ID из задачи)
    if (schemaType === 'user') {
      return (
        <UserSelector
          key={field.id}
          className="mt-1 w-full"
          placeholder="— выбрать —"
          title={field.display}
          value={value}
          onChange={(v) => handleChange(field.id, v)}
        />
      );
    }

    // float, integer
    if (schemaType === 'float' || schemaType === 'integer') {
      return (
        <Input
          key={field.id}
          className={inputClassName}
          placeholder={field.display}
          required={field.required}
          step={schemaType === 'float' ? 'any' : 1}
          type="number"
          value={value}
          onChange={(e) => handleChange(field.id, e.target.value)}
        />
      );
    }

    // resolution и др. — text input
    return (
      <Input
        key={field.id}
        className={inputClassName}
        placeholder={field.display}
        required={field.required}
        type="text"
        value={value}
        onChange={(e) => handleChange(field.id, e.target.value)}
      />
    );
  };

  return (
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {targetStatusDisplay || 'Поля перехода'}
            </h2>
            {task && (
              <div className="mb-4">
                <TaskCard
                  className="pointer-events-auto"
                  isContextMenuOpen={false}
                  isDragging={false}
                  isResizing={false}
                  isSelected={false}
                  task={task}
                  variant="sidebar"
                  widthPercent={100}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              </div>
            )}
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.id}>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor={field.id}
                  >
                    {field.display}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderField(field)}
                </div>
              ))}
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <Button className="text-sm rounded-md" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button
              className="text-sm rounded-md disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
              variant="primary"
            >
              {isSubmitting ? 'Сохранение…' : 'Выполнить переход'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
