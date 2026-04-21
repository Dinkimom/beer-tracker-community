"use client";

import type { AdminTeamRow } from "@/features/admin/adminTeamCatalog";

import { useConfirmDialog } from "@/components/ConfirmDialog";

import { AdminNewTeamFormSection } from "./components/AdminNewTeamFormSection";
import { AdminTeamsListSection } from "./components/AdminTeamsListSection";
import { useAdminTeamsPage } from "./hooks/useAdminTeamsPage";

interface AdminTeamsPageClientProps {
  initialTeams: AdminTeamRow[];
  isOrgAdmin: boolean;
  orgId: string;
}

export function AdminTeamsPageClient({ initialTeams, isOrgAdmin, orgId }: AdminTeamsPageClientProps) {
  const { confirm, DialogComponent } = useConfirmDialog();
  const t = useAdminTeamsPage({ confirmDestructive: confirm, initialTeams, isOrgAdmin, orgId });

  return (
    <div className="space-y-6">
      {DialogComponent}
      <AdminTeamsListSection
        boardNameById={t.boardNameById}
        catalogLoading={t.catalogLoading}
        isOrgAdmin={isOrgAdmin}
        loadTeams={t.loadTeams}
        loadTrackerCatalog={t.loadTrackerCatalog}
        orgId={t.orgId}
        teamBusyId={t.teamBusyId}
        teamHref={t.teamHref}
        teamsList={t.teamsList}
        teamsLoading={t.teamsLoading}
        trackerCatalog={t.trackerCatalog}
        onRemoveTeam={t.removeTeam}
        onSetTeamActive={t.setTeamActive}
      />

      {isOrgAdmin ? (
        <AdminNewTeamFormSection
          boardSelectOptions={t.boardSelectOptions}
          catalogLoading={t.catalogLoading}
          newTeamSlugPreview={t.newTeamSlugPreview}
          newTeamTitle={t.newTeamTitle}
          orgId={t.orgId}
          queueSelectOptions={t.queueSelectOptions}
          selectTeamBoard={t.selectTeamBoard}
          selectTeamQueue={t.selectTeamQueue}
          setNewTeamTitle={t.setNewTeamTitle}
          setSelectTeamBoard={t.setSelectTeamBoard}
          setSelectTeamQueue={t.setSelectTeamQueue}
          submitNewTeam={t.submitNewTeam}
          teamFormSubmitting={t.teamFormSubmitting}
        />
      ) : null}
    </div>
  );
}
