'use client';

import type {
  PlatformMappingFilter,
  PlatformValueMapFormRow,
} from '../types';

import { useMemo } from 'react';

import {
  CustomSelect,
  type CustomSelectOption,
} from '@/components/CustomSelect';
import { useI18n } from '@/contexts/LanguageContext';

const PLATFORM_SELECT_OPTIONS: CustomSelectOption<string>[] = [
  { label: 'frontend', value: 'Web' },
  { label: 'backend', value: 'Back' },
  { label: 'qa', value: 'QA' },
  { label: 'mobile', value: 'DevOps' },
];

export interface TrackerPlatformMappingRow {
  changed: boolean;
  trackerValue: string;
  unmapped: boolean;
}

export interface TrackerPlatformMappingPanelProps {
  labelClass: string;
  mappingFieldSelectOptions: CustomSelectOption<string>[];
  mutedClass: string;
  platformFieldId: string;
  platformFieldValues: string[];
  platformMappingFilter: PlatformMappingFilter;
  platformValueMap: PlatformValueMapFormRow[];
  stats: { changed: number; unmapped: number };
  tabBtnBase: string;
  tabBtnIdle: string;
  visibleRows: TrackerPlatformMappingRow[];
  onPlatformFieldChange: (fieldId: string) => void;
  onPlatformMappingFilterChange: (filter: PlatformMappingFilter) => void;
  onRowPlatformChange: (trackerValue: string, platform: string) => void;
}

export function TrackerPlatformMappingPanel({
  labelClass,
  mappingFieldSelectOptions,
  mutedClass,
  onPlatformFieldChange,
  onPlatformMappingFilterChange,
  onRowPlatformChange,
  platformFieldId,
  platformFieldValues,
  platformMappingFilter,
  platformValueMap,
  stats,
  tabBtnBase,
  tabBtnIdle,
  visibleRows,
}: TrackerPlatformMappingPanelProps) {
  const { t } = useI18n();

  const platformSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    return [
      {
        label: t('admin.plannerIntegration.platformMapping.doNotMap'),
        value: '',
      },
      ...PLATFORM_SELECT_OPTIONS,
    ];
  }, [t]);

  const filterTabs = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('admin.plannerIntegration.platformMapping.filterAll') },
        {
          id: 'problematic' as const,
          label: t('admin.plannerIntegration.platformMapping.filterUnmapped', {
            count: stats.unmapped,
          }),
        },
        {
          id: 'changed' as const,
          label: t('admin.plannerIntegration.platformMapping.filterChanged', {
            count: stats.changed,
          }),
        },
      ] as const,
    [stats.changed, stats.unmapped, t],
  );

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('admin.plannerIntegration.platformMapping.title')}
      </h3>
      <p className={`mt-0.5 text-xs ${mutedClass}`}>
        {t('admin.plannerIntegration.platformMapping.subtitle')}
      </p>
      <div className="mt-3">
        <div className={labelClass}>
          {t('admin.plannerIntegration.platformMapping.platformFieldLabel')}
        </div>
        <CustomSelect
          className="w-full"
          options={mappingFieldSelectOptions}
          searchPlaceholder={t(
            'admin.plannerIntegration.platformMapping.platformFieldSearch',
          )}
          searchable
          title={t('admin.plannerIntegration.platformMapping.platformFieldTitle')}
          value={platformFieldId}
          onChange={(v) => {
            onPlatformFieldChange(v);
          }}
        />
      </div>
      {platformFieldId ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200/80 bg-white/60 p-3 dark:border-gray-700 dark:bg-gray-950/20">
          <div className="space-y-2">
            {platformFieldValues.length === 0 ? (
              <p className={`text-xs ${mutedClass}`}>
                {t('admin.plannerIntegration.platformMapping.valuesLoadFailed')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {filterTabs.map((opt) => (
                    <button
                      key={opt.id}
                      className={`${tabBtnBase} px-2.5 py-1.5 text-xs ${
                        platformMappingFilter === opt.id
                          ? 'border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                          : `${tabBtnIdle} border border-transparent`
                      }`}
                      type="button"
                      onClick={() => onPlatformMappingFilterChange(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {visibleRows.length === 0 ? (
                    <p className={`text-xs ${mutedClass}`}>
                      {t('admin.plannerIntegration.platformMapping.noRows')}
                    </p>
                  ) : null}
                  {visibleRows.map((row) => {
                    const mapped = platformValueMap.find(
                      (x) => x.trackerValue === row.trackerValue,
                    );
                    const badgeClass = row.unmapped
                      ? 'border-amber-300/80 bg-amber-100/70 text-amber-800 dark:border-amber-700/80 dark:bg-amber-900/30 dark:text-amber-200'
                      : row.changed
                        ? 'border-blue-300/80 bg-blue-100/70 text-blue-800 dark:border-blue-700/80 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'border-emerald-300/80 bg-emerald-100/70 text-emerald-800 dark:border-emerald-700/80 dark:bg-emerald-900/30 dark:text-emerald-200';
                    const statusLabel = row.unmapped
                      ? t('admin.plannerIntegration.platformMapping.unmapped')
                      : row.changed
                        ? t('admin.plannerIntegration.platformMapping.changed')
                        : t('admin.plannerIntegration.platformMapping.rowOk');
                    return (
                      <div
                        key={row.trackerValue}
                        className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_140px_220px]"
                      >
                        <div className="min-w-0 truncate rounded-md border border-gray-200 px-2.5 py-2 text-sm dark:border-gray-700">
                          {row.trackerValue}
                        </div>
                        <div className="flex justify-start sm:justify-center">
                          <span
                            className={`inline-flex min-w-[122px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium ${badgeClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <CustomSelect
                          className="w-full"
                          options={platformSelectOptions}
                          title={t(
                            'admin.plannerIntegration.platformMapping.platformForRow',
                            { value: row.trackerValue },
                          )}
                          value={mapped?.platform ?? ''}
                          onChange={(next) => {
                            onRowPlatformChange(row.trackerValue, next ?? '');
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
