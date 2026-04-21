'use client';

import type { ChecklistItem } from '@/types/tracker';

import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';

interface GoalItemProps {
  canEdit?: boolean;
  editingText?: string;
  index?: number;
  isEditing?: boolean;
  isUpdating: boolean;
  item: ChecklistItem;
  showCheckbox?: boolean; // Показывать ли чекбокс
  onCancelEdit?: () => void;
  onCheckboxChange?: (checked: boolean) => void;
  // Опциональный для случаев без чекбокса
  onDeleteGoal?: () => void;
  onSaveEdit?: () => void;
  onStartEdit?: () => void;
  onTextChange?: (text: string) => void;
}

export function GoalItem({
  item,
  isUpdating,
  isEditing = false,
  editingText = '',
  canEdit = false,
  index,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTextChange,
  onCheckboxChange,
  onDeleteGoal,
  showCheckbox = true,
}: GoalItemProps) {
  const { t } = useI18n();
  const isNewGoal = item.id.startsWith('new-');

  return (
    <div
      className={`group flex items-start gap-2 py-2 px-0 rounded transition-all ${
        isEditing
          ? 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 -mx-0'
          : ''
      } ${isUpdating ? 'opacity-50' : ''}`}
    >
      {showCheckbox && !isEditing && !isNewGoal && onCheckboxChange && (
        <input
          checked={item.checked}
          className="w-4 h-4 accent-blue-600 dark:accent-blue-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={isUpdating}
          style={{ marginTop: 2 }}
          type="checkbox"
          onChange={(e) => onCheckboxChange(e.target.checked)}
        />
      )}
      {(!showCheckbox || isNewGoal) && !isEditing && <div className="w-4 h-4 flex-shrink-0" style={{ marginTop: 2 }} />}
      {isEditing && onSaveEdit && onCancelEdit && onTextChange ? (
        <div className="flex-1 flex flex-col gap-3 min-w-0 px-3 pt-1 pb-1">
          <input
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 transition-all"
            placeholder={t('sidebar.goalItem.placeholder')}
            type="text"
            value={editingText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              className="px-2 py-1 text-xs"
              title={t('sidebar.goalItem.cancelTitle')}
              type="button"
              variant="secondary"
              onClick={onCancelEdit}
            >
              {t('sidebar.goalItem.cancel')}
            </Button>
            <Button
              className="px-2 py-1 text-xs"
              title={t('sidebar.goalItem.saveTitle')}
              type="button"
              variant="primary"
              onClick={onSaveEdit}
            >
              {t('sidebar.goalItem.save')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span
            className={`flex-1 text-sm leading-relaxed min-w-0 ${
              item.checked
                ? 'text-gray-500 dark:text-gray-400 line-through'
                : 'text-gray-900 dark:text-gray-100'
            } ${canEdit && !isUpdating ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
            title={canEdit && !isUpdating ? t('sidebar.goalItem.clickToEdit') : ''}
            onClick={() => canEdit && !isUpdating && onStartEdit?.()}
          >
            {index != null && index > 0 ? `${index}. ${item.text}` : item.text}
          </span>
          {canEdit && !isUpdating && onStartEdit && onDeleteGoal && (
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <HeaderIconButton
                aria-label={t('sidebar.goalItem.editAria')}
                className="h-8 w-8 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                title={t('sidebar.goalItem.editTitle')}
                type="button"
                onClick={onStartEdit}
              >
                <Icon className="h-4 w-4" name="edit" />
              </HeaderIconButton>
              <HeaderIconButton
                aria-label={t('sidebar.goalItem.deleteAria')}
                className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                title={t('sidebar.goalItem.deleteTitle')}
                type="button"
                onClick={onDeleteGoal}
              >
                <Icon className="h-4 w-4" name="trash" />
              </HeaderIconButton>
            </div>
          )}
          {isUpdating && (
            <div className="flex items-center flex-shrink-0">
              <Icon className="animate-spin h-4 w-4 text-gray-400 dark:text-gray-500" name="spinner" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
