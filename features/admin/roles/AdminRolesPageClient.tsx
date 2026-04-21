"use client";

import type { RoleCatalogEntry } from "@/lib/roles/catalog";

import { AdminOrganizationRolesPanel } from "./components/AdminOrganizationRolesPanel";
import { AdminRolesPageHeader } from "./components/AdminRolesPageHeader";
import { AdminRolesTabList } from "./components/AdminRolesTabList";
import { AdminSystemRolesPanel } from "./components/AdminSystemRolesPanel";
import { useAdminOrgRoles } from "./hooks/useAdminOrgRoles";

interface AdminRolesPageClientProps {
  organizationId: string;
  roles: RoleCatalogEntry[];
}

export function AdminRolesPageClient({ organizationId, roles }: AdminRolesPageClientProps) {
  const r = useAdminOrgRoles({ organizationId, roles });

  return (
    <div className="space-y-6">
      <AdminRolesPageHeader />

      <AdminRolesTabList
        activeRolesTab={r.activeRolesTab}
        orgRolesCount={r.orgRoles.length}
        systemRolesCount={r.systemRoles.length}
        onTabChange={r.setActiveRolesTab}
      />

      <AdminSystemRolesPanel
        hidden={r.activeRolesTab !== "system"}
        systemRoles={r.systemRoles}
      />

      <AdminOrganizationRolesPanel
        form={{
          createBusy: r.createBusy,
          newDomainRole: r.newDomainRole,
          newPlatforms: r.newPlatforms,
          newSlug: r.newSlug,
          newTitle: r.newTitle,
          setNewDomainRoleSafe: r.setNewDomainRoleSafe,
          setNewSlug: r.setNewSlug,
          setNewTitle: r.setNewTitle,
          setSlugLocked: r.setSlugLocked,
          slugLocked: r.slugLocked,
          submitCreate: r.submitCreate,
          toggleNewPlatform: r.toggleNewPlatform,
        }}
        hidden={r.activeRolesTab !== "organization"}
        orgRoles={r.orgRoles}
        table={{
          beginEdit: r.beginEdit,
          cancelDelete: r.cancelDelete,
          cancelEdit: r.cancelEdit,
          confirmDelete: r.confirmDelete,
          deleteBusy: r.deleteBusy,
          deletingSlug: r.deletingSlug,
          editBusy: r.editBusy,
          editDomainRole: r.editDomainRole,
          editingSlug: r.editingSlug,
          editPlatforms: r.editPlatforms,
          editTitle: r.editTitle,
          setEditDomainRoleSafe: r.setEditDomainRoleSafe,
          setEditTitle: r.setEditTitle,
          startDelete: r.startDelete,
          submitEdit: r.submitEdit,
          toggleEditPlatform: r.toggleEditPlatform,
        }}
      />
    </div>
  );
}
