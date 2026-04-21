'use client';

import type {
  EmbeddedTestingOnlyJoin,
  EmbeddedTestingOnlyOperator,
  EmbeddedTestingOnlyRuleForm,
} from '../types';
import type { Dispatch, SetStateAction } from 'react';

import { Button } from '@/components/Button';
import {
  CustomSelect,
  type CustomSelectOption,
} from '@/components/CustomSelect';
import { useI18n } from '@/contexts/LanguageContext';

import {
  fieldRowIsList,
  fieldRowIsNumeric,
  findFieldRowByStoredAccessor,
  normalizeRuleForFieldRow,
  operatorOptionsForFieldRow,
  toStoredFieldAccessor,
  toUiFieldValueFromStoredAccessor,
} from '../embeddedTestingRuleFieldHelpers';

export interface EmbeddedRulesFieldRow {
  display?: string;
  id: string;
  key?: string;
  name?: string;
  options?: string[];
  schemaType?: string;
}

export interface TrackerEmbeddedTestingRulesPanelProps {
  allFieldSelectOptions: CustomSelectOption<string>[];
  embeddedTestingOnlyJoins: EmbeddedTestingOnlyJoin[];
  embeddedTestingOnlyRules: EmbeddedTestingOnlyRuleForm[];
  fieldClass: string;
  fieldRows: EmbeddedRulesFieldRow[];
  mutedClass: string;
  setEmbeddedTestingOnlyJoins: Dispatch<
    SetStateAction<EmbeddedTestingOnlyJoin[]>
  >;
  setEmbeddedTestingOnlyRules: Dispatch<
    SetStateAction<EmbeddedTestingOnlyRuleForm[]>
  >;
  testingOnlyRulesPreview: string;
}

export function TrackerEmbeddedTestingRulesPanel({
  allFieldSelectOptions,
  embeddedTestingOnlyJoins,
  embeddedTestingOnlyRules,
  fieldClass,
  fieldRows,
  mutedClass,
  setEmbeddedTestingOnlyJoins,
  setEmbeddedTestingOnlyRules,
  testingOnlyRulesPreview,
}: TrackerEmbeddedTestingRulesPanelProps) {
  const { t } = useI18n();

  return (
    <div className="mt-5 border-t border-gray-200/80 pt-4 dark:border-gray-700">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('admin.plannerIntegration.embeddedRules.title')}
      </h4>
      <div className="mt-2 space-y-1">
        <p className={`text-xs ${mutedClass}`}>
          {t('admin.plannerIntegration.embeddedRules.subtitle')}
        </p>
        <p className="text-xs text-gray-700 dark:text-gray-300">
          <span className="font-semibold">
            {t('admin.plannerIntegration.embeddedRules.previewPrefix')}
          </span>
          {testingOnlyRulesPreview}
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-gray-200/80 bg-white/60 p-3 dark:border-gray-700 dark:bg-gray-950/20">
        <div className="flex items-center justify-between gap-2">
          <Button
            className="px-2.5 py-1.5 text-xs"
            type="button"
            variant="outline"
            onClick={() => {
              setEmbeddedTestingOnlyRules((prev) => {
                if (prev.length > 0) {
                  setEmbeddedTestingOnlyJoins((j) => [...j, 'and']);
                }
                return [...prev, { fieldId: '', operator: 'eq', value: '' }];
              });
            }}
          >
            {t('admin.plannerIntegration.embeddedRules.addRule')}
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          {embeddedTestingOnlyRules.length === 0 ? (
            <p className={`text-xs ${mutedClass}`}>
              {t('admin.plannerIntegration.embeddedRules.noRulesInList')}
            </p>
          ) : (
            embeddedTestingOnlyRules.map((rule, idx) => {
              const f = findFieldRowByStoredAccessor(fieldRows, rule.fieldId);
              const opOpts = operatorOptionsForFieldRow(f, t);
              const listField = fieldRowIsList(f);
              return (
                <div
                  key={`${idx}-${rule.fieldId}-${rule.operator}`}
                  className="space-y-2"
                >
                  {idx > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs ${mutedClass}`}>
                        {t('admin.plannerIntegration.embeddedRules.joinPrev')}
                      </span>
                      <CustomSelect
                        className="min-w-[140px]"
                        options={[
                          {
                            label: t('admin.plannerIntegration.embeddedRules.logicalAnd'),
                            value: 'and',
                          },
                          {
                            label: t('admin.plannerIntegration.embeddedRules.logicalOr'),
                            value: 'or',
                          },
                        ]}
                        title={t('admin.plannerIntegration.embeddedRules.joinTitle')}
                        value={embeddedTestingOnlyJoins[idx - 1] ?? 'and'}
                        onChange={(v) =>
                          setEmbeddedTestingOnlyJoins((prev) => {
                            const next = [...prev];
                            next[idx - 1] = v === 'or' ? 'or' : 'and';
                            return next;
                          })
                        }
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto]">
                    <CustomSelect
                      className="w-full"
                      options={allFieldSelectOptions}
                      searchPlaceholder={t(
                        'admin.plannerIntegration.embeddedRules.fieldPlaceholder',
                      )}
                      searchable
                      title={t('admin.plannerIntegration.embeddedRules.fieldTitle')}
                      value={toUiFieldValueFromStoredAccessor(
                        fieldRows,
                        rule.fieldId,
                      )}
                      onChange={(v) =>
                        setEmbeddedTestingOnlyRules((prev) =>
                          prev.map((r, i) => {
                            if (i !== idx) {
                              return r;
                            }
                            const row = fieldRows.find((x) => x.id === v);
                            const storedAccessor = toStoredFieldAccessor(
                              fieldRows,
                              v,
                            );
                            return normalizeRuleForFieldRow(
                              row,
                              {
                                ...r,
                                fieldId: storedAccessor,
                              },
                              t,
                            );
                          }),
                        )
                      }
                    />
                    <CustomSelect
                      className="w-full"
                      options={opOpts}
                      title={t('admin.plannerIntegration.embeddedRules.comparisonTitle')}
                      value={rule.operator}
                      onChange={(v) =>
                        setEmbeddedTestingOnlyRules((prev) =>
                          prev.map((r, i) =>
                            i === idx &&
                            (v === 'eq' ||
                              v === 'gt' ||
                              v === 'lt' ||
                              v === 'gte' ||
                              v === 'lte')
                              ? normalizeRuleForFieldRow(
                                  f,
                                  {
                                    ...r,
                                    operator: v as EmbeddedTestingOnlyOperator,
                                  },
                                  t,
                                )
                              : r,
                          ),
                        )
                      }
                    />
                    {listField && f?.options?.length ? (
                      <CustomSelect
                        className="w-full"
                        options={[
                          {
                            label: t(
                              'admin.plannerIntegration.embeddedRules.valueEmptyOption',
                            ),
                            value: '',
                          },
                          ...f.options.map((opt) => ({
                            label: opt,
                            value: opt,
                          })),
                        ]}
                        searchPlaceholder={t(
                          'admin.plannerIntegration.embeddedRules.valueSearch',
                        )}
                        searchable
                        title={t('admin.plannerIntegration.embeddedRules.valueTitle')}
                        value={rule.value}
                        onChange={(v) =>
                          setEmbeddedTestingOnlyRules((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, value: v } : r,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        className={fieldClass}
                        inputMode={fieldRowIsNumeric(f) ? 'decimal' : 'text'}
                        placeholder={
                          fieldRowIsNumeric(f)
                            ? t('admin.plannerIntegration.embeddedRules.valueNumber')
                            : t('admin.plannerIntegration.embeddedRules.valueText')
                        }
                        type="text"
                        value={rule.value}
                        onChange={(e) =>
                          setEmbeddedTestingOnlyRules((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, value: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        className="px-2 py-2 text-xs"
                        disabled={idx === 0}
                        title={t('admin.plannerIntegration.embeddedRules.moveUpTitle')}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (idx === 0) {
                            return;
                          }
                          setEmbeddedTestingOnlyRules((prev) => {
                            const next = [...prev];
                            [next[idx - 1], next[idx]] = [
                              next[idx]!,
                              next[idx - 1]!,
                            ];
                            return next;
                          });
                        }}
                      >
                        ↑
                      </Button>
                      <Button
                        className="px-2 py-2 text-xs"
                        disabled={idx >= embeddedTestingOnlyRules.length - 1}
                        title={t('admin.plannerIntegration.embeddedRules.moveDownTitle')}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (idx >= embeddedTestingOnlyRules.length - 1) {
                            return;
                          }
                          setEmbeddedTestingOnlyRules((prev) => {
                            const next = [...prev];
                            [next[idx], next[idx + 1]] = [
                              next[idx + 1]!,
                              next[idx]!,
                            ];
                            return next;
                          });
                        }}
                      >
                        ↓
                      </Button>
                      <Button
                        className="px-2.5 py-2 text-xs"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEmbeddedTestingOnlyRules((prevRules) => {
                            const nextRules = prevRules.filter(
                              (_, i) => i !== idx,
                            );
                            setEmbeddedTestingOnlyJoins((prevJoins) => {
                              if (prevRules.length <= 1) {
                                return [];
                              }
                              if (idx === 0) {
                                return prevJoins.slice(1);
                              }
                              if (idx === prevRules.length - 1) {
                                return prevJoins.slice(0, -1);
                              }
                              return [
                                ...prevJoins.slice(0, idx - 1),
                                'and',
                                ...prevJoins.slice(idx + 1),
                              ];
                            });
                            return nextRules;
                          });
                        }}
                      >
                        {t('admin.plannerIntegration.embeddedRules.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
