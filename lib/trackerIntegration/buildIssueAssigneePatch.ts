import type { TrackerIntegrationStored } from './schema';

/**
 * Тело PATCH /issues/{key} для назначения исполнителя с учётом имён полей из конфига.
 */
export function buildIssueAssigneePatch(
  assigneeId: string,
  isQa: boolean,
  integration: TrackerIntegrationStored | null | undefined
): Record<string, unknown> {
  const flow = integration?.testingFlow;
  if (isQa) {
    const k = flow?.qaEngineerFieldId?.trim() || 'qaEngineer';
    return { [k]: { id: assigneeId } };
  }
  const k = flow?.devAssigneeFieldId?.trim() || 'assignee';
  return { [k]: { id: assigneeId } };
}
