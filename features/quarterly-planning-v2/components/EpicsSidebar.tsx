'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { formatEpicCountLabel } from '@/lib/i18n/epicCountLabel';
import { StatusTag } from '@/components/StatusTag';
import { formatQuarterYear, getQuarterAndYear } from '@/features/quarterly-planning-v2/utils/quarterGrouping';

const TRACKER_ISSUE_URL = 'https://tracker.yandex.ru';

interface QuarterGroup {
  epics: Array<{ id: string; name?: string; createdAt: string; originalStatus?: string; status?: string }>;
  quarter: number;
  year: number;
}

function groupEpicsByQuarter(epics: Array<{ id: string; name?: string; createdAt: string; originalStatus?: string; status?: string }>): QuarterGroup[] {
  const byQuarter = new Map<string, QuarterGroup['epics']>();
  epics.forEach((epic) => {
    const createdAt = new Date(epic.createdAt);
    const { quarter, year } = getQuarterAndYear(createdAt);
    const key = `${year}-Q${quarter}`;
    if (!byQuarter.has(key)) byQuarter.set(key, []);
    byQuarter.get(key)!.push(epic);
  });
  const result: QuarterGroup[] = [];
  byQuarter.forEach((epicsInQuarter, key) => {
    const [year, quarter] = key.split('-Q').map(Number);
    result.push({ year, quarter, epics: epicsInQuarter });
  });
  result.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter - a.quarter;
  });
  return result;
}

interface EpicsSidebarProps {
  /** Все эпики доски (опционально; сейчас может быть пусто) */
  epics: Array<{ id: string; name?: string; createdAt: string; originalStatus?: string; status?: string }>;
  /** Ключи эпиков, уже добавленных в план */
  planEpicKeys: Set<string>;
  onAddEpic: (epicKey: string) => void;
}

export function EpicsSidebar({ epics, planEpicKeys, onAddEpic }: EpicsSidebarProps) {
  const { t } = useI18n();
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set());

  const availableEpics = useMemo(
    () => epics.filter((f) => !planEpicKeys.has(f.id)),
    [epics, planEpicKeys]
  );

  const quarterGroups = useMemo(() => groupEpicsByQuarter(availableEpics), [availableEpics]);

  const toggleQuarter = (quarterKey: string) => {
    setCollapsedQuarters((prev) => {
      const next = new Set(prev);
      if (next.has(quarterKey)) next.delete(quarterKey);
      else next.add(quarterKey);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-4">
        {availableEpics.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
            {epics.length === 0
              ? t('planning.quarterlyV2.sidebarEmptyNoEpicsOnBoard')
              : t('planning.quarterlyV2.sidebarEmptyAllInPlan')}
          </div>
        ) : (
          quarterGroups.map((group) => {
            const quarterKey = `${group.year}-Q${group.quarter}`;
            const isCollapsed = collapsedQuarters.has(quarterKey);
            const count = group.epics.length;
            return (
              <div key={quarterKey} className="space-y-1">
                <Button
                  className="group h-auto min-h-0 w-full justify-start gap-2 bg-gray-100/80 px-2 py-2 text-left font-normal hover:bg-gray-200/80 dark:bg-gray-700/40 dark:hover:bg-gray-700/60"
                  type="button"
                  variant="ghost"
                  onClick={() => toggleQuarter(quarterKey)}
                >
                  <Icon
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    name="chevron-right"
                  />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {formatQuarterYear(group.quarter, group.year)}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-gray-600/50">
                    {formatEpicCountLabel(count, t)}
                  </span>
                </Button>
                {!isCollapsed && (
                  <div>
                    {group.epics.map((epic) => (
                      <div
                        key={epic.id}
                        className="px-2 py-2 pl-3 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                              href={`${TRACKER_ISSUE_URL}/${epic.id}`}
                              rel="noopener noreferrer"
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {epic.id}
                            </a>
                            {(epic.originalStatus ?? epic.status) && (
                              <StatusTag
                                className="shrink-0 text-[10px]"
                                status={epic.originalStatus ?? epic.status}
                              />
                            )}
                          </div>
                          <span className="block text-sm text-gray-800 dark:text-gray-200 truncate mt-1">
                            {epic.name ?? epic.id}
                          </span>
                        </div>
                        <HeaderIconButton
                          aria-label={t('planning.quarterlyV2.addEpicToPlanAria')}
                          className="h-8 w-8 shrink-0"
                          title={t('planning.quarterlyV2.addEpicToPlanTitle')}
                          type="button"
                          onClick={() => onAddEpic(epic.id)}
                        >
                          <Icon className="h-4 w-4" name="plus" />
                        </HeaderIconButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
