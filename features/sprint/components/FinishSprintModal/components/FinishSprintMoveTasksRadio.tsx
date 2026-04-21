import type { MoveTasksTo } from '@/types';

import {
  finishSprintMoveTasksRadioClassName,
  finishSprintMoveTasksRadioStyle,
} from './finishSprintTaskTransferHelpers';

interface FinishSprintMoveTasksRadioProps {
  checked: boolean;
  isDark: boolean;
  label: string;
  name: string;
  value: MoveTasksTo;
  onSelect: () => void;
}

export function FinishSprintMoveTasksRadio({
  checked,
  isDark,
  label,
  name,
  value,
  onSelect,
}: FinishSprintMoveTasksRadioProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        checked={checked}
        className={finishSprintMoveTasksRadioClassName(isDark, checked)}
        name={name}
        style={finishSprintMoveTasksRadioStyle(isDark, checked)}
        type="radio"
        value={value}
        onChange={onSelect}
      />
      <span className="text-sm text-gray-900 dark:text-gray-100">{label}</span>
    </label>
  );
}
