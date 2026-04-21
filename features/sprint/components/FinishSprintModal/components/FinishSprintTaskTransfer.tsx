/**
 * Компонент выбора переноса задач при завершении спринта
 */

import type { MoveTasksTo } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { Select } from '@/components/Select';

import { FinishSprintMoveTasksRadio } from './FinishSprintMoveTasksRadio';
import { formatDraftSprintOptionLabel } from './finishSprintTaskTransferHelpers';

interface FinishSprintTaskTransferProps {
  draftSprints: SprintListItem[];
  isDark: boolean;
  moveTasksTo: MoveTasksTo;
  selectedSprintId: number | null;
  onMoveTasksToChange: (value: MoveTasksTo) => void;
  onSelectedSprintIdChange: (sprintId: number | null) => void;
}

export function FinishSprintTaskTransfer({
  draftSprints,
  isDark,
  moveTasksTo,
  selectedSprintId,
  onMoveTasksToChange,
  onSelectedSprintIdChange,
}: FinishSprintTaskTransferProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Перенести незавершенные задачи
      </h3>
      <div className="space-y-3">
        <FinishSprintMoveTasksRadio
          checked={moveTasksTo === 'backlog'}
          isDark={isDark}
          label="В бэклог"
          name="moveTasksTo"
          value="backlog"
          onSelect={() => {
            onMoveTasksToChange('backlog');
            onSelectedSprintIdChange(null);
          }}
        />
        <FinishSprintMoveTasksRadio
          checked={moveTasksTo === 'sprint'}
          isDark={isDark}
          label="В спринт"
          name="moveTasksTo"
          value="sprint"
          onSelect={() => onMoveTasksToChange('sprint')}
        />
        {moveTasksTo === 'sprint' && (
          <div className="ml-6">
            <Select
              className="py-2 text-sm rounded-md focus:ring-2 focus:ring-blue-500"
              value={selectedSprintId || ''}
              onChange={(e) =>
                onSelectedSprintIdChange(e.target.value ? parseInt(e.target.value, 10) : null)
              }
            >
              <option value="">Выберите спринт</option>
              {draftSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {formatDraftSprintOptionLabel(sprint)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
