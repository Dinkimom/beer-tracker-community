'use client';

import type { SprintScoreRow } from '@/app/api/sprints/[sprintId]/score/route';
import type { AppLanguage } from '@/lib/i18n/model';

import { useQuery } from '@tanstack/react-query';

import { useI18n } from '@/contexts/LanguageContext';
import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { fetchSprintScore } from '@/lib/api/sprints';

interface SprintScoreBlockProps {
  sprintId: number;
}

function ScoreMetricBar({
  label,
  value,
  completed,
  total,
  colorClass,
}: {
  colorClass: { bar: string; text: string };
  completed: number;
  label: string;
  total: number;
  value: number;
}) {
  const pct = Math.min(100, value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${colorClass.text}`}>
          {label}
        </span>
        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400 shrink-0">
          {completed}/{total}
          <span className="ml-1.5 font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
        </span>
      </div>
      <div
        aria-label={`${label}: ${pct}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={pct}
        className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${colorClass.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function scoreBadgeToneClass(mark: number): string {
  if (mark > 4) return 'text-green-600 dark:text-green-400';
  if (mark > 2) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ScoreBadge({ mark, language }: { language: AppLanguage; mark: number }) {
  const text = scoreBadgeToneClass(mark);
  const label = language === 'en' ? `${mark} of 6 points` : `${mark} из 6 баллов`;

  return (
    <div className="">
      <span className={`text-sm font-bold tabular-nums ${text}`}>
        {label}
      </span>
    </div>
  );
}

function TeamRows({
  hideTp,
  rows,
  goalsLabel,
}: {
  goalsLabel: string;
  hideTp: boolean;
  rows: SprintScoreRow[];
}) {
  return (
    <>
      {rows.map((row, index) => (
        <div key={`${row.sprint_id}-${row.team}`}>
          {index > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-3" />
          )}
          <div className="space-y-4">
            <ScoreMetricBar
              colorClass={{ bar: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300' }}
              completed={Number(row.goals_done)}
              label={goalsLabel}
              total={Number(row.goals_total)}
              value={row.goals_percent}
            />
            <ScoreMetricBar
              colorClass={{ bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' }}
              completed={row.sp_done}
              label="SP"
              total={row.sp_total}
              value={row.sp_done_percent}
            />
            {!hideTp && row.qa_total > 0 && (
              <ScoreMetricBar
                colorClass={{ bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' }}
                completed={row.qa_done}
                label="TP"
                total={row.qa_total}
                value={row.tp_done_percent}
              />
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function SprintScoreBlock({ sprintId }: SprintScoreBlockProps) {
  const { language, t } = useI18n();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();
  const { data, isLoading, isError } = useQuery({
    queryKey: forDemoPlanner
      ? (['sprintScore', 'demo', sprintId] as const)
      : (['sprintScore', sprintId] as const),
    queryFn: () => fetchSprintScore(sprintId),
    staleTime: 5 * 60 * 1000,
    enabled: sprintId > 0,
  });

  const rows = data?.rows ?? [];
  const hideTp = data?.testingFlowMode === 'standalone_qa_tasks';

  return (
    <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('sidebar.sprintScoreBlock.heading')}
        </h2>
        {rows[0] && <ScoreBadge language={language} mark={rows[0].mark} />}
      </div>

      {isLoading && (
        <div className="text-sm text-gray-400 dark:text-gray-500">{t('sidebar.sprintScoreBlock.loading')}</div>
      )}

      {isError && (
        <div className="text-sm text-red-500 dark:text-red-400">{t('sidebar.sprintScoreBlock.loadError')}</div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {t('sidebar.sprintScoreBlock.emptyNotStarted')}
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <TeamRows goalsLabel={t('sidebar.sprintScoreBlock.goalsMetricLabel')} hideTp={hideTp} rows={rows} />
      )}
    </div>
  );
}
