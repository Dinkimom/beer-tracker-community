import type {
  EmbeddedTestingOnlyJoin,
  EmbeddedTestingOnlyOperator,
  EmbeddedTestingOnlyRuleForm,
  PlatformValueMapFormRow,
  TrackerConfigShape,
} from "./types";

import { canonicalPaletteKey } from "@/utils/statusColors";

import { toStoredFieldAccessor } from "./embeddedTestingRuleFieldHelpers";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

export function cloneConfigWithoutRevision(
  cfg: TrackerConfigShape | undefined,
): TrackerConfigShape {
  if (!cfg) {
    return {};
  }
  const rest = { ...cfg };
  delete rest.configRevision;
  try {
    return JSON.parse(JSON.stringify(rest)) as TrackerConfigShape;
  } catch {
    return {};
  }
}

export function pickTestingFlowStrings(cfg: TrackerConfigShape | undefined): {
  devAssigneeFieldId: string;
  devEstimateFieldId: string;
  qaEngineerFieldId: string;
  qaEstimateFieldId: string;
} {
  const tf = asRecord(cfg?.testingFlow);
  return {
    devAssigneeFieldId:
      typeof tf?.devAssigneeFieldId === "string" ? tf.devAssigneeFieldId : "",
    devEstimateFieldId:
      typeof tf?.devEstimateFieldId === "string" ? tf.devEstimateFieldId : "",
    qaEngineerFieldId:
      typeof tf?.qaEngineerFieldId === "string" ? tf.qaEngineerFieldId : "",
    qaEstimateFieldId:
      typeof tf?.qaEstimateFieldId === "string" ? tf.qaEstimateFieldId : "",
  };
}

function isEmbeddedTestingOperator(
  v: unknown,
): v is EmbeddedTestingOnlyOperator {
  return v === "eq" || v === "gt" || v === "lt" || v === "gte" || v === "lte";
}

export function pickEmbeddedTestingOnlyForm(cfg: TrackerConfigShape | undefined): {
  joins: EmbeddedTestingOnlyJoin[];
  rules: EmbeddedTestingOnlyRuleForm[];
} {
  const tf = asRecord(cfg?.testingFlow);
  const raw = tf?.embeddedTestingOnlyRules;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { rules: [], joins: [] };
  }

  const first = asRecord(raw[0]);
  const joinsStored = Array.isArray(tf?.embeddedTestingOnlyJoins)
    ? (tf.embeddedTestingOnlyJoins as unknown[]).filter(
        (x): x is EmbeddedTestingOnlyJoin => x === "and" || x === "or",
      )
    : [];

  if (first && isEmbeddedTestingOperator(first.operator)) {
    const rules: EmbeddedTestingOnlyRuleForm[] = [];
    for (const row of raw) {
      const rec = asRecord(row);
      const fieldId =
        typeof rec?.fieldId === "string" ? rec.fieldId.trim() : "";
      const op = rec?.operator;
      const value = typeof rec?.value === "string" ? rec.value : "";
      if (!fieldId || !isEmbeddedTestingOperator(op)) {
        continue;
      }
      rules.push({ fieldId, operator: op, value });
    }
    const need = Math.max(0, rules.length - 1);
    const joins: EmbeddedTestingOnlyJoin[] = [];
    for (let i = 0; i < need; i++) {
      joins.push(joinsStored[i] === "or" ? "or" : "and");
    }
    return { rules, joins };
  }

  const rules: EmbeddedTestingOnlyRuleForm[] = [];
  const joins: EmbeddedTestingOnlyJoin[] = [];
  for (const row of raw) {
    const rec = asRecord(row);
    const fieldId = typeof rec?.fieldId === "string" ? rec.fieldId.trim() : "";
    if (!fieldId) {
      continue;
    }
    const valsRaw = Array.isArray(rec?.values) ? rec.values : [];
    const vals = valsRaw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (vals.length === 0) {
      continue;
    }
    if (rules.length > 0) {
      joins.push("and");
    }
    for (let i = 0; i < vals.length; i++) {
      if (rules.length > 0 && i > 0) {
        joins.push("or");
      }
      rules.push({ fieldId, operator: "eq", value: vals[i]! });
    }
  }
  return { rules, joins };
}

export function pickTestingFlowMode(
  cfg: TrackerConfigShape | undefined,
): "embedded" | "standalone" {
  const m = asRecord(cfg?.testingFlow)?.mode;
  return m === "standalone_qa_tasks" ? "standalone" : "embedded";
}

export function pickPlatformFieldId(cfg: TrackerConfigShape | undefined): string {
  const p = asRecord(cfg?.platform);
  return typeof p?.fieldId === "string" ? p.fieldId : "";
}

export function pickPlatformValueMap(
  cfg: TrackerConfigShape | undefined,
): PlatformValueMapFormRow[] {
  const p = asRecord(cfg?.platform);
  const vm = p?.valueMap;
  if (!Array.isArray(vm)) {
    return [];
  }
  const out: PlatformValueMapFormRow[] = [];
  for (const row of vm) {
    const r = asRecord(row);
    const trackerValue =
      typeof r?.trackerValue === "string" ? r.trackerValue.trim() : "";
    const platform = r?.platform;
    if (
      trackerValue &&
      (platform === "Back" ||
        platform === "Web" ||
        platform === "QA" ||
        platform === "DevOps")
    ) {
      out.push({ platform, trackerValue });
    }
  }
  return out;
}

export function pickZeroDevPositiveQa(cfg: TrackerConfigShape | undefined): boolean {
  return asRecord(cfg?.testingFlow)?.zeroDevPositiveQaRule === true;
}

export function nextPaletteMap(
  prev: Record<string, string>,
  statusKey: string,
  next: string,
): Record<string, string> {
  const copy = { ...prev };
  if (!next.trim()) {
    delete copy[statusKey];
  } else {
    copy[statusKey] = canonicalPaletteKey(next);
  }
  return copy;
}

export function pickStatusPaletteOverrides(
  cfg: TrackerConfigShape | undefined,
): Record<string, string> {
  const st = asRecord(cfg?.statuses);
  const ov = st?.overridesByStatusKey;
  if (!ov || typeof ov !== "object" || Array.isArray(ov)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(ov as Record<string, unknown>)) {
    const r = asRecord(raw);
    const palette =
      typeof r?.visualToken === "string" ? r.visualToken.trim() : "";
    if (palette) {
      out[key] = canonicalPaletteKey(palette);
    }
  }
  return out;
}

export function pickOccupancyThresholds(cfg: TrackerConfigShape | undefined): {
  minSp: string;
  minTp: string;
} {
  const vt = asRecord(cfg?.validationThresholds);
  const occ = asRecord(vt?.occupancy);
  return {
    minSp:
      typeof occ?.minStoryPointsForAssignee === "number" &&
      Number.isFinite(occ.minStoryPointsForAssignee)
        ? String(occ.minStoryPointsForAssignee)
        : "",
    minTp:
      typeof occ?.minTestPointsForAssignee === "number" &&
      Number.isFinite(occ.minTestPointsForAssignee)
        ? String(occ.minTestPointsForAssignee)
        : "",
  };
}

export function pickReleaseReadinessForm(cfg: TrackerConfigShape | undefined): {
  mrFieldId: string;
  readyStatusKey: string;
  releasesTabVisible: boolean;
} {
  const rr = asRecord(cfg?.releaseReadiness);
  return {
    mrFieldId:
      typeof rr?.mergeRequestFieldId === "string"
        ? rr.mergeRequestFieldId.trim()
        : "",
    readyStatusKey:
      typeof rr?.readyStatusKey === "string" ? rr.readyStatusKey.trim() : "",
    releasesTabVisible: rr?.releasesTabVisible !== false,
  };
}

export function fieldRowIsStringLike(row: { schemaType?: string } | undefined): boolean {
  if (!row) {
    return false;
  }
  const t = (row.schemaType ?? "").toLowerCase();
  return (
    t === "string" ||
    t === "text" ||
    t === "url" ||
    t === "uri" ||
    t === "link"
  );
}

export function embeddedAutoRulesMatchDesiredPrefix(
  prev: EmbeddedTestingOnlyRuleForm[],
  desired: EmbeddedTestingOnlyRuleForm[],
): boolean {
  if (prev.length === 0) {
    return true;
  }
  if (prev.length > desired.length) {
    return false;
  }
  return prev.every(
    (r, i) =>
      r.fieldId === desired[i].fieldId &&
      r.operator === desired[i].operator &&
      r.value === desired[i].value,
  );
}

export function resolveFieldIdByAlias(
  rows: Array<{ id: string; key?: string; name?: string; display?: string }>,
  alias: string,
): string {
  const needle = alias.trim().toLowerCase();
  if (!needle) {
    return "";
  }
  const row = rows.find((r) => {
    const id = r.id.trim().toLowerCase();
    const key = (r.key ?? "").trim().toLowerCase();
    const name = (r.name ?? "").trim().toLowerCase();
    const display = (r.display ?? "").trim().toLowerCase();
    return (
      id === needle || key === needle || name === needle || display === needle
    );
  });
  return row?.id ?? "";
}

/** Подпись в селектах: без повторов одного и того же текста (регистр не важен). */
export function joinAdminMetaLabels(
  parts: Array<string | null | undefined>,
  fallback: string,
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = (p ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.length > 0 ? out.join(" · ") : fallback;
}

export function mergeFormIntoConfig(
  base: TrackerConfigShape,
  form: {
    devAssigneeFieldId: string;
    devEstimateFieldId: string;
    embeddedTestingOnlyJoins: EmbeddedTestingOnlyJoin[];
    embeddedTestingOnlyRules: EmbeddedTestingOnlyRuleForm[];
    minSp: string;
    minTp: string;
    platformFieldId: string;
    platformValueMap: PlatformValueMapFormRow[];
    qaEngineerFieldId: string;
    qaEstimateFieldId: string;
    releaseMrFieldId: string;
    releaseReadyStatusKey: string;
    releasesTabVisible: boolean;
    statusPaletteByKey: Record<string, string>;
    testingFlowMode: "embedded" | "standalone";
    zeroDevPositiveQa: boolean;
  },
  fieldRows: Array<{ id: string; key?: string }>,
): TrackerConfigShape {
  const next: TrackerConfigShape = { ...base };

  const platformFieldId = form.platformFieldId.trim();
  const nextValueMap = form.platformValueMap
    .map((row) => ({
      platform: row.platform,
      trackerValue: row.trackerValue.trim(),
    }))
    .filter((row) => row.trackerValue);
  if (platformFieldId && nextValueMap.length > 0) {
    next.platform = {
      fieldId: platformFieldId,
      source: "field",
      valueMap: nextValueMap,
    };
  } else {
    delete next.platform;
  }

  const tfBase = asRecord(next.testingFlow) ?? {};
  const tf: Record<string, unknown> = { ...tfBase };
  if (form.testingFlowMode === "standalone") {
    tf.mode = "standalone_qa_tasks";
  } else {
    delete tf.mode;
  }
  if (form.zeroDevPositiveQa) {
    tf.zeroDevPositiveQaRule = true;
  } else {
    delete tf.zeroDevPositiveQaRule;
  }
  const setOpt = (k: string, v: string) => {
    const t = v.trim();
    if (t) {
      tf[k] = t;
    } else {
      delete tf[k];
    }
  };
  setOpt("devAssigneeFieldId", form.devAssigneeFieldId);
  setOpt("devEstimateFieldId", form.devEstimateFieldId);
  setOpt("qaEngineerFieldId", form.qaEngineerFieldId);
  setOpt("qaEstimateFieldId", form.qaEstimateFieldId);
  const embeddedRules = form.embeddedTestingOnlyRules
    .map((r) => ({
      fieldId: r.fieldId.trim(),
      operator: r.operator,
      value: r.value.trim(),
    }))
    .filter((r) => r.fieldId && r.value !== "");
  if (embeddedRules.length > 0) {
    tf.embeddedTestingOnlyRules = embeddedRules;
    const needJoins = embeddedRules.length - 1;
    if (needJoins > 0) {
      const j = form.embeddedTestingOnlyJoins.slice(0, needJoins);
      while (j.length < needJoins) {
        j.push("and");
      }
      tf.embeddedTestingOnlyJoins = j.map((x) => (x === "or" ? "or" : "and"));
    } else {
      delete tf.embeddedTestingOnlyJoins;
    }
  } else {
    delete tf.embeddedTestingOnlyRules;
    delete tf.embeddedTestingOnlyJoins;
  }
  if (Object.keys(tf).length > 0) {
    next.testingFlow = tf;
  } else {
    delete next.testingFlow;
  }

  const prevStatuses = asRecord(next.statuses) ?? {};
  const nextStatuses: Record<string, unknown> = { ...prevStatuses };
  const overrides: Record<string, { visualToken: string }> = {};
  for (const [rawKey, rawPal] of Object.entries(form.statusPaletteByKey)) {
    const k = rawKey.trim();
    const pal = rawPal.trim();
    if (!k || !pal) {
      continue;
    }
    overrides[k] = { visualToken: canonicalPaletteKey(pal) };
  }
  if (Object.keys(overrides).length > 0) {
    nextStatuses.overridesByStatusKey = overrides;
  } else {
    delete nextStatuses.overridesByStatusKey;
  }
  if (Object.keys(nextStatuses).length > 0) {
    next.statuses = nextStatuses;
  } else {
    delete next.statuses;
  }

  const vtBase = asRecord(next.validationThresholds) ?? {};
  const vt: Record<string, unknown> = { ...vtBase };
  const occBase = asRecord(vt.occupancy) ?? {};
  const occ: Record<string, unknown> = { ...occBase };
  if (form.minSp.trim() !== "") {
    const n = Number(form.minSp);
    if (Number.isFinite(n) && n >= 0) {
      occ.minStoryPointsForAssignee = n;
    }
  } else {
    delete occ.minStoryPointsForAssignee;
  }
  if (form.minTp.trim() !== "") {
    const n = Number(form.minTp);
    if (Number.isFinite(n) && n >= 0) {
      occ.minTestPointsForAssignee = n;
    }
  } else {
    delete occ.minTestPointsForAssignee;
  }
  if (Object.keys(occ).length > 0) {
    vt.occupancy = occ;
  } else {
    delete vt.occupancy;
  }
  if (Object.keys(vt).length > 0) {
    next.validationThresholds = vt;
  } else {
    delete next.validationThresholds;
  }

  const rk = form.releaseReadyStatusKey.trim();
  const mrRaw = form.releaseMrFieldId.trim();
  const mrStored = mrRaw ? toStoredFieldAccessor(fieldRows, mrRaw) : "";
  next.releaseReadiness = {
    releasesTabVisible: form.releasesTabVisible,
    ...(rk ? { readyStatusKey: rk } : {}),
    ...(mrStored ? { mergeRequestFieldId: mrStored } : {}),
  };

  return next;
}
