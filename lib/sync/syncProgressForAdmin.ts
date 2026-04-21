/**
 * Human-readable progress lines for the admin UI (Redis job meta / sync_runs.stats).
 */

export type SyncProgressTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function describeChangelogFetchProgress(
  input: {
    batchIndex?: number;
    batchTotal?: number;
    keysDone: number;
    keysTotal: number;
  },
  t: SyncProgressTranslate,
): string {
  const { batchIndex, batchTotal, keysDone, keysTotal } = input;
  if (keysTotal === 0) {
    return t("admin.syncProgress.changelog.noTasks");
  }
  if (keysDone === 0) {
    return t("admin.syncProgress.changelog.requesting", { count: keysTotal });
  }
  const batchPart =
    batchIndex != null &&
    batchTotal != null &&
    batchIndex > 0 &&
    batchTotal > 0
      ? t("admin.syncProgress.changelog.batch", {
          current: batchIndex,
          total: batchTotal,
        })
      : "";
  return t("admin.syncProgress.changelog.progress", {
    done: keysDone,
    total: keysTotal,
    batch: batchPart,
  });
}

function changelogProgressLineFromJobMeta(
  meta: Record<string, unknown>,
  t: SyncProgressTranslate,
): string | null {
  const kd = meta.changelogKeysDone;
  const kt = meta.changelogKeysTotal;
  if (typeof kd !== "number" || typeof kt !== "number") {
    return null;
  }
  return describeChangelogFetchProgress(
    {
      batchIndex:
        typeof meta.changelogBatchIndex === "number"
          ? meta.changelogBatchIndex
          : undefined,
      batchTotal:
        typeof meta.changelogBatchTotal === "number"
          ? meta.changelogBatchTotal
          : undefined,
      keysDone: kd,
      keysTotal: kt,
    },
    t,
  );
}

function changelogProgressLineFromStats(
  stats: Record<string, unknown>,
  t: SyncProgressTranslate,
): string | null {
  const cf = stats.changelog_fetch;
  if (cf == null || typeof cf !== "object" || Array.isArray(cf)) {
    return null;
  }
  const c = cf as Record<string, unknown>;
  const keysDone = Number(c.keys_done);
  const keysTotal = Number(c.keys_total);
  if (!Number.isFinite(keysDone) || !Number.isFinite(keysTotal)) {
    return null;
  }
  const bi = Number(c.batch_index);
  const bt = Number(c.batch_total);
  return describeChangelogFetchProgress(
    {
      batchIndex: Number.isFinite(bi) ? bi : undefined,
      batchTotal: Number.isFinite(bt) ? bt : undefined,
      keysDone,
      keysTotal,
    },
    t,
  );
}

export function redisJobStateLabel(
  state: string,
  t: SyncProgressTranslate,
  has: (key: string) => boolean,
): string {
  const key = `admin.syncProgress.redisJob.${state}`;
  return has(key) ? t(key) : state;
}

export function describeSyncProgressMeta(
  meta: Record<string, unknown> | null | undefined,
  t: SyncProgressTranslate,
): string | null {
  if (meta == null) {
    return null;
  }
  const phase = meta.phase;
  if (phase === "fetch_boards") {
    const bi = meta.boardIndex;
    const bt = meta.boardTotal;
    const page = meta.page;
    const tp = meta.totalPages;
    const ic = meta.issuesCollected;
    if (
      typeof bi === "number" &&
      typeof bt === "number" &&
      typeof page === "number" &&
      typeof tp === "number"
    ) {
      const issues =
        typeof ic === "number"
          ? t("admin.syncProgress.meta.issuesSuffix", { count: ic })
          : "";
      return t("admin.syncProgress.meta.fetchBoards", {
        bi,
        bt,
        page,
        tp,
        issues,
      });
    }
  }
  if (phase === "list_boards" && typeof meta.boards_total === "number") {
    return t("admin.syncProgress.meta.listBoards", { count: meta.boards_total });
  }
  if (phase === "fetch_start" && typeof meta.boards_total === "number") {
    return t("admin.syncProgress.meta.fetchStart", { count: meta.boards_total });
  }
  if (phase === "upsert_start") {
    return t("admin.syncProgress.meta.upsertStart");
  }
  if (phase === "changelog_fetch") {
    const line = changelogProgressLineFromJobMeta(meta, t);
    if (line != null) {
      return line;
    }
  }
  if (phase === "upsert_done" && typeof meta.issues_upserted === "number") {
    return t("admin.syncProgress.meta.upsertDone", { count: meta.issues_upserted });
  }
  if (phase === "no_boards") {
    return t("admin.syncProgress.meta.noBoards");
  }
  return null;
}

export function describeStatsCheckpoint(
  stats: Record<string, unknown> | null | undefined,
  t: SyncProgressTranslate,
): string | null {
  if (stats == null) {
    return null;
  }
  if (stats.phase === "changelog_fetch") {
    const line = changelogProgressLineFromStats(stats, t);
    if (line != null) {
      return line;
    }
  }
  const raw = stats.full_sync_checkpoint;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const c = raw as Record<string, unknown>;
  const bi = c.board_index;
  const bt = c.board_total;
  const page = c.page;
  const tp = c.total_pages;
  const total = stats.issues_total_so_far;
  if (
    typeof bi === "number" &&
    typeof bt === "number" &&
    typeof page === "number" &&
    typeof tp === "number"
  ) {
    const totalPart =
      typeof total === "number"
        ? t("admin.syncProgress.statsCheckpoint.totalSuffix", { count: total })
        : "";
    return t("admin.syncProgress.statsCheckpoint.boardLine", {
      bi,
      bt,
      page,
      tp,
      total: totalPart,
    });
  }
  return null;
}
