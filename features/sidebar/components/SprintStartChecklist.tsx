'use client';

/**
 * Sprint start checklist in the sidebar (Goals tab).
 */

import type { Developer } from '@/types';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';

function invalidTasksRuNoun(count: number, t: (key: string) => string): string {
  const n = count;
  const one = n % 10 === 1 && n % 100 !== 11;
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20);
  return one
    ? t('sidebar.sprintStartChecklist.invalidTasksRu1')
    : few
      ? t('sidebar.sprintStartChecklist.invalidTasksRu234')
      : t('sidebar.sprintStartChecklist.invalidTasksRuMany');
}

interface SprintStartChecklistProps {
  check1Passed: boolean;
  check2Passed: boolean;
  check3Passed: boolean;
  developerLoads: Array<{
    dev: Pick<Developer, 'id' | 'name' | 'role'>;
    isDeveloper: boolean;
    isQA: boolean;
    totalSP: number;
    totalTP: number;
  }>;
  invalidTasks: Array<{ task: unknown; issues: unknown[] }>;
}

function CheckItem({
  passed,
  title,
  children,
}: {
  passed: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-l-4 py-2.5 px-3 ${
        passed
          ? 'bg-green-50 dark:bg-green-900/25 border-green-200 dark:border-green-800 border-l-green-600 dark:border-l-green-500'
          : 'bg-red-50 dark:bg-red-900/25 border-red-200 dark:border-red-800 border-l-red-600 dark:border-l-red-500'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
            {title}
          </p>
          {children && (
            <div className="text-xs text-gray-900 dark:text-gray-100 mt-1.5 leading-relaxed">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SprintStartChecklist({
  check1Passed,
  check2Passed,
  check3Passed,
  developerLoads,
  invalidTasks,
}: SprintStartChecklistProps) {
  const { language, t } = useI18n();
  const { setMainTab } = useTaskSidebar();

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-4 pt-4 pb-2 flex-shrink-0 bg-white dark:bg-gray-800">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {t('sidebar.sprintStartChecklist.heading')}
      </h3>
      <div className="space-y-2">
        <CheckItem passed={check1Passed} title={t('sidebar.sprintStartChecklist.check1Title')} />

        <CheckItem passed={check2Passed} title={t('sidebar.sprintStartChecklist.check2Title')}>
          {!check2Passed && (
            <>
              <ul className="list-none pl-0 mt-0 space-y-0.5">
                {developerLoads
                  .filter((load) => {
                    const isTester = load.dev.role === 'tester';
                    if (isTester) return load.totalTP !== 30;
                    return load.totalSP !== 20;
                  })
                  .map((load) => {
                    const isTester = load.dev.role === 'tester';
                    return (
                      <li key={`${load.dev.id}-${isTester ? 'qa' : 'dev'}`}>
                        - {load.dev.name}:{' '}
                        {isTester ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {t('sidebar.sprintStartChecklist.devLoadTpRequired', {
                              actual: load.totalTP,
                            })}
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {t('sidebar.sprintStartChecklist.devLoadSpRequired', {
                              actual: load.totalSP,
                            })}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </CheckItem>

        <CheckItem passed={check3Passed} title={t('sidebar.sprintStartChecklist.check3Title')}>
          {!check3Passed && (
            <>
              {language === 'en' ? (
                <>
                  {t('sidebar.sprintStartChecklist.check3IntroEn')}
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {invalidTasks.length === 1
                      ? t('sidebar.sprintStartChecklist.invalidDetailOne')
                      : t('sidebar.sprintStartChecklist.invalidDetailMany', {
                          count: invalidTasks.length,
                        })}
                  </span>
                  .{' '}
                </>
              ) : (
                <>
                  {invalidTasks.length === 1
                    ? t('sidebar.sprintStartChecklist.check3IntroRuFem')
                    : t('sidebar.sprintStartChecklist.check3IntroRuNeut')}
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {invalidTasks.length === 1 ? '1' : invalidTasks.length}{' '}
                    {invalidTasksRuNoun(invalidTasks.length, t)}
                  </span>
                  .{' '}
                </>
              )}
              <Button
                className="h-auto min-h-0 p-0 text-xs text-blue-600 underline-offset-2 hover:bg-transparent hover:underline dark:text-blue-400"
                type="button"
                variant="ghost"
                onClick={() => setMainTab('invalid')}
              >
                {t('sidebar.sprintStartChecklist.openInvalidTab')}
              </Button>
            </>
          )}
        </CheckItem>
      </div>
    </div>
  );
}
