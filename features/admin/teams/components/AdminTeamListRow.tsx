import type { AdminTeamRow } from "@/features/admin/adminTeamCatalog";

import Link from "next/link";

import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  adminListRow,
  adminListRowLayoutGrid,
  badgeMuted,
} from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

export interface AdminTeamListRowProps {
  boardNameFromCatalog: string | undefined;
  boardTitleText: string;
  busy: boolean;
  detailHref: string;
  showRemoveTeam?: boolean;
  team: AdminTeamRow;
  onRemove: () => void;
  onToggleActive: (next: boolean) => void;
}

export function AdminTeamListRow({
  boardNameFromCatalog,
  boardTitleText,
  busy,
  detailHref,
  onRemove,
  onToggleActive,
  showRemoveTeam = true,
  team,
}: AdminTeamListRowProps) {
  const { t } = useI18n();
  const activeTooltip = t("admin.teamsPage.activeTeamTooltip");
  const editLabel = t("admin.teamRow.editTeam", { title: team.title });

  return (
    <li className={`${adminListRow} ${adminListRowLayoutGrid}`}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 hover:underline dark:text-gray-100 dark:hover:text-blue-400"
            href={detailHref}
          >
            {team.title}
          </Link>
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{team.slug}</span>
          {!team.active ? <span className={badgeMuted}>{t("admin.teamRow.badgeOff")}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={badgeMuted}>
            <span className="font-normal opacity-90">{t("admin.teamRow.labelQueue")}</span>
            <span className="font-mono">{team.tracker_queue_key}</span>
          </span>
          <span
            className={badgeMuted}
            title={
              boardNameFromCatalog
                ? undefined
                : t("admin.teamRow.queueUnknownHint")
            }
          >
            <span className="font-normal opacity-90">{t("admin.teamRow.labelBoard")}</span>
            <span className="max-w-[min(100%,14rem)] truncate">{boardTitleText}</span>
          </span>
          <span className={badgeMuted}>
            <span className="font-normal opacity-90">{t("admin.teamRow.labelBoardId")}</span>
            <span className="font-mono">{team.tracker_board_id}</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
        <Link
          aria-label={editLabel}
          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          href={detailHref}
          title={editLabel}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" name="edit" />
          {t("admin.teamRow.edit")}
        </Link>
        <div className="flex items-center gap-2" title={activeTooltip}>
          <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">
            {team.active ? t("admin.teamRow.enabled") : t("admin.teamRow.disabled")}
          </span>
          <button
            aria-checked={team.active}
            aria-label={
              (team.active ? t("admin.teamRow.enabledAriaPrefix") : t("admin.teamRow.disabledAriaPrefix")) +
              activeTooltip
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
              team.active ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={busy}
            role="switch"
            title={activeTooltip}
            type="button"
            onClick={() => onToggleActive(!team.active)}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full border border-gray-200 bg-white transition-transform duration-200 dark:border-gray-500 ${
                team.active ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {showRemoveTeam ? (
          <Button
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            type="button"
            variant="dangerOutline"
            onClick={onRemove}
          >
            {t("admin.teamRow.delete")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
