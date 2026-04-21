/**
 * Компонент бейджа статуса спринта
 */

interface DaysHeaderStatusBadgeProps {
  archived: boolean;
  status: string;
}

export function DaysHeaderStatusBadge({ status, archived }: DaysHeaderStatusBadgeProps) {
  if (archived) {
    return (
      <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
        Архив
      </span>
    );
  }

  switch (status) {
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
          В работе
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700">
          Завершен
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
          Черновик
        </span>
      );
    default:
      return null;
  }
}

