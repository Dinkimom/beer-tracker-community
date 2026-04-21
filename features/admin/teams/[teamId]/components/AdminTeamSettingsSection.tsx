import type { CustomSelectOption } from "@/components/CustomSelect";
import type { AdminTeamRow } from "@/features/admin/adminTeamCatalog";
import type { FormEvent } from "react";

import { Button } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import {
  badgeMuted,
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
} from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

interface AdminTeamSettingsSectionProps {
  boardOptions: CustomSelectOption<string>[];
  catalogLoading: boolean;
  editBoard: string;
  editQueue: string;
  editSaving: boolean;
  editTitle: string;
  initialTeam: AdminTeamRow;
  isOrgAdmin: boolean;
  queueOptions: CustomSelectOption<string>[];
  onSave: (e: FormEvent) => void;
  setEditBoard: (v: string) => void;
  setEditQueue: (v: string) => void;
  setEditTitle: (v: string) => void;
}

export function AdminTeamSettingsSection({
  boardOptions,
  catalogLoading,
  editBoard,
  editQueue,
  editSaving,
  editTitle,
  initialTeam,
  isOrgAdmin,
  queueOptions,
  onSave,
  setEditBoard,
  setEditQueue,
  setEditTitle,
}: AdminTeamSettingsSectionProps) {
  const { t } = useI18n();
  return (
    <section className={cardShell}>
      <div className={cardHeader}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={hCard}>{t("admin.teamSettings.title")}</h2>
          <span className={badgeMuted} title={t("admin.teamSettings.teamIdTitle")}>
            <span className="font-normal text-gray-500 dark:text-gray-400">slug</span>{" "}
            <span className="font-mono">{initialTeam.slug}</span>
          </span>
        </div>
      </div>
      <form
        aria-busy={isOrgAdmin && catalogLoading}
        className={cardBody}
        onSubmit={(e) => void onSave(e)}
      >
        <div className={`grid gap-4 ${isOrgAdmin ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
          <div>
            <label className={label} htmlFor="team-edit-title">
              {t("admin.teamSettings.nameLabel")}
            </label>
            <input
              className={field}
              id="team-edit-title"
              required
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          {isOrgAdmin ? (
            <>
              <div>
                <span className={label} id="team-edit-queue-label">
                  {t("admin.teamSettings.queueLabel")}
                </span>
                {catalogLoading ? (
                  <div
                    aria-labelledby="team-edit-queue-label"
                    className="space-y-1.5"
                    role="status"
                  >
                    <span className="sr-only">{t("admin.teamSettings.queuesLoadingSr")}</span>
                    <div className="h-9 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-600" />
                  </div>
                ) : (
                  <CustomSelect
                    className="w-full"
                    options={queueOptions}
                    searchPlaceholder={t("admin.teamSettings.queueSearch")}
                    searchable
                    selectedPrefix=""
                    title={t("admin.teamSettings.queueTitle")}
                    value={editQueue}
                    onChange={setEditQueue}
                  />
                )}
              </div>
              <div>
                <span className={label} id="team-edit-board-label">
                  {t("admin.teamSettings.boardLabel")}
                </span>
                {catalogLoading ? (
                  <div
                    aria-labelledby="team-edit-board-label"
                    className="space-y-1.5"
                    role="status"
                  >
                    <span className="sr-only">{t("admin.teamSettings.boardsLoadingSr")}</span>
                    <div className="h-9 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-600" />
                  </div>
                ) : (
                  <CustomSelect
                    className="w-full"
                    options={boardOptions}
                    searchPlaceholder={t("admin.teamSettings.boardSearch")}
                    searchable
                    selectedPrefix=""
                    title={t("admin.teamSettings.boardTitle")}
                    value={editBoard}
                    onChange={setEditBoard}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <p className={`text-sm ${muted}`}>
                {t("admin.teamSettings.orgAdminOnlyBinding")}
              </p>
              <p className={badgeMuted}>
                <span className="font-normal opacity-90">{t("admin.teamSettings.labelQueue")}</span>
                <span className="font-mono">{initialTeam.tracker_queue_key}</span>
              </p>
              <p className={badgeMuted}>
                <span className="font-normal opacity-90">{t("admin.teamSettings.labelBoardId")}</span>
                <span className="font-mono">{initialTeam.tracker_board_id}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button
            className="px-3.5 py-2"
            disabled={editSaving || (isOrgAdmin && catalogLoading)}
            title={
              isOrgAdmin && catalogLoading ? t("admin.teamSettings.waitCatalog") : undefined
            }
            type="submit"
            variant="primary"
          >
            {editSaving ? t("admin.teamSettings.saveSaving") : t("admin.teamSettings.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
