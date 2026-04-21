/**
 * Компонент индикатора загрузки для ContextMenu
 */

import { Icon } from '@/components/Icon';
import { CONTEXT_MENU_ITEM_ROW, CONTEXT_MENU_SEPARATOR } from '@/features/context-menu/contextMenuClasses';

interface ContextMenuLoadingProps {
  isLoading: boolean;
}

export function ContextMenuLoading({ isLoading }: ContextMenuLoadingProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <>
      <div className={CONTEXT_MENU_SEPARATOR} role="separator" />
      <div
        className={`${CONTEXT_MENU_ITEM_ROW} cursor-default text-xs font-normal text-gray-500 dark:text-gray-400`}
      >
        <Icon className="h-4 w-4 shrink-0 animate-spin" name="spinner" />
        <span>Обработка...</span>
      </div>
    </>
  );
}

