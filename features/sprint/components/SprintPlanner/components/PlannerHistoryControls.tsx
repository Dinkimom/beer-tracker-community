'use client';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';

export interface PlannerHistoryControlsProps {
  canRedo: boolean;
  canUndo: boolean;
  className?: string;
  onRedo: () => void;
  onUndo: () => void;
}

export function PlannerHistoryControls({
  canRedo,
  canUndo,
  className = '',
  onRedo,
  onUndo,
}: PlannerHistoryControlsProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/90 ${className}`}
    >
      <Button
        aria-label="Отменить изменение плана"
        className="!min-h-0 !px-2 !py-1.5 text-gray-600 hover:!text-gray-900 dark:text-gray-300 dark:hover:!text-white"
        disabled={!canUndo}
        title="Отменить изменение плана"
        type="button"
        variant="ghost"
        onClick={onUndo}
      >
        <Icon className="h-4 w-4" name="undo" />
      </Button>
      <Button
        aria-label="Вернуть изменение плана"
        className="!min-h-0 !px-2 !py-1.5 text-gray-600 hover:!text-gray-900 dark:text-gray-300 dark:hover:!text-white"
        disabled={!canRedo}
        title="Вернуть изменение плана"
        type="button"
        variant="ghost"
        onClick={onRedo}
      >
        <Icon className="h-4 w-4" name="redo" />
      </Button>
    </div>
  );
}
