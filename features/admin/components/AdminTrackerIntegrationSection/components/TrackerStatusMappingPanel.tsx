'use client';

import type { CategoryBucketId } from '../types';

import { useCallback, useMemo, type ReactNode } from 'react';

import {
  CustomSelect,
  type CustomSelectOption,
} from '@/components/CustomSelect';
import { useI18n } from '@/contexts/LanguageContext';
import { plannerStatusPaletteLabel } from '@/features/admin/plannerIntegrationPaletteLabel';
import {
  canonicalPaletteKey,
  getSwimlaneTaskCardChipClassNames,
} from '@/utils/statusColors';

import { STATUS_PALETTE_OPTIONS, sectionBlock } from '../constants';

export interface TrackerStatusMappingSection {
  id: CategoryBucketId;
  rows: Array<{
    display: string;
    key: string;
    statusTypeKey?: string;
  }>;
  title: string;
}

function TrackerStatusTitleCell({
  display,
  mutedClass,
  statusKey,
  statusTypeKey,
}: {
  display: string;
  mutedClass: string;
  statusKey: string;
  statusTypeKey?: string;
}) {
  const { t } = useI18n();
  const same = display.trim().toLowerCase() === statusKey.trim().toLowerCase();
  const typeSnippet = statusTypeKey ? (
    <>
      {t('admin.plannerIntegration.statusRow.beforeTypedCode')}
      <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">
        {statusTypeKey}
      </code>
    </>
  ) : null;

  let secondary: ReactNode = null;
  if (!same) {
    secondary = (
      <>
        <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">
          {statusKey}
        </code>
        {typeSnippet}
      </>
    );
  } else if (statusTypeKey) {
    secondary = (
      <>
        {t('admin.plannerIntegration.statusRow.typeBeforeCode')}
        <code className="rounded bg-gray-100 px-0.5 dark:bg-gray-800">
          {statusTypeKey}
        </code>
      </>
    );
  }

  return (
    <div>
      <div className="font-medium text-gray-900 dark:text-gray-100">
        {same ? statusKey : display}
      </div>
      {secondary ? (
        <div className={`mt-0.5 text-xs ${mutedClass}`}>{secondary}</div>
      ) : null}
    </div>
  );
}

function TaskCardColorChip({ colorKey }: { colorKey: string }) {
  const k = colorKey.trim();
  if (!k) {
    return null;
  }
  return (
    <span
      aria-hidden
      className={getSwimlaneTaskCardChipClassNames(k)}
      title={k}
    />
  );
}

function AdminStatusPaletteSelect({
  className,
  onPaletteChange,
  statusKey,
  storedPaletteKey,
}: {
  className?: string;
  onPaletteChange: (paletteKey: string) => void;
  statusKey: string;
  storedPaletteKey: string;
}) {
  const { has, t } = useI18n();
  const paletteLabel = useCallback(
    (key: string) => plannerStatusPaletteLabel(key, t, has),
    [has, t],
  );

  const resolveColorKey = (stored: string) =>
    stored.trim() ? stored : statusKey;

  const options: CustomSelectOption<string>[] = useMemo(
    () => [
      { label: paletteLabel(statusKey), value: '' },
      ...STATUS_PALETTE_OPTIONS.map((pk) => ({
        label: paletteLabel(pk),
        value: pk,
      })),
    ],
    [paletteLabel, statusKey],
  );

  const value = storedPaletteKey.trim()
    ? canonicalPaletteKey(storedPaletteKey)
    : '';

  const cardTitle = t('admin.plannerIntegration.statusMapping.cardColorTitle', {
    status: paletteLabel(statusKey),
  });

  return (
    <CustomSelect
      className={className ?? 'w-full'}
      options={options}
      renderOption={(opt) => {
        const ck = resolveColorKey(opt.value);
        return (
          <span className="flex items-center gap-2">
            <TaskCardColorChip colorKey={ck} />
            <span className="min-w-0 flex-1 leading-snug">
              {paletteLabel(ck)}
            </span>
          </span>
        );
      }}
      renderTriggerValue={({ value: v }) => {
        const ck = resolveColorKey(v);
        return (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <TaskCardColorChip colorKey={ck} />
            <span className="min-w-0 truncate text-left leading-tight">
              {paletteLabel(ck)}
            </span>
          </span>
        );
      }}
      searchPlaceholder={t('admin.plannerIntegration.statusMapping.searchPalette')}
      searchable
      size="compact"
      title={cardTitle}
      value={value}
      onChange={(next) => onPaletteChange(next)}
    />
  );
}

export interface TrackerStatusMappingPanelProps {
  isEmpty: boolean;
  metaLoading: boolean;
  mutedClass: string;
  sections: TrackerStatusMappingSection[];
  getStoredPaletteKey: (statusKey: string) => string;
  onPaletteChange: (statusKey: string, paletteKey: string) => void;
}

export function TrackerStatusMappingPanel({
  getStoredPaletteKey,
  isEmpty,
  metaLoading,
  mutedClass,
  onPaletteChange,
  sections,
}: TrackerStatusMappingPanelProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <article className={sectionBlock}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.plannerIntegration.statusMapping.title')}
        </h3>
        <p className={`mt-0.5 text-xs ${mutedClass}`}>
          {t('admin.plannerIntegration.statusMapping.subtitle')}
        </p>
        <div className="mt-3 space-y-3">
          {isEmpty ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 px-4 py-6 text-center dark:border-gray-600 dark:bg-gray-950/20">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {metaLoading
                  ? t('admin.plannerIntegration.statusMapping.loading')
                  : t('admin.plannerIntegration.statusMapping.empty')}
              </p>
              <p className={`mx-auto mt-1 max-w-md text-xs ${mutedClass}`}>
                {t('admin.plannerIntegration.statusMapping.hintConnection')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-lg border border-gray-200/80 dark:border-gray-600">
                <div
                  className="touch-pan-y max-h-[62vh] overflow-auto text-sm"
                  style={{ overscrollBehaviorY: 'auto' }}
                >
                  {sections.map((section, sectionIdx) => (
                    <div
                      key={section.id}
                      className={
                        sectionIdx > 0
                          ? 'border-t border-gray-200/80 dark:border-gray-600'
                          : ''
                      }
                    >
                      <div className="sticky top-0 z-[2] border-b border-gray-200/80 bg-gray-100/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 backdrop-blur dark:border-gray-600 dark:bg-gray-900/95 dark:text-gray-200">
                        {section.title}
                        <span className="ml-2 opacity-70">
                          ({section.rows.length})
                        </span>
                      </div>
                      <ul className="divide-y divide-gray-200/80 dark:divide-gray-600">
                        {section.rows.map((row) => (
                          <li
                            key={row.key}
                            className="grid gap-2 bg-white/40 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:bg-gray-900/35 dark:hover:bg-gray-800/55 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center sm:gap-4"
                          >
                            <div className="flex min-w-0 flex-1 items-center">
                              <TrackerStatusTitleCell
                                display={row.display}
                                mutedClass={mutedClass}
                                statusKey={row.key}
                                statusTypeKey={row.statusTypeKey}
                              />
                            </div>
                            <div className="w-full sm:w-[260px]">
                              <AdminStatusPaletteSelect
                                className="w-full"
                                statusKey={row.key}
                                storedPaletteKey={getStoredPaletteKey(row.key)}
                                onPaletteChange={(next) =>
                                  onPaletteChange(row.key, next)
                                }
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
