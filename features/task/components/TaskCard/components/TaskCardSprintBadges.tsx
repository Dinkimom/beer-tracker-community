import { Icon } from '@/components/Icon';

interface TaskCardSprintBadgesProps {
  isLocalTask?: boolean;
  sprintBadge?: { display: string; id: string } | null;
}

export function TaskCardSprintBadges({ sprintBadge, isLocalTask }: TaskCardSprintBadgesProps) {
  if (!sprintBadge && !isLocalTask) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
      {isLocalTask && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 border-dashed">
          <Icon className="w-3 h-3" name="edit" />
          Драфт
        </span>
      )}
      {sprintBadge && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
          <Icon className="w-3 h-3" name="calendar" />
          {sprintBadge.display}
        </span>
      )}
    </div>
  );
}
