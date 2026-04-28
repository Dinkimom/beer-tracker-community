import type { ConfirmDialogPromptOptions } from "@/components/ConfirmDialog";
import type { CustomSelectOption } from "@/components/CustomSelect";
import type { AdminTeamMember } from "@/features/admin/adminTeamCatalog";
import type { RoleCatalogEntry } from "@/lib/roles/catalog";
import type { FormEvent } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useI18n } from "@/contexts/LanguageContext";
import {
  teamTitleUsingBoard,
  teamTitleUsingQueue,
  type AdminTrackerCatalogPayload,
  type AdminTeamRow,
} from "@/features/admin/adminTeamCatalog";
import { invalidateBoardsQuery } from "@/features/board/boardsQuery";

export interface UseAdminTeamDetailPageParams {
  initialMembers: AdminTeamMember[];
  initialTeam: AdminTeamRow;
  isOrgAdmin: boolean;
  orgId: string;
  confirmDestructive: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
}

export function useAdminTeamDetailPage({
  confirmDestructive,
  initialMembers,
  initialTeam,
  isOrgAdmin,
  orgId,
}: UseAdminTeamDetailPageParams) {
  const { language, t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editTitle, setEditTitle] = useState(initialTeam.title);
  const [editQueue, setEditQueue] = useState(initialTeam.tracker_queue_key);
  const [editBoard, setEditBoard] = useState(String(initialTeam.tracker_board_id));
  const [editSaving, setEditSaving] = useState(false);

  const [members, setMembers] = useState<AdminTeamMember[]>(initialMembers);
  const [addProductUserId, setAddProductUserId] = useState("");
  const [addCandidateOptions, setAddCandidateOptions] = useState<CustomSelectOption<string>[]>([
    { label: "", value: "" },
  ]);
  const [addCandidatesLoading, setAddCandidatesLoading] = useState(false);
  const [onPremMode, setOnPremMode] = useState(false);
  const [addTrackerUserId, setAddTrackerUserId] = useState("");
  const [addTrackerUserMeta, setAddTrackerUserMeta] = useState<{
    displayName?: string;
    email?: string | null;
  } | null>(null);
  const [addRoleSlug, setAddRoleSlug] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [inviteBusyStaffId, setInviteBusyStaffId] = useState<string | null>(null);
  const [productRoleBusyUserId, setProductRoleBusyUserId] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<AdminTrackerCatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [roleOptions, setRoleOptions] = useState<CustomSelectOption<string>[]>([{ label: "", value: "" }]);

  useEffect(() => {
    setAddCandidateOptions((prev) => {
      const rest = prev.length > 0 ? prev.slice(1) : [];
      return [{ label: t("admin.teamDetail.selectUser"), value: "" }, ...rest];
    });
    setRoleOptions((prev) => {
      const rest = prev.length > 0 ? prev.slice(1) : [];
      return [{ label: t("admin.teamDetail.noRole"), value: "" }, ...rest];
    });
  }, [language, t]);

  useEffect(() => {
    let cancelled = false;
    async function loadSetupState() {
      try {
        const res = await fetch("/api/onprem/setup-state", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { onPremMode?: boolean };
        if (!cancelled) {
          setOnPremMode(Boolean(data.onPremMode));
        }
      } catch {
        /* ignore */
      }
    }
    void loadSetupState();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!orgId) return;
    if (isOrgAdmin && catalog) return;

    if (!isOrgAdmin) {
      try {
        const rolesRes = await fetch(`/api/admin/organizations/${orgId}/roles`, {
          credentials: "include",
        });
        if (rolesRes.ok) {
          const data = (await rolesRes.json()) as { roles: RoleCatalogEntry[] };
          if (Array.isArray(data.roles)) {
            setRoleOptions([
              { label: t("admin.teamDetail.noRole"), value: "" },
              ...data.roles.map((r) => ({ label: r.title, value: r.slug })),
            ]);
          }
        }
      } catch {
        /* ignore */
      }
      return;
    }

    setCatalogLoading(true);
    try {
      const [trackerRes, rolesRes] = await Promise.all([
        fetch(`/api/admin/organizations/${orgId}/teams/tracker-catalog`, { credentials: "include" }),
        fetch(`/api/admin/organizations/${orgId}/roles`, { credentials: "include" }),
      ]);
      if (trackerRes.ok) {
        const data = (await trackerRes.json()) as AdminTrackerCatalogPayload;
        setCatalog({
          boards: Array.isArray(data.boards) ? data.boards : [],
          queues: Array.isArray(data.queues) ? data.queues : [],
          teams: Array.isArray(data.teams) ? data.teams : [],
        });
      }
      if (rolesRes.ok) {
        const data = (await rolesRes.json()) as { roles: RoleCatalogEntry[] };
        if (Array.isArray(data.roles)) {
          setRoleOptions([
            { label: t("admin.teamDetail.noRole"), value: "" },
            ...data.roles.map((r) => ({ label: r.title, value: r.slug })),
          ]);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setCatalogLoading(false);
    }
  }, [catalog, isOrgAdmin, orgId, t]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const loadAddCandidates = useCallback(async () => {
    if (!orgId || !initialTeam.id) return;
    if (onPremMode) {
      setAddCandidateOptions([{ label: t("admin.teamDetail.selectUser"), value: "" }]);
      return;
    }
    setAddCandidatesLoading(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members/add-candidates`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setAddCandidateOptions([{ label: t("admin.teamDetail.selectUser"), value: "" }]);
        return;
      }
      const data = (await res.json()) as { users?: Array<{ email: string; userId: string }> };
      const list = Array.isArray(data.users) ? data.users : [];
      setAddCandidateOptions([
        { label: t("admin.teamDetail.selectUser"), value: "" },
        ...list.map((u) => ({ label: u.email, value: u.userId })),
      ]);
    } catch {
      setAddCandidateOptions([{ label: t("admin.teamDetail.selectUser"), value: "" }]);
    } finally {
      setAddCandidatesLoading(false);
    }
  }, [initialTeam.id, onPremMode, orgId, t]);

  useEffect(() => {
    void loadAddCandidates();
  }, [loadAddCandidates]);

  useEffect(() => {
    if (!isOrgAdmin && addRoleSlug.toLowerCase() === "teamlead") {
      setAddRoleSlug("");
    }
  }, [addRoleSlug, isOrgAdmin]);

  const queueOptions = useMemo((): CustomSelectOption<string>[] => {
    const bindings = catalog?.teams ?? [];
    const head: CustomSelectOption<string>[] = [{ label: t("admin.teamsPage.selectQueue"), value: "" }];
    if (!catalog?.queues.length) return head;
    return [
      ...head,
      ...catalog.queues.map((q) => {
        const owner = teamTitleUsingQueue(bindings, q.key);
        const taken = owner != null && owner !== initialTeam.title;
        return {
          disabled: taken,
          label: taken
            ? t("admin.teamsPage.queueTaken", { name: q.name, key: q.key, owner })
            : t("admin.teamsPage.queueFree", { name: q.name, key: q.key }),
          value: q.key,
        };
      }),
    ];
  }, [catalog, initialTeam.title, t]);

  const addRoleOptions = useMemo((): CustomSelectOption<string>[] => {
    if (isOrgAdmin) return roleOptions;
    return roleOptions.filter(
      (o) => o.value === "" || String(o.value).toLowerCase() !== "teamlead",
    );
  }, [isOrgAdmin, roleOptions]);

  const boardOptions = useMemo((): CustomSelectOption<string>[] => {
    const bindings = catalog?.teams ?? [];
    const head: CustomSelectOption<string>[] = [{ label: t("admin.teamsPage.selectBoard"), value: "" }];
    if (!catalog?.boards.length) return head;
    const sorted = [...catalog.boards].sort((a, b) =>
      a.name.localeCompare(b.name, language, { sensitivity: "base" }),
    );
    return [
      ...head,
      ...sorted.map((b) => {
        const owner = teamTitleUsingBoard(bindings, b.id);
        const taken = owner != null && owner !== initialTeam.title;
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
  }, [catalog, initialTeam.title, language, t]);

  const saveTeam = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setEditSaving(true);
      try {
        const body = isOrgAdmin
          ? {
              title: editTitle,
              tracker_board_id: editBoard,
              tracker_queue_key: editQueue,
            }
          : { title: editTitle };
        const res = await fetch(`/api/admin/organizations/${orgId}/teams/${initialTeam.id}`, {
          body: JSON.stringify(body),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? t("admin.teamDetail.saveFailed"));
          return;
        }
        toast.success(t("admin.teamDetail.saved"));
        await invalidateBoardsQuery(queryClient);
        router.refresh();
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setEditSaving(false);
      }
    },
    [editBoard, editQueue, editTitle, initialTeam.id, isOrgAdmin, orgId, queryClient, router, t],
  );

  const addMember = useCallback(async () => {
    if (onPremMode) {
      const trackerUserId = addTrackerUserId.trim();
      const email = addTrackerUserMeta?.email?.trim();
      if (!trackerUserId || !email) {
        return;
      }
      setAddLoading(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
          {
            body: JSON.stringify({
              display_name: addTrackerUserMeta?.displayName?.trim() || undefined,
              email,
              role_slug: addRoleSlug.trim() || null,
              tracker_user_id: trackerUserId,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? t("admin.teamDetail.genericError"));
          return;
        }
        toast.success(t("admin.teamDetail.userAddedToTeam"));
        setAddTrackerUserId("");
        setAddTrackerUserMeta(null);
        setAddRoleSlug("");
        const refreshRes = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
          { credentials: "include" },
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as { members: AdminTeamMember[] };
          setMembers(data.members);
        }
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setAddLoading(false);
      }
      return;
    }

    if (!addProductUserId) return;
    setAddLoading(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
        {
          body: JSON.stringify({
            role_slug: addRoleSlug.trim() || null,
            user_id: addProductUserId,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? t("admin.teamDetail.genericError"));
        return;
      }
      toast.success(t("admin.teamDetail.userAddedToTeam"));
      setAddProductUserId("");
      setAddRoleSlug("");
      const refreshRes = await fetch(
        `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
        { credentials: "include" },
      );
      if (refreshRes.ok) {
        const data = (await refreshRes.json()) as { members: AdminTeamMember[] };
        setMembers(data.members);
      }
      await loadAddCandidates();
    } catch {
      toast.error(t("admin.common.networkError"));
    } finally {
      setAddLoading(false);
    }
  }, [
    addProductUserId,
    addRoleSlug,
    addTrackerUserId,
    addTrackerUserMeta,
    initialTeam.id,
    loadAddCandidates,
    onPremMode,
    orgId,
    t,
  ]);

  const updateProductTeamRole = useCallback(
    async (productUserId: string, teamRole: "team_lead" | "team_member") => {
      setProductRoleBusyUserId(productUserId);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/product-role`,
          {
            body: JSON.stringify({ team_role: teamRole, user_id: productUserId }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? t("admin.teamDetail.updateRoleFailed"));
          return;
        }
        toast.success(t("admin.teamDetail.plannerRoleUpdated"));
        const refreshRes = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
          { credentials: "include" },
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as { members: AdminTeamMember[] };
          setMembers(data.members);
        }
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setProductRoleBusyUserId(null);
      }
    },
    [initialTeam.id, orgId, t],
  );

  const inviteMember = useCallback(
    async (
      staffId: string,
      email: string,
      invitedTeamRole: "team_lead" | "team_member",
      trackerContext?: { display_name: string; tracker_user_id: string } | null,
    ) => {
      const trimmed = email.trim();
      if (!trimmed) {
        toast.error(t("admin.teamDetail.noEmailCannotInvite"));
        return;
      }
      setInviteBusyStaffId(staffId);
      try {
        const tid = trackerContext?.tracker_user_id?.trim();
        if (!tid) {
          toast.error(t("admin.teamDetail.noTrackerIdForDirectAdd"));
          return;
        }
        const body: Record<string, unknown> = {
          display_name: trackerContext?.display_name?.trim() || undefined,
          email: trimmed,
          role_slug: invitedTeamRole === "team_lead" ? "teamlead" : null,
          tracker_user_id: tid,
        };
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
          {
            body: JSON.stringify(body),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? t("admin.teamDetail.inviteSendFailed"));
          return;
        }
        toast.success(t("admin.teamDetail.userAddedToTeam"));
        const refreshRes = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members`,
          { credentials: "include" },
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as { members: AdminTeamMember[] };
          setMembers(data.members);
        }
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setInviteBusyStaffId(null);
      }
    },
    [initialTeam.id, orgId, t],
  );

  const removeMember = useCallback(
    async (staffId: string) => {
      const member = members.find((m) => m.staff_id === staffId);
      const label =
        member?.staff_display_name?.trim() || t("admin.teamDetail.removeMemberFallback");
      const confirmed = await confirmDestructive(t("admin.teamDetail.removeMemberConfirm", { label }), {
        confirmText: t("admin.teamDetail.removeMemberConfirmBtn"),
        title: t("admin.teamDetail.removeMemberTitle"),
        variant: "destructive",
      });
      if (!confirmed) return;
      setMemberBusyId(staffId);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members/${staffId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(json.error ?? t("admin.teamDetail.removeMemberFailed"));
          return;
        }
        setMembers((prev) => prev.filter((m) => m.staff_id !== staffId));
        toast.success(t("admin.teamDetail.memberRemoved"));
      } catch {
        toast.error(t("admin.common.networkError"));
      } finally {
        setMemberBusyId(null);
      }
    },
    [confirmDestructive, initialTeam.id, members, orgId, t],
  );

  const updateMemberRole = useCallback(
    async (staffId: string, roleSlug: string | null) => {
      setMemberBusyId(staffId);
      const prev = members.find((m) => m.staff_id === staffId)?.role_slug ?? null;
      setMembers((ms) =>
        ms.map((m) => (m.staff_id === staffId ? { ...m, role_slug: roleSlug } : m)),
      );
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${initialTeam.id}/members/${staffId}`,
          {
            body: JSON.stringify({ role_slug: roleSlug }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? t("admin.teamDetail.saveRoleError"));
        }
      } catch (e) {
        setMembers((ms) =>
          ms.map((m) => (m.staff_id === staffId ? { ...m, role_slug: prev } : m)),
        );
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setMemberBusyId(null);
      }
    },
    [initialTeam.id, members, orgId, t],
  );

  const backHref = "/admin/teams";

  const addCanAddMember = onPremMode
    ? Boolean(addTrackerUserId.trim() && addTrackerUserMeta?.email?.trim())
    : Boolean(addProductUserId.trim());

  return {
    addCanAddMember,
    addCandidateOptions,
    addCandidatesLoading,
    addLoading,
    addMember,
    addProductUserId,
    addTrackerUserId,
    addTrackerUserMeta,
    addRoleOptions,
    addRoleSlug,
    backHref,
    boardOptions,
    catalogLoading,
    editBoard,
    editQueue,
    editSaving,
    editTitle,
    initialTeam,
    inviteBusyStaffId,
    inviteMember,
    memberBusyId,
    productRoleBusyUserId,
    members,
    onPremMode,
    orgId,
    queueOptions,
    removeMember,
    roleOptions,
    saveTeam,
    setAddProductUserId,
    setAddTrackerUserId,
    setAddTrackerUserMeta,
    setAddRoleSlug,
    setEditBoard,
    setEditQueue,
    setEditTitle,
    updateMemberRole,
    updateProductTeamRole,
  };
}
