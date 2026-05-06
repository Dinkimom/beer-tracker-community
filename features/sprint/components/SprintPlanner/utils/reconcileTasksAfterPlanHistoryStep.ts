/**
 * После undo/redo позиций в планере приводим задачи и трекер к актуальной фазе:
 * длина фазы → SP/TP локально; при syncEstimates — PATCH в трекер.
 * Исполнители строки свимлейна → поля задачи (позиция — источник правды для раскладки).
 */

import type { PlanHistoryAppliedPayload } from '@/lib/layers/application/mobx/stores/taskPositionsStore';
import type { Developer, Task } from '@/types';
import type { Dispatch, SetStateAction } from 'react';

import { getTaskPoints, isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { updateIssueWorkForPhase } from '@/lib/beerTrackerApi';
import { timeslotsToStoryPoints } from '@/lib/pointsUtils';

type TaskRowPatch = Partial<
  Pick<Task, 'assignee' | 'assigneeName' | 'qaEngineer' | 'qaEngineerName' | 'storyPoints' | 'testPoints'>
>;

function mergePatch(patches: Map<string, TaskRowPatch>, taskId: string, partial: TaskRowPatch): void {
  const prev = patches.get(taskId) ?? {};
  patches.set(taskId, { ...prev, ...partial });
}

export function reconcileTasksAfterPlanHistoryStep(
  payload: PlanHistoryAppliedPayload,
  ctx: {
    developers: Developer[];
    syncEstimates: boolean;
    tasksMap: Map<string, Task>;
  },
  setTasks: Dispatch<SetStateAction<Task[]>>
): void {
  const { saves } = payload;
  if (saves.length === 0) {
    return;
  }

  const patches = new Map<string, TaskRowPatch>();
  const trackerByIssueKey = new Map<string, { issueKey: string; points: number; isQa: boolean }>();

  for (const { position, isQa, devTaskKey } of saves) {
    const phaseTask = ctx.tasksMap.get(position.taskId);
    if (phaseTask) {
      const assigneeName = ctx.developers.find((d) => d.id === position.assignee)?.name;
      if (phaseTask.team === 'QA') {
        const devId = phaseTask.originalTaskId ?? devTaskKey;
        if (devId) {
          mergePatch(patches, devId, {
            qaEngineer: position.assignee,
            qaEngineerName: assigneeName ?? undefined,
          });
        }
      } else {
        mergePatch(patches, phaseTask.id, {
          assignee: position.assignee,
          assigneeName: assigneeName ?? undefined,
        });
      }
    }

    const taskByPosition = phaseTask;
    const effectiveIsQa = isQa || !!(taskByPosition && isEffectivelyQaTask(taskByPosition));
    const devTask =
      effectiveIsQa && devTaskKey ? ctx.tasksMap.get(devTaskKey) : ctx.tasksMap.get(position.taskId);

    if (!devTask) {
      continue;
    }

    const currentEstimate = effectiveIsQa ? (devTask.testPoints ?? 0) : getTaskPoints(devTask);
    const newPoints = timeslotsToStoryPoints(position.duration);

    if (newPoints === currentEstimate) {
      continue;
    }

    const devTargetId =
      effectiveIsQa && devTask.originalTaskId ? devTask.originalTaskId : devTask.id;

    if (effectiveIsQa) {
      mergePatch(patches, devTargetId, { testPoints: newPoints });
      for (const t of ctx.tasksMap.values()) {
        if (t.originalTaskId === devTargetId) {
          mergePatch(patches, t.id, { testPoints: newPoints });
        }
      }
    } else {
      mergePatch(patches, devTargetId, { storyPoints: newPoints });
    }

    const issueKey = effectiveIsQa && devTaskKey ? devTaskKey : position.taskId;
    trackerByIssueKey.set(issueKey, { issueKey, points: newPoints, isQa: effectiveIsQa });
  }

  if (ctx.syncEstimates) {
    for (const { issueKey, points, isQa } of trackerByIssueKey.values()) {
      updateIssueWorkForPhase(issueKey, points, isQa).catch((err) => {
        console.error('Re-estimate after plan undo/redo failed:', err);
      });
    }
  }

  if (patches.size === 0) {
    return;
  }

  setTasks((prev) => {
    let changed = false;
    const next = prev.map((t) => {
      const p = patches.get(t.id);
      if (!p) return t;
      changed = true;
      return { ...t, ...p };
    });
    return changed ? next : prev;
  });
}
