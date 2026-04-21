import type { DomainRole, Platform } from "@/lib/roles/catalog";
import type { FormEvent } from "react";

import { useMemo } from "react";

import { Button } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import {
  adminFormCheckbox,
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
} from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";
import { toSlug } from "@/lib/roles/toSlug";

import { domainRoleOptions, PLATFORM_VALUES } from "../rolesPageConstants";

export interface CreateOrgRoleFormProps {
  createBusy: boolean;
  newDomainRole: DomainRole;
  newPlatforms: Platform[];
  newSlug: string;
  newTitle: string;
  slugLocked: boolean;
  setNewDomainRoleSafe: (v: DomainRole) => void;
  setNewSlug: (v: string) => void;
  setNewTitle: (v: string) => void;
  setSlugLocked: (v: boolean) => void;
  submitCreate: (e: FormEvent) => Promise<void>;
  toggleNewPlatform: (p: Platform) => void;
}

export function CreateOrgRoleForm({
  createBusy,
  newDomainRole,
  newPlatforms,
  newSlug,
  newTitle,
  setNewDomainRoleSafe,
  setNewSlug,
  setNewTitle,
  setSlugLocked,
  slugLocked,
  submitCreate,
  toggleNewPlatform,
}: CreateOrgRoleFormProps) {
  const { t } = useI18n();
  const domainOptions = useMemo(() => domainRoleOptions(t), [t]);

  return (
    <section aria-labelledby="admin-new-role-heading" className={cardShell}>
      <div className={cardHeader}>
        <h2 className={hCard} id="admin-new-role-heading">
          {t("admin.rolesPage.createFormTitle")}
        </h2>
      </div>
      <div className={cardBody}>
        <form className="max-w-3xl space-y-4" onSubmit={(e) => void submitCreate(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="role-new-title">
                {t("admin.rolesPage.createTitleLabel")}
              </label>
              <input
                className={field}
                id="role-new-title"
                type="text"
                value={newTitle}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewTitle(v);
                  if (!slugLocked) {
                    setNewSlug(toSlug(v));
                  }
                }}
              />
            </div>
            <div>
              <label className={label} htmlFor="role-new-slug">
                Slug
              </label>
              <input
                className={field}
                id="role-new-slug"
                placeholder="latin-kebab-case"
                title={t("admin.rolesPage.createSlugHint")}
                type="text"
                value={newSlug}
                onChange={(e) => {
                  setSlugLocked(true);
                  setNewSlug(e.target.value);
                }}
              />
            </div>
          </div>
          <div>
            <span className={label}>{t("admin.rolesPage.createDomainLabel")}</span>
            <CustomSelect
              className="w-full max-w-md"
              options={domainOptions}
              selectedPrefix=""
              title={t("admin.rolesPage.roleSelectTitle")}
              value={newDomainRole}
              onChange={setNewDomainRoleSafe}
            />
          </div>
          {newDomainRole === "developer" ? (
            <div>
              <span className={label}>{t("admin.rolesPage.createPlatformsLabel")}</span>
              <div className="mt-2 flex flex-wrap gap-4">
                {PLATFORM_VALUES.map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      checked={newPlatforms.includes(p)}
                      className={adminFormCheckbox}
                      type="checkbox"
                      onChange={() => toggleNewPlatform(p)}
                    />
                    {t(`admin.rolesPage.platform.${p}`)}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <Button className="px-3.5 py-2" disabled={createBusy} type="submit" variant="primary">
            {createBusy ? t("admin.rolesPage.createBusy") : t("admin.rolesPage.createSubmit")}
          </Button>
        </form>
      </div>
    </section>
  );
}
