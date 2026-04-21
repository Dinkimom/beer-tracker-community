import { listDistinctStatusPaletteKeys } from '@/utils/statusColors';

import {
  UNCATEGORIZED,
  type CategoryBucketId,
  type IntegrationSubtabId,
} from './types';

export const STATUS_PALETTE_OPTIONS = listDistinctStatusPaletteKeys();

export const CATEGORY_SECTION_ORDER: CategoryBucketId[] = [
  'todo',
  'in-progress',
  'paused',
  'done',
  UNCATEGORIZED,
];

export function categorySectionTitle(
  id: CategoryBucketId,
  t: (key: string) => string
): string {
  if (id === UNCATEGORIZED) {
    return t('admin.plannerIntegration.category.uncategorized');
  }
  return t(`admin.plannerIntegration.category.${id}`);
}

export const sectionBlock =
  'overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/40 p-4 dark:border-gray-700 dark:bg-gray-900/30';

export function integrationSubtabs(t: (key: string) => string): Array<{
  id: IntegrationSubtabId;
  label: string;
}> {
  return [
    { id: 'process-setup', label: t('admin.plannerIntegration.subtab.processSetup') },
    {
      id: 'statuses-mapping',
      label: t('admin.plannerIntegration.subtab.statusesMapping'),
    },
    { id: 'other', label: t('admin.plannerIntegration.subtab.other') },
  ];
}
