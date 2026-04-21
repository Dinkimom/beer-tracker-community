import type { CustomSelectOption } from "@/components/CustomSelect";
import type { TrackerIntegrationStored } from "@/lib/trackerIntegration/schema";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/contexts/LanguageContext";

import {
  filterPlatformMappingRows,
  summarizePlatformMappingRows,
} from "@/lib/trackerIntegration/platformMappingFilter";
import { resolveEffectiveStatusCategory } from "@/lib/trackerIntegration/resolveStatus";
import {
  buildAutoPlatformValueMap,
  buildEmbeddedTestingOnlyAutoExtraRules,
  embeddedTestingOnlyJoinsForRuleCount,
  findFunctionalTeamFieldId,
  pickQaTrackerValueForConditions,
} from "@/lib/trackerIntegration/smartIntegrationDefaults";

import {
  CATEGORY_SECTION_ORDER,
  categorySectionTitle,
} from "../constants";
import {
  findFieldRowByStoredAccessor,
  toUiFieldValueFromStoredAccessor,
} from "../embeddedTestingRuleFieldHelpers";
import {
  cloneConfigWithoutRevision,
  embeddedAutoRulesMatchDesiredPrefix,
  fieldRowIsStringLike,
  joinAdminMetaLabels,
  mergeFormIntoConfig,
  pickEmbeddedTestingOnlyForm,
  pickOccupancyThresholds,
  pickPlatformFieldId,
  pickPlatformValueMap,
  pickReleaseReadinessForm,
  pickStatusPaletteOverrides,
  pickTestingFlowMode,
  pickTestingFlowStrings,
  pickZeroDevPositiveQa,
  resolveFieldIdByAlias,
} from "../trackerIntegrationFormModel";
import {
  UNCATEGORIZED,
  type CategoryBucketId,
  type EmbeddedTestingOnlyJoin,
  type EmbeddedTestingOnlyOperator,
  type EmbeddedTestingOnlyRuleForm,
  type IntegrationSubtabId,
  type PlatformMappingFilter,
  type PlatformValueMapFormRow,
  type TrackerConfigShape,
  type TrackerStatusRowMeta,
} from "../types";

import { useTrackerPlatformFieldValues } from "./useTrackerIntegrationApi";

export interface TrackerIntegrationFieldRow {
  display?: string;
  id: string;
  key?: string;
  name?: string;
  options?: string[];
  schemaType?: string;
}

export interface UseTrackerIntegrationFormStateParams {
  fieldRows: TrackerIntegrationFieldRow[];
  organizationId: string;
  trackerStatusesList: TrackerStatusRowMeta[];
}

export function useTrackerIntegrationFormState({
  fieldRows,
  organizationId,
  trackerStatusesList,
}: UseTrackerIntegrationFormStateParams) {
  const { t, language } = useI18n();
  const sortLocale = language === "ru" ? "ru" : "en";

  const [configBase, setConfigBase] = useState<TrackerConfigShape>({});
  const [revision, setRevision] = useState<number | null>(null);
  const [platformFieldId, setPlatformFieldId] = useState("");
  const [platformValueMap, setPlatformValueMap] = useState<
    PlatformValueMapFormRow[]
  >([]);

  const [minSp, setMinSp] = useState("");
  const [minTp, setMinTp] = useState("");
  const [integrationLoadNonce, setIntegrationLoadNonce] = useState(0);
  const lastReleaseDefaultsForLoadNonceRef = useRef(-1);
  const [releasesTabVisible, setReleasesTabVisible] = useState(true);
  const [releaseReadyStatusKey, setReleaseReadyStatusKey] = useState("");
  const [releaseMrFieldId, setReleaseMrFieldId] = useState("");
  const [devAssigneeFieldId, setDevAssigneeFieldId] = useState("");
  const [devEstimateFieldId, setDevEstimateFieldId] = useState("");
  const [qaEngineerFieldId, setQaEngineerFieldId] = useState("");
  const [qaEstimateFieldId, setQaEstimateFieldId] = useState("");
  const [testingFlowMode, setTestingFlowMode] = useState<
    "embedded" | "standalone"
  >("embedded");
  const [zeroDevPositiveQa, setZeroDevPositiveQa] = useState(false);
  const [embeddedTestingOnlyJoins, setEmbeddedTestingOnlyJoins] = useState<
    EmbeddedTestingOnlyJoin[]
  >([]);
  const [embeddedTestingOnlyRules, setEmbeddedTestingOnlyRules] = useState<
    EmbeddedTestingOnlyRuleForm[]
  >([]);
  const [statusPaletteByKey, setStatusPaletteByKey] = useState<
    Record<string, string>
  >({});

  const platformFieldValues = useTrackerPlatformFieldValues(
    organizationId,
    platformFieldId,
  );

  const [activeSubtab, setActiveSubtab] =
    useState<IntegrationSubtabId>("process-setup");
  const [platformMappingFilter, setPlatformMappingFilter] =
    useState<PlatformMappingFilter>("all");
  const [reloadConfirmArmed, setReloadConfirmArmed] = useState(false);

  const initialIntegrationSnapshotRef = useRef<{
    hadEmbeddedTestingOnlyExtraRules: boolean;
    hadPlatformField: boolean;
    hadPlatformMap: boolean;
  } | null>(null);

  const fieldOptions = useMemo(
    () =>
      fieldRows.map((f) => ({
        id: f.id,
        label: joinAdminMetaLabels([f.display, f.name, f.key], f.id),
      })),
    [fieldRows],
  );

  const stringFieldSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    const rows = fieldRows.filter((f) => fieldRowIsStringLike(f));
    return [
      { label: t("admin.plannerIntegration.notSelected"), value: "" },
      ...rows.map((f) => ({
        label: joinAdminMetaLabels([f.display, f.name, f.key], f.id),
        value: f.id,
      })),
    ];
  }, [fieldRows, t]);

  const releaseReadyStatusOptions = useMemo((): CustomSelectOption<string>[] => {
    const rows = trackerStatusesList
      .slice()
      .sort(
        (a, b) =>
          a.display.localeCompare(b.display, sortLocale) ||
          a.key.localeCompare(b.key, sortLocale),
      );
    return [
      { label: t("admin.plannerIntegration.notSelected"), value: "" },
      ...rows.map((s) => ({
        label: joinAdminMetaLabels([s.display, s.key], s.key),
        value: s.key,
      })),
    ];
  }, [sortLocale, t, trackerStatusesList]);

  const numericFieldSelectOptions =
    useMemo((): CustomSelectOption<string>[] => {
      const numericRows = fieldRows.filter((f) => {
        const schema = (f.schemaType ?? "").toLowerCase();
        const key = (f.key ?? "").toLowerCase();
        const id = f.id.toLowerCase();
        if (
          key === "storypoints" ||
          key === "testpoints" ||
          id === "storypoints" ||
          id === "testpoints"
        ) {
          return true;
        }
        return (
          schema === "integer" ||
          schema === "number" ||
          schema === "float" ||
          schema === "double" ||
          schema === "int"
        );
      });
      return [
        { label: t("admin.plannerIntegration.notSelected"), value: "" },
        ...numericRows.map((f) => ({
          label: joinAdminMetaLabels([f.display, f.name, f.key], f.id),
          value: f.id,
        })),
      ];
    }, [fieldRows, t]);

  const allFieldSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    return [
      { label: t("admin.plannerIntegration.notSelected"), value: "" },
      ...fieldRows.map((f) => ({
        label: joinAdminMetaLabels([f.display, f.name, f.key], f.id),
        value: f.id,
      })),
    ];
  }, [fieldRows, t]);

  const mappingFieldSelectOptions =
    useMemo((): CustomSelectOption<string>[] => {
      const mappingRows = fieldRows.filter((f) => (f.options?.length ?? 0) > 0);
      return mappingRows.map((f) => ({
        label: joinAdminMetaLabels([f.display, f.name, f.key], f.id),
        value: f.id,
      }));
    }, [fieldRows]);

  const statusesCfgTyped = configBase.statuses as
    | TrackerIntegrationStored["statuses"]
    | undefined;

  const statusTableRows = useMemo(() => {
    const fromApi = trackerStatusesList.map((row) => ({
      display: row.display,
      effectiveCategory: resolveEffectiveStatusCategory(
        row.key,
        row.statusTypeKey,
        statusesCfgTyped,
      ),
      key: row.key,
      paletteKey: statusPaletteByKey[row.key] ?? "",
      statusTypeKey: row.statusTypeKey,
    }));
    const apiKeys = new Set(fromApi.map((r) => r.key));
    const orphans = Object.entries(statusPaletteByKey)
      .filter(([k]) => !apiKeys.has(k))
      .map(([key, paletteKey]) => ({
        display: key,
        effectiveCategory: resolveEffectiveStatusCategory(
          key,
          undefined,
          statusesCfgTyped,
        ),
        key,
        paletteKey,
        statusTypeKey: undefined as string | undefined,
      }))
      .sort((a, b) => a.key.localeCompare(b.key, sortLocale));
    return [...fromApi, ...orphans];
  }, [sortLocale, statusesCfgTyped, statusPaletteByKey, trackerStatusesList]);

  const statusRowsByCategory = useMemo(() => {
    const m = new Map<CategoryBucketId, typeof statusTableRows>();
    for (const row of statusTableRows) {
      const id: CategoryBucketId = row.effectiveCategory ?? UNCATEGORIZED;
      if (!m.has(id)) {
        m.set(id, []);
      }
      m.get(id)!.push(row);
    }
    for (const rows of m.values()) {
      rows.sort(
        (a, b) =>
          a.display.localeCompare(b.display, sortLocale) ||
          a.key.localeCompare(b.key, sortLocale),
      );
    }
    return CATEGORY_SECTION_ORDER.filter(
      (id) => (m.get(id)?.length ?? 0) > 0,
    ).map((id) => ({
      id,
      rows: m.get(id)!,
      title: categorySectionTitle(id, t),
    }));
  }, [sortLocale, statusTableRows, t]);

  const statusMappingStats = useMemo(() => {
    const total = statusTableRows.length;
    const customColor = statusTableRows.filter((row) => {
      const stored = (statusPaletteByKey[row.key] ?? "").trim();
      return stored.length > 0;
    }).length;
    const categories = statusRowsByCategory.length;
    return { categories, customColor, total };
  }, [statusPaletteByKey, statusRowsByCategory, statusTableRows]);

  const basePlatformValueMap = useMemo(
    () => pickPlatformValueMap(configBase),
    [configBase],
  );

  const platformMappingRows = useMemo(() => {
    const baseByTrackerValue = new Map(
      basePlatformValueMap.map((row) => [row.trackerValue, row.platform]),
    );
    return platformFieldValues.map((trackerValue) => {
      const mapped = platformValueMap.find((x) => x.trackerValue === trackerValue);
      const currentPlatform = mapped?.platform ?? "";
      const basePlatform = baseByTrackerValue.get(trackerValue) ?? "";
      const unmapped = !currentPlatform;
      const changed = currentPlatform !== basePlatform;
      return {
        changed,
        currentPlatform,
        trackerValue,
        unmapped,
      };
    });
  }, [basePlatformValueMap, platformFieldValues, platformValueMap]);

  const visiblePlatformMappingRows = useMemo(
    () => filterPlatformMappingRows(platformMappingRows, platformMappingFilter),
    [platformMappingFilter, platformMappingRows],
  );

  const platformMappingStats = useMemo(
    () => summarizePlatformMappingRows(platformMappingRows),
    [platformMappingRows],
  );

  const fieldSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    return [
      { label: t("admin.plannerIntegration.notSelected"), value: "" },
      ...fieldOptions.map((f) => ({ label: f.label, value: f.id })),
    ];
  }, [fieldOptions, t]);

  const draftConfig = useMemo(
    () =>
      mergeFormIntoConfig(
        { ...configBase },
        {
          devAssigneeFieldId,
          devEstimateFieldId,
          embeddedTestingOnlyJoins,
          embeddedTestingOnlyRules,
          minSp,
          minTp,
          platformFieldId,
          platformValueMap,
          qaEngineerFieldId,
          qaEstimateFieldId,
          releaseMrFieldId,
          releaseReadyStatusKey,
          releasesTabVisible,
          statusPaletteByKey,
          testingFlowMode,
          zeroDevPositiveQa,
        },
        fieldRows,
      ),
    [
      configBase,
      devAssigneeFieldId,
      devEstimateFieldId,
      embeddedTestingOnlyJoins,
      embeddedTestingOnlyRules,
      fieldRows,
      minSp,
      minTp,
      platformFieldId,
      platformValueMap,
      qaEngineerFieldId,
      qaEstimateFieldId,
      releaseMrFieldId,
      releaseReadyStatusKey,
      releasesTabVisible,
      statusPaletteByKey,
      testingFlowMode,
      zeroDevPositiveQa,
    ],
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftConfig) !== JSON.stringify(configBase),
    [configBase, draftConfig],
  );

  const testingOnlyRulesPreview = useMemo(() => {
    if (embeddedTestingOnlyRules.length === 0) {
      return t("admin.plannerIntegration.rulesPreview.noRules");
    }
    const opMap: Record<EmbeddedTestingOnlyOperator, string> = {
      eq: "=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
    };
    return embeddedTestingOnlyRules
      .map((rule, idx) => {
        const row = findFieldRowByStoredAccessor(fieldRows, rule.fieldId);
        const fieldLabel = joinAdminMetaLabels(
          [row?.display, row?.name, row?.key],
          rule.fieldId || t("admin.plannerIntegration.rulesPreview.fieldFallback"),
        );
        const valueLabel = rule.value.trim()
          ? rule.value
          : t("admin.plannerIntegration.rulesPreview.emptyValue");
        const expression = `${fieldLabel} ${opMap[rule.operator]} ${valueLabel}`;
        if (idx === 0) {
          return expression;
        }
        const join =
          embeddedTestingOnlyJoins[idx - 1] === "or"
            ? t("admin.plannerIntegration.rulesPreview.joinOr")
            : t("admin.plannerIntegration.rulesPreview.joinAnd");
        return `${join} ${expression}`;
      })
      .join(" ");
  }, [embeddedTestingOnlyJoins, embeddedTestingOnlyRules, fieldRows, t]);

  const footerSummaryText = useMemo(() => {
    if (activeSubtab === "statuses-mapping") {
      return t("admin.plannerIntegration.footer.summaryStatuses", {
        total: statusMappingStats.total,
        categories: statusMappingStats.categories,
        customColor: statusMappingStats.customColor,
      });
    }
    if (activeSubtab === "process-setup") {
      return t("admin.plannerIntegration.footer.summaryPlatforms", {
        total: platformMappingStats.total,
        unmapped: platformMappingStats.unmapped,
        changed: platformMappingStats.changed,
      });
    }
    if (activeSubtab === "other") {
      return releasesTabVisible
        ? t("admin.plannerIntegration.footer.summaryOtherVisible")
        : t("admin.plannerIntegration.footer.summaryOtherHidden");
    }
    return t("admin.plannerIntegration.footer.summaryPlatforms", {
      total: platformMappingStats.total,
      unmapped: platformMappingStats.unmapped,
      changed: platformMappingStats.changed,
    });
  }, [
    activeSubtab,
    platformMappingStats,
    releasesTabVisible,
    statusMappingStats,
    t,
  ]);

  const applyLoadedConfig = useCallback(
    (cfg: TrackerConfigShape | undefined) => {
      setConfigBase(cloneConfigWithoutRevision(cfg));
      if (!cfg) {
        setRevision(null);
        setReleasesTabVisible(true);
        setReleaseReadyStatusKey("");
        setReleaseMrFieldId("");
        initialIntegrationSnapshotRef.current = {
          hadEmbeddedTestingOnlyExtraRules: false,
          hadPlatformField: false,
          hadPlatformMap: false,
        };
        return;
      }
      const rev = cfg.configRevision;
      setRevision(typeof rev === "number" ? rev : 0);
      const th = pickOccupancyThresholds(cfg);
      setMinSp(th.minSp);
      setMinTp(th.minTp);
      const rel = pickReleaseReadinessForm(cfg);
      setReleasesTabVisible(rel.releasesTabVisible);
      setReleaseReadyStatusKey(rel.readyStatusKey);
      setReleaseMrFieldId(rel.mrFieldId);
      const flow = pickTestingFlowStrings(cfg);
      setDevAssigneeFieldId(flow.devAssigneeFieldId);
      setDevEstimateFieldId(flow.devEstimateFieldId);
      setQaEngineerFieldId(flow.qaEngineerFieldId);
      setQaEstimateFieldId(flow.qaEstimateFieldId);
      setTestingFlowMode(pickTestingFlowMode(cfg));
      setZeroDevPositiveQa(pickZeroDevPositiveQa(cfg));
      const embeddedForm = pickEmbeddedTestingOnlyForm(cfg);
      setEmbeddedTestingOnlyRules(embeddedForm.rules);
      setEmbeddedTestingOnlyJoins(embeddedForm.joins);
      setPlatformFieldId(pickPlatformFieldId(cfg));
      setPlatformValueMap(pickPlatformValueMap(cfg));
      setStatusPaletteByKey(pickStatusPaletteOverrides(cfg));
      initialIntegrationSnapshotRef.current = {
        hadEmbeddedTestingOnlyExtraRules: embeddedForm.rules.length > 0,
        hadPlatformField: !!pickPlatformFieldId(cfg),
        hadPlatformMap: pickPlatformValueMap(cfg).length > 0,
      };
    },
    [],
  );

  const bumpIntegrationLoadNonce = useCallback(() => {
    setIntegrationLoadNonce((n) => n + 1);
  }, []);

  const applySaveSuccessRevision = useCallback(
    (data: { config?: { configRevision?: number } }) => {
      const rev = data.config?.configRevision;
      setRevision(typeof rev === "number" ? rev : null);
    },
    [],
  );

  useEffect(() => {
    if (fieldRows.length === 0) {
      return;
    }
    setReleaseMrFieldId((prev) =>
      prev ? toUiFieldValueFromStoredAccessor(fieldRows, prev) : prev,
    );
  }, [fieldRows]);

  useEffect(() => {
    if (trackerStatusesList.length === 0 && fieldRows.length === 0) {
      return;
    }
    if (lastReleaseDefaultsForLoadNonceRef.current === integrationLoadNonce) {
      return;
    }
    setReleaseReadyStatusKey((k) => {
      if (k.trim()) {
        return k;
      }
      const row = trackerStatusesList.find(
        (s) => s.key.trim().toLowerCase() === "rc",
      );
      return row?.key ?? k;
    });
    setReleaseMrFieldId((id) => {
      if (id.trim()) {
        return id;
      }
      return resolveFieldIdByAlias(fieldRows, "MergeRequestLink") || id;
    });
    lastReleaseDefaultsForLoadNonceRef.current = integrationLoadNonce;
  }, [fieldRows, integrationLoadNonce, trackerStatusesList]);

  useEffect(() => {
    if (fieldRows.length === 0) {
      return;
    }

    const ids = new Set(fieldRows.map((f) => f.id));
    const normalized = (current: string, fallbackAlias: string) => {
      if (current && ids.has(current)) {
        return current;
      }
      const fallback = resolveFieldIdByAlias(fieldRows, fallbackAlias);
      return fallback && ids.has(fallback) ? fallback : "";
    };

    if (testingFlowMode === "embedded") {
      setDevEstimateFieldId((prev) => normalized(prev, "storyPoints"));
      setQaEstimateFieldId((prev) => normalized(prev, "testPoints"));
      setQaEngineerFieldId((prev) => normalized(prev, "qaEngineer"));
      setDevAssigneeFieldId((prev) => normalized(prev, "assignee"));
      return;
    }

    setDevEstimateFieldId((prev) => normalized(prev, "storyPoints"));
    setDevAssigneeFieldId((prev) => normalized(prev, "assignee"));
  }, [fieldRows, testingFlowMode, revision]);

  useEffect(() => {
    const snap = initialIntegrationSnapshotRef.current;
    if (snap === null) {
      return;
    }
    if (snap.hadPlatformField) {
      return;
    }
    if (fieldRows.length === 0) {
      return;
    }
    const ftId = findFunctionalTeamFieldId(fieldRows);
    if (!ftId) {
      return;
    }
    setPlatformFieldId((cur) => (cur.trim() ? cur : ftId));
  }, [fieldRows, revision]);

  useEffect(() => {
    const snap = initialIntegrationSnapshotRef.current;
    if (snap === null || snap.hadPlatformMap) {
      return;
    }
    if (!platformFieldId.trim() || platformFieldValues.length === 0) {
      return;
    }
    setPlatformValueMap((prev) => {
      if (prev.length > 0) {
        return prev;
      }
      const auto = buildAutoPlatformValueMap(platformFieldValues);
      return auto.length > 0 ? auto : prev;
    });
  }, [platformFieldId, platformFieldValues, revision]);

  useEffect(() => {
    const snap = initialIntegrationSnapshotRef.current;
    if (snap === null || snap.hadEmbeddedTestingOnlyExtraRules) {
      return;
    }
    if (testingFlowMode !== "embedded") {
      return;
    }
    if (fieldRows.length === 0) {
      return;
    }
    const tpId = resolveFieldIdByAlias(fieldRows, "testPoints");
    const ftId = findFunctionalTeamFieldId(fieldRows);
    const qaVal = pickQaTrackerValueForConditions(
      platformValueMap,
      platformFieldValues,
    );
    const desiredRules = buildEmbeddedTestingOnlyAutoExtraRules({
      functionalTeamFieldId: ftId,
      qaEnumValue: qaVal,
      testPointsFieldId: tpId,
    });
    if (desiredRules.length === 0) {
      return;
    }
    if (
      !embeddedAutoRulesMatchDesiredPrefix(
        embeddedTestingOnlyRules,
        desiredRules,
      )
    ) {
      return;
    }
    const desiredJoins = embeddedTestingOnlyJoinsForRuleCount(
      desiredRules.length,
    );
    const rulesSame =
      JSON.stringify(embeddedTestingOnlyRules) === JSON.stringify(desiredRules);
    const joinsSame =
      JSON.stringify(embeddedTestingOnlyJoins) === JSON.stringify(desiredJoins);
    if (rulesSame && joinsSame) {
      return;
    }
    setEmbeddedTestingOnlyRules(desiredRules);
    setEmbeddedTestingOnlyJoins(desiredJoins);
  }, [
    embeddedTestingOnlyJoins,
    embeddedTestingOnlyRules,
    fieldRows,
    platformFieldValues,
    platformValueMap,
    revision,
    testingFlowMode,
  ]);

  useEffect(() => {
    if (testingFlowMode !== "standalone") {
      return;
    }
    const snap = initialIntegrationSnapshotRef.current;
    if (snap === null || snap.hadEmbeddedTestingOnlyExtraRules) {
      return;
    }
    setEmbeddedTestingOnlyRules([]);
    setEmbeddedTestingOnlyJoins([]);
  }, [testingFlowMode, revision]);

  return {
    activeSubtab,
    allFieldSelectOptions,
    applyLoadedConfig,
    applySaveSuccessRevision,
    bumpIntegrationLoadNonce,
    configBase,
    devAssigneeFieldId,
    devEstimateFieldId,
    draftConfig,
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
    zeroDevPositiveQa,
  };
}
