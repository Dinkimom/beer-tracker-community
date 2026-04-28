"use client";

import type { AdminTeamMember, AdminTeamRow } from "@/features/admin/adminTeamCatalog";

import { useConfirmDialog } from "@/components/ConfirmDialog";

import { AdminTeamDetailBreadcrumb } from "./components/AdminTeamDetailBreadcrumb";
import { AdminTeamMembersSection } from "./components/AdminTeamMembersSection";
import { AdminTeamSettingsSection } from "./components/AdminTeamSettingsSection";
import { useAdminTeamDetailPage } from "./hooks/useAdminTeamDetailPage";

interface AdminTeamDetailClientProps {
  initialMembers: AdminTeamMember[];
  initialTeam: AdminTeamRow;
  isOrgAdmin: boolean;
  orgId: string;
}

export function AdminTeamDetailClient({
  initialMembers,
  initialTeam,
  isOrgAdmin,
  orgId,
}: AdminTeamDetailClientProps) {
  const { confirm, DialogComponent } = useConfirmDialog();
  const t = useAdminTeamDetailPage({
    confirmDestructive: confirm,
    initialMembers,
    initialTeam,
    isOrgAdmin,
    orgId,
  });

  return (
    <div className="space-y-5">
      {DialogComponent}
      <AdminTeamDetailBreadcrumb
        backHref={t.backHref}
        editTitle={t.editTitle}
        initialTeam={t.initialTeam}
      />
      <AdminTeamSettingsSection
        boardOptions={t.boardOptions}
        catalogLoading={t.catalogLoading}
        editBoard={t.editBoard}
        editQueue={t.editQueue}
        editSaving={t.editSaving}
        editTitle={t.editTitle}
        initialTeam={t.initialTeam}
        isOrgAdmin={isOrgAdmin}
        queueOptions={t.queueOptions}
        setEditBoard={t.setEditBoard}
        setEditQueue={t.setEditQueue}
        setEditTitle={t.setEditTitle}
        onSave={t.saveTeam}
      />
      <AdminTeamMembersSection
        addCanAddMember={t.addCanAddMember}
        addCandidateOptions={t.addCandidateOptions}
        addCandidatesLoading={t.addCandidatesLoading}
        addLoading={t.addLoading}
        addProductUserId={t.addProductUserId}
        addRoleOptions={t.addRoleOptions}
        addRoleSlug={t.addRoleSlug}
        addTrackerUserId={t.addTrackerUserId}
        inviteBusyStaffId={t.inviteBusyStaffId}
        isOrgAdmin={isOrgAdmin}
        memberBusyId={t.memberBusyId}
        members={t.members}
        orgId={orgId}
        productRoleBusyUserId={t.productRoleBusyUserId}
        roleOptions={t.roleOptions}
        setAddProductUserId={t.setAddProductUserId}
        setAddRoleSlug={t.setAddRoleSlug}
        setAddTrackerUserId={t.setAddTrackerUserId}
        setAddTrackerUserMeta={t.setAddTrackerUserMeta}
        onAddMember={t.addMember}
        onInviteMember={t.inviteMember}
        onPremMode={t.onPremMode}
        onProductTeamRoleChange={t.updateProductTeamRole}
        onRemoveMember={t.removeMember}
        onUpdateMemberRole={t.updateMemberRole}
      />
    </div>
  );
}
