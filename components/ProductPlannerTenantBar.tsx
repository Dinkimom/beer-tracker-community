'use client';

import { useI18n } from '@/contexts/LanguageContext';
import type { ProductSessionOrganization } from '@/hooks/useProductTenantOrganizations';

export interface ProductPlannerTenantBarProps {
  activeOrganizationId: string | null;
  organizations: ProductSessionOrganization[];
  sessionLoading: boolean;
  onOrganizationChange: (organizationId: string) => void;
}

export function ProductPlannerTenantBar({
  activeOrganizationId,
  organizations,
  onOrganizationChange,
  sessionLoading,
}: ProductPlannerTenantBarProps) {
  const { t } = useI18n();
  const showSwitcher = organizations.length > 1;

  if (!sessionLoading && organizations.length === 0) {
    return null;
  }

  if (!showSwitcher) {
    return null;
  }

  return (
    <div className="flex flex-shrink-0 flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200 sm:flex-row sm:items-center sm:justify-end">
      <label className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
        <span className="whitespace-nowrap font-medium">{t('plannerTenant.organizationLabel')}</span>
        <select
          className="max-w-[220px] rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value={activeOrganizationId ?? ''}
          onChange={(e) => onOrganizationChange(e.target.value)}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.slug ? ` (${o.slug})` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
