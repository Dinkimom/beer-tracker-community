import type { ConfirmDialogPromptOptions } from "@/components/ConfirmDialog";
import type { CustomSelectOption } from "@/components/CustomSelect";
import type { AdminTeamRow, AdminTrackerCatalogPayload } from "@/features/admin/adminTeamCatalog";
import type { FormEvent } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useI18n } from "@/contexts/LanguageContext";
import {
  teamTitleUsingBoard,
  teamTitleUsingQueue,
} from "@/features/admin/adminTeamCatalog";
import { invalidateBoardsQuery } from "@/features/board/boardsQuery";
import { generateTeamSlugFromTitle } from "@/lib/staffTeams/teamSlugGenerate";

export interface UseAdminTeamsPageParams {
  initialTeams: AdminTeamRow[];
  isOrgAdmin: boolean;
  orgId: string;
  confirmDestructive: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
}

export function useAdminTeamsPage({
  confirmDestructive,
  initialTeams,
  isOrgAdmin,
  orgId,
}: UseAdminTeamsPageParams) {
  const { language, t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [teamsList, setTeamsList] = useState(initialTeams);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [trackerCatalog, setTrackerCatalog] = useState<AdminTrackerCatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [newTeamTitle, setNewTeamTitle] = useState("");
  const [selectTeamQueue, setSelectTeamQueue] = useState("");
  const [selectTeamBoard, setSelectTeamBoard] = useState("");
  const [teamFormSubmitting, setTeamFormSubmitting] = useState(false);
  const [teamBusyId, setTeamBusyId] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!orgId) return;
    setTeamsLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/teams`, { credentials: "include" });
      const data = (await res.json()) as { error?: string; teams?: AdminTeamRow[] };
      if (!res.ok) {
        toast.error(data.error ?? t("admin.teamsPage.loadTeamsFailed"));
        setTeamsList([]);
        return;
      }
      setTeamsList(Array.isArray(data.teams) ? data.teams : []);
    } catch {
      toast.error(t("admin.teamsPage.loadTeamsNetworkError"));
      setTeamsList([]);
    } finally {
      setTeamsLoading(false);
    }
  }, [orgId, t]);

  const loadTrackerCatalog = useCallback(async () => {
    if (!orgId) return;
    setCatalogLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/teams/tracker-catalog`, {
        credentials: "include",
      });
      const data = (await res.json()) as AdminTrackerCatalogPayload & { error?: string };
      if (!res.ok) {
        setTrackerCatalog(null);
        toast.error(data.error ?? t("admin.teamsPage.catalogLoadFailed"));
        return;
      }
      setTrackerCatalog({
        boards: Array.isArray(data.boards) ? data.boards : [],
        queues: Array.isArray(data.queues) ? data.queues : [],
        teams: Array.isArray(data.teams) ? data.teams : [],
      });
    } catch {
      setTrackerCatalog(null);
      toast.error(t("admin.teamsPage.catalogLoadNetworkError"));
    } finally {
      setCatalogLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => {
    if (!isOrgAdmin) return;
    void loadTrackerCatalog();
  }, [isOrgAdmin, loadTrackerCatalog]);

  useEffect(() => {
    if (!trackerCatalog) return;
    const bindings = trackerCatalog.teams;
    setSelectTeamQueue((q) => {
      if (!q.trim()) return q;
      return teamTitleUsingQueue(bindings, q) ? "" : q;
    });
    setSelectTeamBoard((b) => {
      if (!b.trim()) return b;
      const n = Number.parseInt(b, 10);
      return teamTitleUsingBoard(bindings, n) ? "" : b;
    });
  }, [trackerCatalog]);

  const newTeamSlugPreview = useMemo(
    () => generateTeamSlugFromTitle(newTeamTitle),
    [newTeamTitle],
  );

  const queueSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    const bindings = trackerCatalog?.teams ?? [];
    const head: CustomSelectOption<string>[] = [{ label: t("admin.teamsPage.selectQueue"), value: "" }];
    if (!trackerCatalog?.queues.length) return head;
    return [
      ...head,
      ...trackerCatalog.queues.map((q) => {
        const owner = teamTitleUsingQueue(bindings, q.key);
        const taken = owner != null;
        return {
          disabled: taken,
          label: taken
            ? t("admin.teamsPage.queueTaken", { name: q.name, key: q.key, owner })
            : t("admin.teamsPage.queueFree", { name: q.name, key: q.key }),
          value: q.key,
        };
      }),
    ];
  }, [trackerCatalog, t]);

  const boardNameById = useMemo(() => {
    const m = new Map<number, string>();
    const boards = trackerCatalog?.boards;
    if (!boards?.length) return m;
    for (const b of boards) {
      m.set(b.id, b.name);
    }
    return m;
  }, [trackerCatalog]);

  const boardSelectOptions = useMemo((): CustomSelectOption<string>[] => {
    const bindings = trackerCatalog?.teams ?? [];
    const head: CustomSelectOption<string>[] = [{ label: t("admin.teamsPage.selectBoard"), value: "" }];
    if (!trackerCatalog?.boards.length) return head;
    const sorted = [...trackerCatalog.boards].sort((a, b) =>
      a.name.localeCompare(b.name, language, { sensitivity: "base" }),
    );
    return [
      ...head,
      ...sorted.map((b) => {
        const owner = teamTitleUsingBoard(bindings, b.id);
        const taken = owner != null;
        const idStr = String(b.id);
        return {
          disabled: taken,
          label: taken
            ? t("admin.teamsPage.boardTaken", { name: b.name, id: idStr, owner })
            : t("admin.teamsPage.boardFree", { name: b.name, id: idStr }),
          value: idStr,
        };
      }),
    ];
  }, [language, trackerCatalog, t]);

  const submitNewTeam = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!orgId) return;
      const title = newTeamTitle.trim();
      const queue = selectTeamQueue.trim();
      const boardRaw = selectTeamBoard.trim();
      if (!title) {
        toast.error(t("admin.teamsPage.titleRequired"));
        return;
      }
      if (!queue) {
        toast.error(t("admin.teamsPage.queueRequired"));
        return;
      }
      if (!boardRaw) {
        toast.error(t("admin.teamsPage.boardRequired"));
        return;
      }
      const boardNum = Number.parseInt(boardRaw, 10);
      if (!Number.isFinite(boardNum) || boardNum <= 0) {
        toast.error(t("admin.teamsPage.invalidBoard"));
        return;
      }
      const bindings = trackerCatalog?.teams ?? [];
      const qOwner = teamTitleUsingQueue(bindings, queue);
      if (qOwner) {
        toast.error(t("admin.teamsPage.queueTakenByTeam", { team: qOwner }));
        return;
      }
      const bOwner = teamTitleUsingBoard(bindings, boardNum);
      if (bOwner) {
        toast.error(t("admin.teamsPage.boardTakenByTeam", { team: bOwner }));
        return;
      }
      setTeamFormSubmitting(true);
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/teams`, {
          body: JSON.stringify({ title, tracker_board_id: boardNum, tracker_queue_key: queue }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json()) as { error?: string; team?: AdminTeamRow };
        if (!res.ok) {
          toast.error(data.error ?? t("admin.teamsPage.createFailed"));
          return;
        }
        toast.success(t("admin.teamsPage.createSuccess"));
        setNewTeamTitle("");
        setSelectTeamQueue("");
        setSelectTeamBoard("");
        await loadTeams();
        await loadTrackerCatalog();
        await invalidateBoardsQuery(queryClient);
        router.refresh();
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setTeamFormSubmitting(false);
      }
    },
    [
      loadTeams,
      loadTrackerCatalog,
      newTeamTitle,
      orgId,
      queryClient,
      router,
      selectTeamBoard,
      selectTeamQueue,
      t,
      trackerCatalog,
    ],
  );

  const setTeamActive = useCallback(
    async (teamId: string, active: boolean) => {
      if (!orgId) return;
      setTeamBusyId(teamId);
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/teams/${teamId}`, {
          body: JSON.stringify({ active }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? t("admin.teamsPage.updateFailed"));
          return;
        }
        toast.success(active ? t("admin.teamsPage.teamEnabled") : t("admin.teamsPage.teamDisabled"));
        await loadTeams();
        await invalidateBoardsQuery(queryClient);
        router.refresh();
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setTeamBusyId(null);
      }
    },
    [loadTeams, orgId, queryClient, router, t],
  );

  const removeTeam = useCallback(
    async (teamId: string) => {
      if (!orgId) return;
      const confirmed = await confirmDestructive(t("admin.teamsPage.deleteTeamBody"), {
        confirmText: t("admin.teamsPage.deleteTeamConfirm"),
        title: t("admin.teamsPage.deleteTeamTitle"),
        variant: "destructive",
      });
      if (!confirmed) return;
      setTeamBusyId(teamId);
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/teams/${teamId}`, {
          credentials: "include",
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? t("admin.teamsPage.deleteFailed"));
          return;
        }
        toast.success(t("admin.teamsPage.deleteSuccess"));
        await loadTeams();
        await loadTrackerCatalog();
        await invalidateBoardsQuery(queryClient);
        router.refresh();
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setTeamBusyId(null);
      }
    },
    [confirmDestructive, loadTeams, loadTrackerCatalog, orgId, queryClient, router, t],
  );

  const teamHref = useCallback((teamId: string) => `/admin/teams/${teamId}`, []);

  return {
    boardNameById,
    boardSelectOptions,
    catalogLoading,
    loadTeams,
    loadTrackerCatalog,
    newTeamSlugPreview,
    newTeamTitle,
    orgId,
    queueSelectOptions,
    removeTeam,
    selectTeamBoard,
    selectTeamQueue,
    setNewTeamTitle,
    setSelectTeamBoard,
    setSelectTeamQueue,
    setTeamActive,
    submitNewTeam,
    teamBusyId,
    teamFormSubmitting,
    teamHref,
    teamsList,
    teamsLoading,
    trackerCatalog,
  };
}
