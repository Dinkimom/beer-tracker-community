import type { DomainRole, Platform, RoleCatalogEntry } from "@/lib/roles/catalog";

import { useMemo } from "react";

import { Button } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import {
  adminFormCheckbox,
  field,
  label,
  muted,
} from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

import { domainRoleOptions, formatPlatforms, PLATFORM_VALUES } from "../rolesPageConstants";

export interface OrganizationRoleTableRowProps {
  deleteBusy: boolean;
  deletingSlug: string | null;
  editBusy: boolean;
  editDomainRole: DomainRole;
  editingSlug: string | null;
  editPlatforms: Platform[];
  editTitle: string;
  r: RoleCatalogEntry;
  beginEdit: (r: RoleCatalogEntry) => void;
  cancelDelete: () => void;
  cancelEdit: () => void;
  confirmDelete: (slug: string) => Promise<void>;
  setEditDomainRoleSafe: (v: DomainRole) => void;
  setEditTitle: (v: string) => void;
  startDelete: (slug: string) => void;
  submitEdit: (slug: string) => Promise<void>;
  toggleEditPlatform: (p: Platform) => void;
}

export function OrganizationRoleTableRow({
  beginEdit,
  cancelDelete,
  cancelEdit,
  confirmDelete,
  deleteBusy,
  deletingSlug,
  editBusy,
  editDomainRole,
  editingSlug,
  editPlatforms,
  editTitle,
  r,
  setEditDomainRoleSafe,
  setEditTitle,
  startDelete,
  submitEdit,
  toggleEditPlatform,
}: OrganizationRoleTableRowProps) {
  const { has, t } = useI18n();
  const domainOptions = useMemo(() => domainRoleOptions(t), [t]);

  if (editingSlug === r.slug) {
    return (
      <tr>
        <td className="py-3 pr-4 align-top" colSpan={5}>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/40">
            <p className={`text-xs ${muted}`}>
              Slug:{" "}
              <code className="font-mono text-gray-800 dark:text-gray-200">{r.slug}</code>{" "}
              {t("admin.rolesPage.rowSlugNote")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor={`edit-title-${r.slug}`}>
                  {t("admin.rolesPage.rowTitle")}
                </label>
                <input
                  className={field}
                  id={`edit-title-${r.slug}`}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div>
                <span className={label}>{t("admin.rolesPage.rowDomainRole")}</span>
                <CustomSelect
                  className="w-full"
                  options={domainOptions}
                  selectedPrefix=""
                  title={t("admin.rolesPage.roleSelectTitle")}
                  value={editDomainRole}
                  onChange={setEditDomainRoleSafe}
                />
              </div>
            </div>
            {editDomainRole === "developer" ? (
              <div>
                <span className={label}>{t("admin.rolesPage.rowPlatforms")}</span>
                <div className="mt-1 flex flex-wrap gap-4">
                  {PLATFORM_VALUES.map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        checked={editPlatforms.includes(p)}
                        className={adminFormCheckbox}
                        type="checkbox"
                        onChange={() => toggleEditPlatform(p)}
                      />
                      {t(`admin.rolesPage.platform.${p}`)}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="px-3.5 py-2"
                disabled={editBusy || !editTitle.trim()}
                type="button"
                variant="primary"
                onClick={() => void submitEdit(r.slug)}
              >
                {editBusy ? t("admin.rolesPage.saveBusy") : t("admin.rolesPage.save")}
              </Button>
              <Button
                className="px-3.5 py-2"
                disabled={editBusy}
                type="button"
                variant="outline"
                onClick={cancelEdit}
              >
                {t("admin.rolesPage.cancel")}
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (deletingSlug === r.slug) {
    return (
      <tr>
        <td className="py-3 pr-4" colSpan={5}>
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm text-amber-950 dark:text-amber-100">
              {t("admin.rolesPage.deleteConfirm", { title: r.title, slug: r.slug })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="px-3.5 py-2"
                disabled={deleteBusy}
                type="button"
                variant="dangerOutline"
                onClick={() => void confirmDelete(r.slug)}
              >
                {deleteBusy ? t("admin.rolesPage.deleteBusy") : t("admin.rolesPage.delete")}
              </Button>
              <Button
                className="px-3.5 py-2"
                disabled={deleteBusy}
                type="button"
                variant="outline"
                onClick={cancelDelete}
              >
                {t("admin.rolesPage.cancel")}
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{r.title}</td>
      <td className="py-2.5 pr-3">
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {r.slug}
        </code>
      </td>
      <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-400">
        {has(`admin.rolesPage.domain.${r.domainRole}`)
          ? t(`admin.rolesPage.domain.${r.domainRole}`)
          : r.domainRole}
      </td>
      <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-400">
        {formatPlatforms(r.platforms, t)}
      </td>
      <td className="w-px whitespace-nowrap py-2.5 pl-6 text-right align-middle">
        <div className="flex justify-end gap-2">
          <Button
            aria-label={t("admin.rolesPage.editAria", { title: r.title })}
            className="px-3.5 py-2"
            type="button"
            variant="outline"
            onClick={() => beginEdit(r)}
          >
            {t("admin.rolesPage.edit")}
          </Button>
          <Button
            aria-label={t("admin.rolesPage.deleteAria", { title: r.title })}
            className="px-3.5 py-2"
            type="button"
            variant="dangerOutline"
            onClick={() => startDelete(r.slug)}
          >
            {t("admin.rolesPage.delete")}
          </Button>
        </div>
      </td>
    </tr>
  );
}
