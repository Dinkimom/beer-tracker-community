"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import { Toggle } from "@/components/SettingsModal/components/Toggle";
import { useI18n } from "@/contexts/LanguageContext";
import {
  badgeMuted,
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
  tabBtnBase,
  tabBtnIdle,
} from "@/features/admin/adminUiTokens";

import { TrackerEmbeddedTestingRulesPanel } from "./components/TrackerEmbeddedTestingRulesPanel";
import { TrackerPlatformMappingPanel } from "./components/TrackerPlatformMappingPanel";
import { TrackerStatusMappingPanel } from "./components/TrackerStatusMappingPanel";
import { integrationSubtabs, sectionBlock } from "./constants";
import {
  useTrackerIntegrationLoadSave,
  useTrackerMetadataLoad,
} from "./hooks/useTrackerIntegrationApi";
import {
  type TrackerIntegrationFieldRow,
  useTrackerIntegrationFormState,
} from "./hooks/useTrackerIntegrationFormState";
import { nextPaletteMap } from "./trackerIntegrationFormModel";
import {
  type AdminTrackerIntegrationSectionProps,
  type PlatformValueMapFormRow,
  type TrackerStatusRowMeta,
} from "./types";

export function AdminTrackerIntegrationSection({
  organizationId,
}: AdminTrackerIntegrationSectionProps) {
  const { t } = useI18n();
  const integrationTabs = useMemo(() => integrationSubtabs(t), [t]);

  const [fieldRows, setFieldRows] = useState<TrackerIntegrationFieldRow[]>([]);
  const [trackerStatusesList, setTrackerStatusesList] = useState<
    TrackerStatusRowMeta[]
  >([]);

  const { loadMetadata, metaLoading } = useTrackerMetadataLoad({
    organizationId,
    setFieldRows,
    setTrackerStatusesList,
  });

  const form = useTrackerIntegrationFormState({
    fieldRows,
    organizationId,
    trackerStatusesList,
  });

  const { load, loading, saveTrackerIntegration, saving } =
    useTrackerIntegrationLoadSave({
      applyLoadedConfig: form.applyLoadedConfig,
      onAfterIntegrationLoad: form.bumpIntegrationLoadNonce,
      onSaveSuccess: form.applySaveSuccessRevision,
      organizationId,
    });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    void loadMetadata({ silent: true });
  }, [organizationId, loadMetadata]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }
    const timer = window.setInterval(
      () => {
        void loadMetadata({ silent: true });
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [organizationId, loadMetadata]);

  async function save() {
    if (!organizationId) {
      toast.error(t("admin.plannerIntegration.pickOrganization"));
      return;
    }
    await saveTrackerIntegration(form.draftConfig);
  }

  const {
    activeSubtab,
    allFieldSelectOptions,
    devAssigneeFieldId,
    devEstimateFieldId,
    embeddedTestingOnlyJoins,
    embeddedTestingOnlyRules,
    fieldSelectOptions,
    footerSummaryText,
    hasUnsavedChanges,
    mappingFieldSelectOptions,
    minSp,
    minTp,
    numericFieldSelectOptions,
    platformFieldId,
    platformFieldValues,
    platformMappingFilter,
    platformMappingStats,
    platformValueMap,
    qaEngineerFieldId,
    qaEstimateFieldId,
    releaseMrFieldId,
    releaseReadyStatusKey,
    releaseReadyStatusOptions,
    releasesTabVisible,
    reloadConfirmArmed,
    revision,
    setActiveSubtab,
    setDevAssigneeFieldId,
    setDevEstimateFieldId,
    setEmbeddedTestingOnlyJoins,
    setEmbeddedTestingOnlyRules,
    setMinSp,
    setMinTp,
    setPlatformFieldId,
    setPlatformMappingFilter,
    setPlatformValueMap,
    setQaEngineerFieldId,
    setQaEstimateFieldId,
    setReleaseMrFieldId,
    setReleaseReadyStatusKey,
    setReloadConfirmArmed,
    setReleasesTabVisible,
    setStatusPaletteByKey,
    setTestingFlowMode,
    statusPaletteByKey,
    statusRowsByCategory,
    statusTableRows,
    stringFieldSelectOptions,
    testingFlowMode,
    testingOnlyRulesPreview,
    visiblePlatformMappingRows,
  } = form;

  return (
    <section className={`${cardShell} flex flex-col`}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-t-xl">
        <div className={cardHeader}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={hCard}>{t("admin.plannerIntegration.title")}</h2>
            {revision !== null ? (
              <span className={badgeMuted} title={t("admin.plannerIntegration.revisionTitle")}>
                rev.{revision}
              </span>
            ) : null}
          </div>
          <p className={`mt-1 max-w-3xl text-sm leading-relaxed ${muted}`}>
            {t("admin.plannerIntegration.intro")}
          </p>
        </div>
        <div className={`${cardBody} flex-1 space-y-5`}>
        <div
          aria-label={t("admin.plannerIntegration.subtabAria")}
          className="inline-flex w-full flex-wrap gap-2 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/60 p-2 dark:border-gray-700 dark:bg-gray-900/40"
          role="tablist"
        >
          {integrationTabs.map((tab) => (
            <button
              key={tab.id}
              aria-controls={`ti-subtab-panel-${tab.id}`}
              aria-selected={activeSubtab === tab.id}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:focus-visible:ring-blue-400 ${
                activeSubtab === tab.id
                  ? "border-1 border-blue-500 bg-blue-50 text-blue-900 hover:bg-blue-100/90 dark:border-blue-400/70 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
                  : "border border-gray-300 bg-transparent text-gray-700 hover:border-gray-400 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800/80 dark:hover:text-gray-50"
              }`}
              id={`ti-subtab-${tab.id}`}
              role="tab"
              type="button"
              onClick={() => setActiveSubtab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`ti-subtab-${activeSubtab}`}
          id={`ti-subtab-panel-${activeSubtab}`}
          role="tabpanel"
        >
          {activeSubtab === "process-setup" ? (
            <article className={sectionBlock}>
              <TrackerPlatformMappingPanel
                labelClass={label}
                mappingFieldSelectOptions={mappingFieldSelectOptions}
                mutedClass={muted}
                platformFieldId={platformFieldId}
                platformFieldValues={platformFieldValues}
                platformMappingFilter={platformMappingFilter}
                platformValueMap={platformValueMap}
                stats={platformMappingStats}
                tabBtnBase={tabBtnBase}
                tabBtnIdle={tabBtnIdle}
                visibleRows={visiblePlatformMappingRows}
                onPlatformFieldChange={(v) => {
                  setPlatformFieldId(v);
                  setPlatformValueMap([]);
                }}
                onPlatformMappingFilterChange={setPlatformMappingFilter}
                onRowPlatformChange={(trackerValue, next) => {
                  setPlatformValueMap((prev) => {
                    const rest = prev.filter(
                      (x) => x.trackerValue !== trackerValue,
                    );
                    if (!next) {
                      return rest;
                    }
                    return [
                      ...rest,
                      {
                        platform: next as PlatformValueMapFormRow["platform"],
                        trackerValue,
                      },
                    ];
                  });
                }}
              />

              <div className="mt-5 border-t border-gray-200/80 pt-4 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("admin.plannerIntegration.testingSetupTitle")}
                </h3>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {t("admin.plannerIntegration.testingSetupSubtitle")}
                </p>
                <div
                  aria-label={t("admin.plannerIntegration.testingFlowAria")}
                  className="mt-3 inline-flex w-full max-w-md flex-col gap-2 sm:flex-row sm:rounded-lg sm:bg-gray-100 sm:p-1 sm:dark:bg-gray-900/60"
                  role="radiogroup"
                >
                  <button
                    aria-checked={testingFlowMode === "embedded"}
                    className={`${tabBtnBase} w-full px-3 py-2.5 text-left text-sm sm:text-center ${
                      testingFlowMode === "embedded"
                        ? "border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        : `${tabBtnIdle} rounded-lg border border-transparent sm:border-0`
                    }`}
                    role="radio"
                    type="button"
                    onClick={() => setTestingFlowMode("embedded")}
                  >
                    <span className="font-medium">
                      {t("admin.plannerIntegration.embeddedMode")}
                    </span>
                  </button>
                  <button
                    aria-checked={testingFlowMode === "standalone"}
                    className={`${tabBtnBase} w-full px-3 py-2.5 text-left text-sm sm:text-center ${
                      testingFlowMode === "standalone"
                        ? "border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        : `${tabBtnIdle} rounded-lg border border-transparent sm:border-0`
                    }`}
                    role="radio"
                    type="button"
                    onClick={() => setTestingFlowMode("standalone")}
                  >
                    <span className="font-medium">
                      {t("admin.plannerIntegration.standaloneMode")}
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-5 border-t border-gray-200/80 pt-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("admin.plannerIntegration.fieldMappingTitle")}
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(testingFlowMode === "embedded"
                    ? [
                        {
                          id: "ti-dev-est",
                          label: t("admin.plannerIntegration.field.devEstimateEmbedded"),
                          setter: setDevEstimateFieldId,
                          value: devEstimateFieldId,
                        },
                        {
                          id: "ti-qa-est",
                          label: t("admin.plannerIntegration.field.qaEstimateEmbedded"),
                          setter: setQaEstimateFieldId,
                          value: qaEstimateFieldId,
                        },
                        {
                          id: "ti-qa-eng",
                          label: t("admin.plannerIntegration.field.qaEngineer"),
                          setter: setQaEngineerFieldId,
                          value: qaEngineerFieldId,
                        },
                        {
                          id: "ti-dev-asg",
                          label: t("admin.plannerIntegration.field.devAssigneeEmbedded"),
                          setter: setDevAssigneeFieldId,
                          value: devAssigneeFieldId,
                        },
                      ]
                    : [
                        {
                          id: "ti-dev-asg",
                          label: t("admin.plannerIntegration.field.devAssigneeStandalone"),
                          setter: setDevAssigneeFieldId,
                          value: devAssigneeFieldId,
                        },
                        {
                          id: "ti-dev-est",
                          label: t("admin.plannerIntegration.field.estimateStandalone"),
                          setter: setDevEstimateFieldId,
                          value: devEstimateFieldId,
                        },
                      ]
                  ).map((row) => (
                    <div key={row.id}>
                      <div className={label}>{row.label}</div>
                      <CustomSelect
                        className="w-full"
                        options={
                          row.id.includes("est")
                            ? numericFieldSelectOptions
                            : fieldSelectOptions
                        }
                        searchPlaceholder={t("admin.plannerIntegration.searchField")}
                        searchable
                        title={row.label}
                        value={row.value || ""}
                        onChange={(v) => row.setter(v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <TrackerEmbeddedTestingRulesPanel
                allFieldSelectOptions={allFieldSelectOptions}
                embeddedTestingOnlyJoins={embeddedTestingOnlyJoins}
                embeddedTestingOnlyRules={embeddedTestingOnlyRules}
                fieldClass={field}
                fieldRows={fieldRows}
                mutedClass={muted}
                setEmbeddedTestingOnlyJoins={setEmbeddedTestingOnlyJoins}
                setEmbeddedTestingOnlyRules={setEmbeddedTestingOnlyRules}
                testingOnlyRulesPreview={testingOnlyRulesPreview}
              />
            </article>
          ) : null}

          {activeSubtab === "statuses-mapping" ? (
            <TrackerStatusMappingPanel
              getStoredPaletteKey={(k) => statusPaletteByKey[k] ?? ""}
              isEmpty={statusTableRows.length === 0}
              metaLoading={metaLoading}
              mutedClass={muted}
              sections={statusRowsByCategory}
              onPaletteChange={(statusKey, next) =>
                setStatusPaletteByKey((p) => nextPaletteMap(p, statusKey, next))
              }
            />
          ) : null}

          {activeSubtab === "other" ? (
            <div className="space-y-3">
              <article className={sectionBlock}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("admin.plannerIntegration.thresholdsTitle")}
                </h3>
                <p className={`mt-0.5 text-xs ${muted}`}>
                  {t("admin.plannerIntegration.thresholdsHint")}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="ti-min-sp">
                      {t("admin.plannerIntegration.minSpLabel")}
                    </label>
                    <input
                      className={field}
                      id="ti-min-sp"
                      inputMode="decimal"
                      placeholder="0"
                      type="text"
                      value={minSp}
                      onChange={(e) => setMinSp(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="ti-min-tp">
                      {t("admin.plannerIntegration.minTpLabel")}
                    </label>
                    <input
                      className={field}
                      id="ti-min-tp"
                      inputMode="decimal"
                      placeholder="0"
                      type="text"
                      value={minTp}
                      onChange={(e) => setMinTp(e.target.value)}
                    />
                  </div>
                </div>
              </article>

              <article className={sectionBlock}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("admin.plannerIntegration.releasesPlannerTitle")}
                </h3>
                <div className="mt-5">
                  <Toggle
                    checked={releasesTabVisible}
                    colorScheme="violet"
                    hint={t("admin.plannerIntegration.releasesToggleHint")}
                    id="ti-releases-tab-visible"
                    label={t("admin.plannerIntegration.releasesToggleLabel")}
                    onChange={setReleasesTabVisible}
                  />
                </div>

                <div className="mt-6 border-t border-gray-200/80 pt-6 dark:border-gray-700">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                    {t("admin.plannerIntegration.releasesMrSectionTitle")}
                  </h4>
                  <p className={`mt-1.5 text-xs leading-relaxed ${muted}`}>
                    {t("admin.plannerIntegration.releasesMrSectionBody")}
                  </p>
                  {!releasesTabVisible ? (
                    <p
                      className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-100"
                      role="status"
                    >
                      {t("admin.plannerIntegration.releasesTabHiddenNote")}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-4">
                    <div>
                      <span className={label}>
                        {t("admin.plannerIntegration.releaseReadyStatusLabel")}
                      </span>
                      <CustomSelect
                        className="mt-1.5 w-full"
                        options={releaseReadyStatusOptions}
                        searchPlaceholder={t("admin.plannerIntegration.releaseReadyStatusSearch")}
                        searchable
                        size="compact"
                        title={t("admin.plannerIntegration.releaseReadyStatusTitle")}
                        value={releaseReadyStatusKey}
                        onChange={(v) => setReleaseReadyStatusKey(v)}
                      />
                      {trackerStatusesList.length === 0 && !metaLoading ? (
                        <p className={`mt-1.5 text-xs ${muted}`}>
                          {t("admin.plannerIntegration.loadTrackerCatalogHint")}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <span className={label}>
                        {t("admin.plannerIntegration.releaseMrFieldLabel")}
                      </span>
                      <CustomSelect
                        className="mt-1.5 w-full"
                        options={stringFieldSelectOptions}
                        searchPlaceholder={t(
                          "admin.plannerIntegration.releaseMrFieldSearch",
                        )}
                        searchable
                        size="compact"
                        title={t("admin.plannerIntegration.releaseMrFieldTitle")}
                        value={releaseMrFieldId}
                        onChange={(v) => setReleaseMrFieldId(v)}
                      />
                      {fieldRows.length === 0 && !metaLoading ? (
                        <p className={`mt-1.5 text-xs ${muted}`}>
                          {t("admin.plannerIntegration.needFieldCatalog")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <footer
        className="sticky bottom-0 z-20 flex w-full flex-wrap items-center justify-between gap-2 overflow-hidden rounded-b-xl border-t border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-5"
        role="contentinfo"
      >
        <div className={`min-w-0 flex-1 text-xs ${muted}`}>
          {hasUnsavedChanges
            ? t("admin.plannerIntegration.footer.dirty")
            : t("admin.plannerIntegration.footer.clean")}{" "}
          {footerSummaryText}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            className="px-3.5 py-2"
            disabled={loading}
            type="button"
            variant="outline"
            onClick={() => {
              if (hasUnsavedChanges && !reloadConfirmArmed) {
                setReloadConfirmArmed(true);
                toast(t("admin.plannerIntegration.footer.reloadToast"));
                window.setTimeout(() => setReloadConfirmArmed(false), 3000);
                return;
              }
              setReloadConfirmArmed(false);
              void load();
            }}
          >
            {loading
              ? t("admin.plannerIntegration.footer.reloadLoading")
              : hasUnsavedChanges && reloadConfirmArmed
                ? t("admin.plannerIntegration.footer.reloadConfirm")
                : t("admin.plannerIntegration.footer.reload")}
          </Button>
          <Button
            className="px-3.5 py-2"
            disabled={saving || loading || !hasUnsavedChanges}
            type="button"
            variant="primary"
            onClick={() => void save()}
          >
            {saving
              ? t("admin.plannerIntegration.footer.saveSaving")
              : t("admin.plannerIntegration.footer.save")}
          </Button>
        </div>
      </footer>
    </section>
  );
}

export type { AdminTrackerIntegrationSectionProps } from "./types";
