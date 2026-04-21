import type { Task } from '@/types';

export type ValidationIssueType =
  | 'missing-functional-team'
  | 'missing-product-team'
  | 'missing-sp'
  | 'missing-tp'
  | 'missing-stage'
  | 'multiple-sprints';

export interface ValidationIssue {
  params?: Record<string, string | number>;
  type: ValidationIssueType;
}

/**
 * Валидирует задачу и возвращает список проблем
 */
export function validateTask(task: Task): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (task.storyPoints === undefined || task.storyPoints === null) {
    issues.push({
      type: 'missing-sp',
    });
  }

  if (task.testPoints === undefined || task.testPoints === null) {
    issues.push({
      type: 'missing-tp',
    });
  }

  if (!task.productTeam || task.productTeam.length === 0) {
    issues.push({
      type: 'missing-product-team',
    });
  }

  if (!task.functionalTeam) {
    issues.push({
      type: 'missing-functional-team',
    });
  }

  if (!task.stage) {
    issues.push({
      type: 'missing-stage',
    });
  }

  if (task.sprints && task.sprints.length > 1) {
    issues.push({
      type: 'multiple-sprints',
      params: {
        count: task.sprints.length,
        sprints: task.sprints.map((s) => s.display).join(', '),
      },
    });
  }

  return issues;
}
