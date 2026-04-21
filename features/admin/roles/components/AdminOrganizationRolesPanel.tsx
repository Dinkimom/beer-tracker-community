import type { RoleCatalogEntry } from "@/lib/roles/catalog";

import { cardBody, cardHeader, cardShell, hCard } from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

import { CreateOrgRoleForm, type CreateOrgRoleFormProps } from "./CreateOrgRoleForm";
import {
  OrganizationRolesTable,
  type OrganizationRolesTableProps,
} from "./OrganizationRolesTable";

export interface AdminOrganizationRolesPanelProps {
  form: CreateOrgRoleFormProps;
  hidden: boolean;
  orgRoles: RoleCatalogEntry[];
  table: Omit<OrganizationRolesTableProps, "orgRoles">;
}

export function AdminOrganizationRolesPanel({
  form,
  hidden,
  orgRoles,
  table,
}: AdminOrganizationRolesPanelProps) {
  const { t } = useI18n();
  return (
    <div
      aria-labelledby="roles-tab-organization"
      className="space-y-6"
      hidden={hidden}
      id="roles-panel-organization"
      role="tabpanel"
    >
      <section className={cardShell}>
        <div className={cardHeader}>
          <h2 className={hCard}>{t("admin.rolesPage.orgPanelTitle")}</h2>
        </div>
        <div className={cardBody}>
          <OrganizationRolesTable orgRoles={orgRoles} {...table} />
        </div>
      </section>

      <CreateOrgRoleForm {...form} />
    </div>
  );
}
