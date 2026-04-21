import type { AdminTeamRow, AdminTrackerCatalogPayload } from "@/features/admin/adminTeamCatalog";

import { Button } from "@/components/Button";
import { useI18n } from "@/contexts/LanguageContext";
import {
  adminListShell,
  cardBody,
  cardHeader,
  cardShell,
  hCard,
  muted,
} from "@/features/admin/adminUiTokens";

import { AdminTeamListRow } from "./AdminTeamListRow";

export interface AdminTeamsListSectionProps {
  boardNameById: Map<number, string>;
  catalogLoading: boolean;
  isOrgAdmin: boolean;
  orgId: string;
  teamBusyId: string | null;
  teamsList: AdminTeamRow[];
  teamsLoading: boolean;
  trackerCatalog: AdminTrackerCatalogPayload | null;
  loadTeams: () => Promise<void>;
  loadTrackerCatalog: () => Promise<void>;
  onRemoveTeam: (teamId: string) => Promise<void>;
  onSetTeamActive: (teamId: string, active: boolean) => Promise<void>;
  teamHref: (teamId: string) => string;
}

export function AdminTeamsListSection({
  boardNameById,
  catalogLoading,
  isOrgAdmin,
  loadTeams,
  loadTrackerCatalog,
  onRemoveTeam,
  onSetTeamActive,
  orgId,
  teamBusyId,
  teamHref,
  teamsList,
  teamsLoading,
  trackerCatalog,
}: AdminTeamsListSectionProps) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="admin-teams-heading" className={cardShell}>
      <div
        className={`${cardHeader} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6`}
      >
        <div className="min-w-0">
          <h2 className={hCard} id="admin-teams-heading">
            {t("admin.teamsList.title")}
          </h2>
          <p className={`mt-1 ${muted}`}>
            {isOrgAdmin ? t("admin.teamsList.subtitleOrgAdmin") : t("admin.teamsList.subtitleTeamLead")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            className="px-3.5 py-2"
            disabled={teamsLoading || !orgId}
            type="button"
            variant="outline"
            onClick={() => void loadTeams()}
          >
            {teamsLoading ? t("admin.teamsList.refreshListLoading") : t("admin.teamsList.refreshList")}
          </Button>
          {isOrgAdmin ? (
            <Button
              className="px-3.5 py-2"
              disabled={catalogLoading || !orgId}
              title={
                catalogLoading
                  ? undefined
                  : t("admin.teamsList.refreshCatalogCaption")
              }
              type="button"
              variant="outline"
              onClick={() => void loadTrackerCatalog()}
            >
              {catalogLoading ? t("admin.teamsList.catalogLoading") : t("admin.teamsList.refreshCatalog")}
            </Button>
          ) : null}
        </div>
      </div>
      <div className={`${cardBody} space-y-5`}>
        {teamsLoading && teamsList.length === 0 ? <p className={muted}>{t("admin.teamsList.emptyLoading")}</p> : null}
        {!teamsLoading && teamsList.length === 0 ? (
          <p className={muted}>
            {isOrgAdmin ? t("admin.teamsList.emptyOrgAdmin") : t("admin.teamsList.emptyTeamLead")}
          </p>
        ) : null}

        {teamsList.length > 0 ? (
          <ul className={adminListShell}>
            {teamsList.map((team) => {
              const busy = teamBusyId === team.id;
              const boardIdNum = Number.parseInt(team.tracker_board_id, 10);
              const boardNameFromCatalog =
                Number.isFinite(boardIdNum) && boardIdNum > 0
                  ? boardNameById.get(boardIdNum)
                  : undefined;
              let boardTitleText: string;
              if (boardNameFromCatalog) {
                boardTitleText = boardNameFromCatalog;
              } else if (!isOrgAdmin) {
                boardTitleText = `id ${team.tracker_board_id}`;
              } else if (catalogLoading) {
                boardTitleText = t("admin.teamsList.boardTitleLoading");
              } else if (trackerCatalog) {
                boardTitleText = t("admin.teamsList.boardTitleMissing");
              } else {
                boardTitleText = t("admin.teamsList.boardTitleCatalogNotLoaded");
              }
              return (
                <AdminTeamListRow
                  key={team.id}
                  boardNameFromCatalog={boardNameFromCatalog}
                  boardTitleText={boardTitleText}
                  busy={busy}
                  detailHref={teamHref(team.id)}
                  showRemoveTeam={isOrgAdmin}
                  team={team}
                  onRemove={() => void onRemoveTeam(team.id)}
                  onToggleActive={(next) => void onSetTeamActive(team.id, next)}
                />
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
