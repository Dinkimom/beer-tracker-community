'use client';

import { Avatar } from '@/components/Avatar';
import { DEVELOPER_COLUMN_WIDTH, ZIndex } from '@/constants';
import { getInitials } from '@/utils/displayUtils';

interface DeveloperHeaderProps {
  /** Доп. действия справа (например, кнопка меню) */
  actions?: React.ReactNode;
  /** URL фото профиля; при отсутствии показываются инициалы */
  avatarUrl?: string | null;
  /** Сделано SP (для прогресса) */
  completedSP?: number;
  completedTP?: number;
  developerName: string;
  percentSP?: number;
  percentTP?: number;
  /** Роль: для разработчика показываем только SP, для тестировщика — только TP */
  role?: 'developer' | 'other' | 'tester';
  /** Показывать прогресс (сделано/всего и %). Если false — только объём. */
  showProgress?: boolean;
  totalSP: number;
  totalTP: number;
  /** Ширина колонки в px; по умолчанию DEVELOPER_COLUMN_WIDTH */
  width?: number;
}

export function DeveloperHeader({
  actions,
  avatarUrl,
  developerName,
  totalSP,
  totalTP,
  completedSP = 0,
  completedTP = 0,
  percentSP = 0,
  percentTP = 0,
  role,
  showProgress = false,
  width = DEVELOPER_COLUMN_WIDTH,
}: DeveloperHeaderProps) {
  const isTester = role === 'tester';
  const showSP = !isTester && totalSP > 0;
  const showTP = isTester && totalTP > 0;
  const hasPoints = showSP || showTP;

  const spContent = showProgress
    ? `${completedSP}/${totalSP} (${percentSP}%)`
    : `${totalSP}`;

  const tpContent = showProgress
    ? `${completedTP}/${totalTP} (${percentTP}%)`
    : `${totalTP}`;

  return (
    <div
      className="group relative flex-shrink-0 sticky left-0 border-r-1 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 py-3 flex items-center"
      style={{
        width,
        minWidth: width,
        paddingLeft: '24px',
        paddingRight: '16px',
        zIndex: ZIndex.stickyLeftColumn,
      }}
    >
      {actions ? (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      ) : null}
      <div className="flex flex-col gap-1 w-full min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
          <Avatar
            avatarUrl={avatarUrl}
            initials={getInitials(developerName)}
            size="lg"
            title={developerName}
          />
          <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate min-w-0" title={developerName}>
            {developerName}
          </span>
        </div>
          <div className="flex items-center gap-2 text-xs tabular-nums text-gray-500 dark:text-gray-300 flex-shrink-0">
            {hasPoints ? (
              <>
                {showSP && (
                  <span title={showProgress ? 'Story points: сделано / всего' : 'Story points'}>
                    {spContent}
                  </span>
                )}
                {showTP && (
                  <span title={showProgress ? 'Test points: сделано / всего' : 'Test points'}>
                    {tpContent}
                  </span>
                )}
                {!hasPoints && (
                  <span className="text-gray-500 dark:text-gray-400">Нет задач</span>
                )}
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Нет задач</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
