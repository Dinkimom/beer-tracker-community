import type { AdminTeamMember } from "@/features/admin/adminTeamCatalog";

import { useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { CustomSelect, type CustomSelectOption } from "@/components/CustomSelect";
import { Icon } from "@/components/Icon";
import { adminListRow, adminTeamRosterGrid, field, muted } from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

type ProductPlannerTeamRole = "team_lead" | "team_member";

interface AdminTeamMemberRowProps {
  busy: boolean;
  inviteBusy: boolean;
  isOrgAdmin: boolean;
  member: AdminTeamMember;
  productRoleBusyUserId: string | null;
  roleOptions: CustomSelectOption<string>[];
  onInvite: (
    staffId: string,
    email: string,
    invitedTeamRole: "team_lead" | "team_member",
    trackerContext?: { display_name: string; tracker_user_id: string } | null,
  ) => void;
  onProductTeamRoleChange: (
    productUserId: string,
    teamRole: "team_lead" | "team_member",
  ) => void;
  onRemove: (staffId: string) => void;
  onRoleChange: (staffId: string, roleSlug: string | null) => void;
}

export function AdminTeamMemberRow({
  busy,
  inviteBusy,
  isOrgAdmin,
  member: m,
  productRoleBusyUserId,
  roleOptions,
  onInvite,
  onProductTeamRoleChange,
  onRemove,
  onRoleChange,
}: AdminTeamMemberRowProps) {
  const { t } = useI18n();
  const [inviteRole, setInviteRole] = useState<"team_lead" | "team_member">("team_member");

  const productSystemRoleOptions = useMemo(
    (): CustomSelectOption<ProductPlannerTeamRole>[] => [
      { label: t("admin.teamMemberRow.roleMember"), value: "team_member" },
      { label: t("admin.teamMemberRow.roleLead"), value: "team_lead" },
    ],
    [t],
  );

  const canSendInvite =
    !m.product_user_in_org &&
    Boolean(m.staff_email?.trim()) &&
    !m.pending_product_invitation;

  const showPlannerHint = m.product_user_in_org && !m.product_team_access;

  let statusLine: string;
  if (m.pending_product_invitation) {
    statusLine = t("admin.teamMemberRow.invitationSent");
  } else if (m.product_user_in_org) {
    statusLine = t("admin.teamMemberRow.inSystem");
  } else {
    statusLine = "—";
  }

  return (
    <li className={[adminListRow, adminTeamRosterGrid, "py-2.5 sm:py-2"].join(" ")}>
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {m.staff_display_name}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {m.staff_email ? (
            <span className="max-w-full truncate text-gray-500 dark:text-gray-400">
              {m.staff_email}
            </span>
          ) : (
            <span className={muted}>{t("admin.teamMemberRow.noEmail")}</span>
          )}
        </div>
        {showPlannerHint ? (
          <p
            className="line-clamp-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90"
            title={t("admin.teamMemberRow.noPlannerAccessTitle")}
          >
            {t("admin.teamMemberRow.noPlannerAccess")}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:max-w-[13rem]">
        <p className={`text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:hidden dark:text-gray-400`}>
          {t("admin.teamMemberRow.statusAria")}
        </p>
        <p className="text-sm text-gray-800 sm:flex sm:min-h-9 sm:items-center dark:text-gray-200">
          {statusLine}
        </p>
        {canSendInvite ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isOrgAdmin ? (
              <select
                aria-label={t("admin.teamMemberRow.inviteRoleAria")}
                className={`${field} h-9 w-[6.5rem] shrink-0 sm:w-[6.75rem]`}
                title={t("admin.teamMemberRow.inviteRoleTitle")}
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "team_lead" | "team_member")
                }
              >
                <option value="team_member">{t("admin.teamMemberRow.roleMember")}</option>
                <option value="team_lead">{t("admin.teamMemberRow.roleLead")}</option>
              </select>
            ) : null}
            <Button
              className="h-9 shrink-0 px-3 text-sm"
              disabled={inviteBusy}
              type="button"
              variant="primary"
              onClick={() =>
                void onInvite(
                  m.staff_id,
                  m.staff_email!.trim(),
                  isOrgAdmin ? inviteRole : "team_member",
                  m.staff_tracker_user_id?.trim()
                    ? {
                        display_name: m.staff_display_name,
                        tracker_user_id: m.staff_tracker_user_id.trim(),
                      }
                    : null,
                )
              }
            >
              {inviteBusy ? "…" : t("admin.teamMemberRow.inviteButton")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center sm:gap-4">
        <div className="min-w-0 space-y-1 sm:space-y-0">
          <p className={`text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:hidden dark:text-gray-400`}>
            {t("admin.teamMemberRow.plannerRole")}
          </p>
          {isOrgAdmin && m.product_team_access && m.product_user_id ? (
            <CustomSelect<ProductPlannerTeamRole>
              className="w-full"
              disabled={productRoleBusyUserId === m.product_user_id}
              options={productSystemRoleOptions}
              selectedPrefix=""
              title={t("admin.teamMemberRow.plannerRoleTitle")}
              value={m.product_planner_is_team_lead === true ? "team_lead" : "team_member"}
              onChange={(role) =>
                void onProductTeamRoleChange(m.product_user_id!, role)
              }
            />
          ) : (
            <div
              className={`flex h-9 items-center text-xs ${muted}`}
              title={
                !isOrgAdmin ? t("admin.teamMemberRow.plannerRoleLocked") : undefined
              }
            >
              —
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1 sm:space-y-0">
          <p className={`text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:hidden dark:text-gray-400`}>
            {t("admin.teamMemberRow.teamRole")}
          </p>
          <CustomSelect
            className="w-full"
            options={roleOptions}
            selectedPrefix=""
            title={t("admin.teamMemberRow.teamRoleTitle")}
            value={m.role_slug ?? ""}
            onChange={(slug) => void onRoleChange(m.staff_id, slug || null)}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end">
        <Button
          aria-label={t("admin.teamMemberRow.removeAria", { name: m.staff_display_name })}
          className="h-11 w-11 shrink-0 p-0 text-gray-600 hover:bg-red-50 hover:text-red-700 dark:text-gray-300 dark:hover:bg-red-900/25 dark:hover:text-red-300"
          disabled={busy}
          title={t("admin.teamMemberRow.removeTitle")}
          type="button"
          variant="ghost"
          onClick={() => void onRemove(m.staff_id)}
        >
          <Icon className="h-6 w-6" name={busy ? "loader" : "x"} />
        </Button>
      </div>
    </li>
  );
}
