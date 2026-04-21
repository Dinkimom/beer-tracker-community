'use client';

/**
 * Компонент кнопки удаления CommentCard
 */

import { Button } from '@/components/Button';
import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

interface CommentCardDeleteButtonProps {
  onDelete: (e: React.MouseEvent) => void;
}

export function CommentCardDeleteButton({ onDelete }: CommentCardDeleteButtonProps) {
  const { t } = useI18n();
  return (
    <Button
      aria-label={t('comments.deleteAria')}
      className="pointer-events-auto absolute -right-1 -top-1 !h-4 !w-4 !min-h-0 !min-w-0 !justify-center !gap-0 !rounded-sm !border !border-yellow-300 !bg-yellow-100 !p-0 !text-[10px] !font-bold !leading-none !shadow-sm text-gray-600 !transition-colors duration-200 hover:!border-red-400 hover:!bg-red-100 hover:!text-red-700 focus-visible:!ring-1 focus-visible:!ring-red-500 dark:!border-yellow-600 dark:!bg-yellow-800 dark:text-gray-300 dark:hover:!border-red-600 dark:hover:!bg-red-900 dark:hover:!text-red-400"
      style={{ zIndex: ZIndex.overlay }}
      type="button"
      variant="ghost"
      onClick={onDelete}
    >
      ×
    </Button>
  );
}

