import type { TrackerConfigShape, TrackerStatusRowMeta } from "../types";
import type { Dispatch, SetStateAction } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useI18n } from "@/contexts/LanguageContext";

export interface TrackerMetadataFieldRow {
  display?: string;
  id: string;
  key?: string;
  name?: string;
  options?: string[];
  schemaType?: string;
}

const plannerIntegrationRulesKey = (organizationId: string) =>
  ["planner-integration-rules", organizationId] as const;

export function useTrackerIntegrationLoadSave(options: {
  applyLoadedConfig: (cfg: TrackerConfigShape | undefined) => void;
  onAfterIntegrationLoad?: () => void;
  onSaveSuccess?: (data: {
    config?: { configRevision?: number };
  }) => void;
  organizationId: string;
}) {
  const {
    applyLoadedConfig,
    onAfterIntegrationLoad,
    onSaveSuccess,
    organizationId,
  } = options;
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onAfterIntegrationLoadRef = useRef(onAfterIntegrationLoad);
  onAfterIntegrationLoadRef.current = onAfterIntegrationLoad;
  const onSaveSuccessRef = useRef(onSaveSuccess);
  onSaveSuccessRef.current = onSaveSuccess;

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${organizationId}/tracker-integration`,
        { credentials: "include" },
      );
      const data = (await res.json()) as {
        config?: TrackerConfigShape;
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error ?? t("admin.plannerIntegration.loadFailed"),
        );
        return;
      }
      applyLoadedConfig(data.config);
      onAfterIntegrationLoadRef.current?.();
    } catch {
      toast.error(t("admin.common.networkError"));
    } finally {
      setLoading(false);
    }
  }, [applyLoadedConfig, organizationId, t]);

  const saveTrackerIntegration = useCallback(
    async (draftConfig: TrackerConfigShape) => {
      if (!organizationId) return;
      setSaving(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${organizationId}/tracker-integration`,
          {
            body: JSON.stringify(draftConfig),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          },
        );
        const data = (await res.json()) as {
          config?: { configRevision?: number };
          error?: string;
          issues?: unknown;
        };
        if (!res.ok) {
          toast.error(
            data.error ?? t("admin.plannerIntegration.saveFailed"),
          );
          return;
        }
        onSaveSuccessRef.current?.(data);
        toast.success(t("admin.plannerIntegration.saved"));
        await queryClient.invalidateQueries({
          queryKey: plannerIntegrationRulesKey(organizationId),
        });
        await load();
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setSaving(false);
      }
    },
    [load, organizationId, queryClient, t],
  );

  return {
    load,
    loading,
    saveTrackerIntegration,
    saving,
  };
}

export function useTrackerMetadataLoad(options: {
  organizationId: string;
  setFieldRows: Dispatch<SetStateAction<TrackerMetadataFieldRow[]>>;
  setTrackerStatusesList: Dispatch<SetStateAction<TrackerStatusRowMeta[]>>;
}) {
  const { organizationId, setFieldRows, setTrackerStatusesList } = options;
  const { language, t } = useI18n();
  const sortLocale = language === "ru" ? "ru" : "en";
  const [metaLoading, setMetaLoading] = useState(false);

  const loadMetadata = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!organizationId) return;
      setMetaLoading(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${organizationId}/tracker-metadata?resource=all`,
          { credentials: "include" },
        );
        const data = (await res.json()) as {
          error?: string;
          fields?: TrackerMetadataFieldRow[];
          statuses?: unknown[];
        };
        if (!res.ok) {
          toast.error(
            data.error ?? t("admin.plannerIntegration.loadMetaFailed"),
          );
          return;
        }
        const fields = data.fields ?? [];
        const statuses = (data.statuses ?? []) as Array<{
          display?: string;
          key?: string;
          statusType?: { key?: string };
        }>;
        setFieldRows(fields);
        const statusRowsMeta: TrackerStatusRowMeta[] = [];
        for (const s of statuses) {
          const key = typeof s.key === "string" ? s.key.trim() : "";
          if (!key) {
            continue;
          }
          const tk =
            s.statusType && typeof s.statusType.key === "string"
              ? s.statusType.key.trim()
              : undefined;
          statusRowsMeta.push({
            display: typeof s.display === "string" ? s.display : key,
            key,
            statusTypeKey: tk || undefined,
          });
        }
        statusRowsMeta.sort((a, b) =>
          a.key.localeCompare(b.key, sortLocale),
        );
        setTrackerStatusesList(statusRowsMeta);
        if (!opts?.silent) {
          toast.success(
            t("admin.plannerIntegration.loadMetaSuccess", {
              fields: fields.length,
              statuses: statuses.length,
            }),
          );
        }
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setMetaLoading(false);
      }
    },
    [organizationId, setFieldRows, setTrackerStatusesList, sortLocale, t],
  );

  return { loadMetadata, metaLoading };
}

export function useTrackerPlatformFieldValues(
  organizationId: string,
  platformFieldId: string,
) {
  const [platformFieldValues, setPlatformFieldValues] = useState<string[]>([]);

  useEffect(() => {
    if (!organizationId || !platformFieldId.trim()) {
      setPlatformFieldValues([]);
      return;
    }
    let cancelled = false;

    async function loadPlatformFieldValues() {
      try {
        const res = await fetch(
          `/api/admin/organizations/${organizationId}/tracker-metadata?resource=field-values&fieldId=${encodeURIComponent(platformFieldId)}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as {
          error?: string;
          values?: string[];
        };
        if (!res.ok) {
          return;
        }
        if (!cancelled) {
          setPlatformFieldValues(Array.isArray(data.values) ? data.values : []);
        }
      } catch {
        if (!cancelled) {
          setPlatformFieldValues([]);
        }
      }
    }

    void loadPlatformFieldValues();
    return () => {
      cancelled = true;
    };
  }, [organizationId, platformFieldId]);

  return platformFieldValues;
}
