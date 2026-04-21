import type { CustomSelectOption } from "@/components/CustomSelect";
import type { FormEvent } from "react";

import { Button } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import {
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
} from "@/features/admin/adminUiTokens";
import { AdminInlineAlert } from "@/features/admin/components/AdminInlineAlert";
import { useI18n } from "@/contexts/LanguageContext";

export interface AdminNewTeamFormSectionProps {
  boardSelectOptions: CustomSelectOption<string>[];
  catalogLoading: boolean;
  newTeamSlugPreview: string;
  newTeamTitle: string;
  orgId: string;
  queueSelectOptions: CustomSelectOption<string>[];
  selectTeamBoard: string;
  selectTeamQueue: string;
  teamFormSubmitting: boolean;
  setNewTeamTitle: (v: string) => void;
  setSelectTeamBoard: (v: string) => void;
  setSelectTeamQueue: (v: string) => void;
  submitNewTeam: (e: FormEvent) => Promise<void>;
}

export function AdminNewTeamFormSection({
  boardSelectOptions,
  catalogLoading,
  newTeamSlugPreview,
  newTeamTitle,
  orgId,
  queueSelectOptions,
  selectTeamBoard,
  selectTeamQueue,
  setNewTeamTitle,
  setSelectTeamBoard,
  setSelectTeamQueue,
  submitNewTeam,
  teamFormSubmitting,
}: AdminNewTeamFormSectionProps) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="admin-new-team-heading" className={cardShell}>
      <div className={cardHeader}>
        <h2 className={hCard} id="admin-new-team-heading">
          {t("admin.newTeamForm.title")}
        </h2>
        <p className={`mt-1 ${muted}`}>{t("admin.newTeamForm.subtitle")}</p>
      </div>
      <div className={cardBody}>
        <form className="space-y-4" onSubmit={(e) => void submitNewTeam(e)}>
          <div className="max-w-3xl space-y-4">
            <div>
              <label className={label} htmlFor="team-title">
                {t("admin.newTeamForm.nameLabel")}
              </label>
              <input
                className={field}
                id="team-title"
                placeholder={t("admin.newTeamForm.namePlaceholder")}
                required
                type="text"
                value={newTeamTitle}
                onChange={(e) => setNewTeamTitle(e.target.value)}
              />
              <p className={`mt-1.5 text-xs ${muted}`}>
                {t("admin.newTeamForm.slugPreview")}
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {newTeamSlugPreview}
                </span>{" "}
                {t("admin.newTeamForm.slugHint")}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
              <div className="min-w-0">
                <span className={label}>{t("admin.newTeamForm.queueLabel")}</span>
                <CustomSelect
                  className="w-full"
                  options={queueSelectOptions}
                  searchPlaceholder={t("admin.newTeamForm.queueSearch")}
                  searchable
                  selectedPrefix=""
                  title={t("admin.newTeamForm.queueTitle")}
                  value={selectTeamQueue}
                  onChange={setSelectTeamQueue}
                />
                {!catalogLoading && queueSelectOptions.length <= 1 ? (
                  <div className="mt-1.5">
                    <AdminInlineAlert variant="warning">{t("admin.newTeamForm.queuesEmpty")}</AdminInlineAlert>
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                <span className={label}>{t("admin.newTeamForm.boardLabel")}</span>
                <CustomSelect
                  className="w-full"
                  options={boardSelectOptions}
                  searchPlaceholder={t("admin.newTeamForm.boardSearch")}
                  searchable
                  selectedPrefix=""
                  title={t("admin.newTeamForm.boardTitle")}
                  value={selectTeamBoard}
                  onChange={setSelectTeamBoard}
                />
                {!catalogLoading && boardSelectOptions.length <= 1 ? (
                  <div className="mt-1.5">
                    <AdminInlineAlert variant="warning">{t("admin.newTeamForm.boardsEmpty")}</AdminInlineAlert>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            className="px-3.5 py-2"
            disabled={teamFormSubmitting || !orgId || catalogLoading}
            type="submit"
            variant="primary"
          >
            {teamFormSubmitting ? t("admin.newTeamForm.submitSaving") : t("admin.newTeamForm.submit")}
          </Button>
        </form>
      </div>
    </section>
  );
}
