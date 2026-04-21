'use client';

import type { UserOrganizationSummary } from '@/lib/organizations';
import type { FormEvent } from 'react';

import { Button } from '@/components/Button';
import {
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
} from '@/features/admin/adminUiTokens';
import { useI18n } from '@/contexts/LanguageContext';

interface AdminOrgSectionProps {
  'aria-labelledby'?: string;
  canRename: boolean;
  createLoading: boolean;
  id?: string;
  organization: UserOrganizationSummary | null;
  orgName: string;
  renameDraft: string;
  renameLoading: boolean;
  onOrgNameChange: (value: string) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameSubmit: (e: FormEvent) => void;
  onSubmit: (e: FormEvent) => void;
}

export function AdminOrgSection({
  'aria-labelledby': ariaLabelledBy,
  canRename,
  createLoading,
  id,
  organization,
  orgName,
  renameDraft,
  renameLoading,
  onOrgNameChange,
  onRenameDraftChange,
  onRenameSubmit,
  onSubmit,
}: AdminOrgSectionProps) {
  const { t } = useI18n();
  const showCreateForm = organization === null;

  const showRenameBlock = canRename;
  const renameFormHasTopBorder = Boolean(organization && !canRename);

  return (
    <section aria-labelledby={ariaLabelledBy} className={cardShell} id={id} role="tabpanel">
      <div className={cardHeader}>
        <h2 className={hCard}>{t('admin.orgSection.title')}</h2>
        {showCreateForm ? (
          <p className={`mt-1 ${muted}`}>{t('admin.orgSection.introCreateOne')}</p>
        ) : null}
      </div>
      <div className={`${cardBody} space-y-5`}>
        {showCreateForm ? (
          <p className={muted}>{t('admin.orgSection.introNoOrg')}</p>
        ) : null}

        {organization && !canRename ? (
          <p className="font-medium text-gray-900 dark:text-gray-100">{organization.name}</p>
        ) : null}

        {showRenameBlock ? (
          <form
            className={`max-w-md space-y-3 ${renameFormHasTopBorder ? 'border-t border-gray-200 pt-5 dark:border-gray-700' : ''}`}
            onSubmit={onRenameSubmit}
          >
            <label className={label} htmlFor="org-rename">
              {t('admin.orgSection.renameLabel')}
            </label>
            <input
              className={field}
              id="org-rename"
              placeholder={t('admin.orgSection.renamePlaceholder')}
              required
              type="text"
              value={renameDraft}
              onChange={(e) => onRenameDraftChange(e.target.value)}
            />
            <Button className="px-3.5 py-2" disabled={renameLoading} type="submit" variant="primary">
              {renameLoading ? t('admin.orgSection.renameSaving') : t('admin.orgSection.renameSubmit')}
            </Button>
          </form>
        ) : null}

        {showCreateForm ? (
          <form
            className="max-w-md space-y-3 border-t border-gray-200 pt-5 dark:border-gray-700"
            onSubmit={onSubmit}
          >
            <label className={label} htmlFor="org-name">
              {t('admin.orgSection.createLabel')}
            </label>
            <input
              className={field}
              id="org-name"
              placeholder={t('admin.orgSection.createPlaceholder')}
              required
              type="text"
              value={orgName}
              onChange={(e) => onOrgNameChange(e.target.value)}
            />
            <Button className="px-3.5 py-2" disabled={createLoading} type="submit" variant="primary">
              {createLoading ? t('admin.orgSection.createSubmitting') : t('admin.orgSection.createSubmit')}
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
