import type { AdminTeamMember } from "@/features/admin/adminTeamCatalog";

import Link from "next/link";

import { Button } from "@/components/Button";
import { CustomSelect, type CustomSelectOption } from "@/components/CustomSelect";
import { useI18n } from "@/contexts/LanguageContext";
import {
  adminTeamRosterTableHeader,
  cardBody,
  cardHeader,
  cardShell,
  hCard,
  label,
  muted,
} from "@/features/admin/adminUiTokens";
import { AdminUserSelector } from "@/features/admin/components/AdminUserSelector";

import { AdminTeamMemberRow } from "./AdminTeamMemberRow";

interface AdminTeamMembersSectionProps {
  addCanAddMember: boolean;
  addCandidateOptions: CustomSelectOption<string>[];
  addCandidatesLoading: boolean;
  addLoading: boolean;
  addProductUserId: string;
  addRoleOptions: CustomSelectOption<string>[];
  addRoleSlug: string;
  addTrackerUserId: string;
  inviteBusyStaffId: string | null;
  isOrgAdmin: boolean;
  memberBusyId: string | null;
  members: AdminTeamMember[];
  onPremMode: boolean;
  orgId: string;
  productRoleBusyUserId: string | null;
  roleOptions: CustomSelectOption<string>[];
  onAddMember: () => void;
  onInviteMember: (
    staffId: string,
    email: string,
    invitedTeamRole: "team_lead" | "team_member",
    trackerContext?: { display_name: string; tracker_user_id: string } | null,
  ) => void;
  onProductTeamRoleChange: (
    productUserId: string,
    teamRole: "team_lead" | "team_member",
  ) => void;
  onRemoveMember: (staffId: string) => void;
  onUpdateMemberRole: (staffId: string, roleSlug: string | null) => void;
  setAddProductUserId: (v: string) => void;
  setAddRoleSlug: (v: string) => void;
  setAddTrackerUserId: (v: string) => void;
  setAddTrackerUserMeta: (v: { displayName?: string; email?: string | null } | null) => void;
}

export function AdminTeamMembersSection({
  addCanAddMember,
  addCandidateOptions,
  addCandidatesLoading,
  addLoading,
  addTrackerUserId,
  addProductUserId,
  addRoleOptions,
  addRoleSlug,
  inviteBusyStaffId,
  isOrgAdmin,
  memberBusyId,
  members,
  onPremMode,
  orgId,
  productRoleBusyUserId,
  roleOptions,
  setAddProductUserId,
  setAddTrackerUserId,
  setAddTrackerUserMeta,
  setAddRoleSlug,
  onAddMember,
  onInviteMember,
  onProductTeamRoleChange,
  onRemoveMember,
  onUpdateMemberRole,
}: AdminTeamMembersSectionProps) {
  const { t } = useI18n();
  const hasAddCandidates = addCandidateOptions.length > 1;
  const noCandidatesReady = !addCandidatesLoading && !hasAddCandidates;
  return (
    <section className={cardShell}>
      <div className={cardHeader}>
        <h2 className={hCard}>
          {t("admin.teamMembers.title")}
          {members.length > 0 ? (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {members.length}
            </span>
          ) : null}
        </h2>
      </div>
      <div className={cardBody}>
        <div className="mb-4 space-y-2">
          <p className={label}>
            {onPremMode ? t("admin.teamMembers.addFromTrackerTitle") : t("admin.teamMembers.addFromOrgTitle")}
          </p>
          <p className={`text-xs ${muted}`}>
            {onPremMode ? t("admin.teamMembers.addFromTrackerHint") : t("admin.teamMembers.addFromOrgHint")}
          </p>
          {!onPremMode && noCandidatesReady ? (
            <p className={`text-xs ${muted}`}>
              {t("admin.teamMembers.noUsersHintPrefix")}{" "}
              <Link
                className="font-medium text-blue-600 underline dark:text-blue-400"
                href="/admin/members"
              >
                {t("admin.teamMembers.noUsersLink")}
              </Link>
              .
            </p>
          ) : null}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 w-full flex-1 lg:min-w-[14rem]">
              {onPremMode ? (
                <AdminUserSelector
                  orgId={orgId}
                  value={addTrackerUserId}
                  onChange={(trackerId, user) => {
                    setAddTrackerUserId(trackerId);
                    setAddTrackerUserMeta(
                      user ? { displayName: user.displayName, email: user.email } : null,
                    );
                  }}
                />
              ) : (
                <CustomSelect
                  className="w-full"
                  disabled={addCandidatesLoading}
                  options={addCandidateOptions}
                  selectedPrefix=""
                  title={t("admin.teamMembers.userTitle")}
                  value={addProductUserId}
                  onChange={(id) => setAddProductUserId(id)}
                />
              )}
            </div>
            <div className="min-w-0 w-full lg:w-56 lg:shrink-0">
              <CustomSelect
                className="w-full"
                options={addRoleOptions}
                selectedPrefix=""
                title={t("admin.teamMembers.teamRoleTitle")}
                value={addRoleSlug}
                onChange={(slug) => setAddRoleSlug(slug)}
              />
            </div>
            <Button
              className="w-full shrink-0 px-3.5 py-2 lg:w-auto"
              disabled={!addCanAddMember || addLoading || addCandidatesLoading}
              type="button"
              variant="primary"
              onClick={() => void onAddMember()}
            >
              {addLoading ? t("admin.teamMembers.addLoading") : t("admin.teamMembers.addSubmit")}
            </Button>
          </div>
        </div>
        {members.length === 0 ? (
          <p className={muted}>{t("admin.teamMembers.noMembers")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
            <div className={adminTeamRosterTableHeader} role="presentation">
              <span>{t("admin.teamMembers.tableStaff")}</span>
              <span>{t("admin.teamMembers.tableStatus")}</span>
              <div className="grid min-w-0 grid-cols-2 items-start gap-4">
                <span className="min-w-0 leading-snug">
                  {t("admin.teamMembers.tablePlannerRole")}
                  <span className="mt-0.5 block text-[10px] font-normal text-gray-400 dark:text-gray-500">
                    {t("admin.teamMembers.plannerRoleAdminOnly")}
                  </span>
                </span>
                <span className="min-w-0 leading-snug">{t("admin.teamMembers.tableTeamRole")}</span>
              </div>
              <span className="sr-only">{t("admin.teamMembers.deleteSr")}</span>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((m) => (
              <AdminTeamMemberRow
                key={m.staff_id}
                busy={memberBusyId === m.staff_id}
                inviteBusy={inviteBusyStaffId === m.staff_id}
                isOrgAdmin={isOrgAdmin}
                member={m}
                productRoleBusyUserId={productRoleBusyUserId}
                roleOptions={roleOptions}
                onInvite={onInviteMember}
                onProductTeamRoleChange={onProductTeamRoleChange}
                onRemove={onRemoveMember}
                onRoleChange={onUpdateMemberRole}
              />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
