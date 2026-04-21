'use client';

import type { UserOrganizationSummary } from '@/lib/organizations';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useAdminOrganizationId } from '@/features/admin/AdminOrganizationIdContext';
import { AdminOrgSection } from '@/features/admin/components/AdminOrgSection';
import { useI18n } from '@/contexts/LanguageContext';
import { resolvePrimaryAdminOrganization } from '@/lib/access/resolvePrimaryAdminOrganization';

interface AdminOrgPageClientProps {
  initialOrgs: UserOrganizationSummary[];
}

export function AdminOrgPageClient({ initialOrgs }: AdminOrgPageClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const organizationId = useAdminOrganizationId();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const organization = useMemo(() => {
    const fromId = orgs.find((o) => o.organization_id === organizationId);
    if (fromId) {
      return fromId;
    }
    return resolvePrimaryAdminOrganization(orgs);
  }, [orgs, organizationId]);

  const canRename = organization?.role === 'org_admin';

  useEffect(() => {
    setRenameDraft(organization?.name ?? '');
  }, [organization?.name, organization?.organization_id]);

  useEffect(() => {
    setOrgs(initialOrgs);
  }, [initialOrgs]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/organizations', {
        body: JSON.stringify({ name: orgName }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as {
        error?: string;
        organization?: { id: string; name: string; slug: string | null };
      };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.orgPage.createFailed'));
        return;
      }
      if (data.organization) {
        const newOrg: UserOrganizationSummary = {
          canAccessAdmin: true,
          canUsePlanner: true,
          managedTeamIds: null,
          initial_sync_completed_at: null,
          name: data.organization.name,
          organization_id: data.organization.id,
          role: 'org_admin',
          slug: data.organization.slug,
        };
        setOrgs([newOrg]);
        setOrgName('');
        router.replace('/admin/org');
        toast.success(t('admin.orgPage.createSuccess'));
      }
      router.refresh();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setLoading(false);
    }
  }

  async function renameOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!organization || organization.role !== 'org_admin') {
      return;
    }
    const id = organization.organization_id;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      toast.error(t('admin.orgPage.nameRequired'));
      return;
    }
    if (trimmed === organization.name) {
      return;
    }
    setRenameLoading(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        body: JSON.stringify({ name: trimmed }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = (await res.json()) as {
        error?: string;
        organization?: { id: string; name: string; slug: string | null };
      };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.orgPage.renameFailed'));
        return;
      }
      if (data.organization) {
        setOrgs((prev) =>
          prev.map((o) =>
            o.organization_id === id
              ? {
                  ...o,
                  name: data.organization!.name,
                  slug: data.organization!.slug ?? o.slug,
                }
              : o
          )
        );
        toast.success(t('admin.orgPage.renameSuccess'));
      }
      router.refresh();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setRenameLoading(false);
    }
  }

  return (
    <AdminOrgSection
      canRename={canRename}
      createLoading={loading}
      orgName={orgName}
      organization={organization}
      renameDraft={renameDraft}
      renameLoading={renameLoading}
      onOrgNameChange={setOrgName}
      onRenameDraftChange={setRenameDraft}
      onRenameSubmit={(e) => void renameOrg(e)}
      onSubmit={(e) => void createOrg(e)}
    />
  );
}
