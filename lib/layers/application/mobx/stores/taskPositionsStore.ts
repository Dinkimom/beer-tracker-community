import type { GetTaskInfoFn } from '@/lib/layers/data/taskPositionsTypes';
import type { TaskPosition } from '@/types';

import { action, computed, makeObservable, observable, runInAction } from 'mobx';

import {
  deleteTaskPosition as deleteTaskPositionApi,
  fetchSprintPositions,
  saveTaskPosition,
  saveTaskPositionsBatch,
} from '@/lib/beerTrackerApi';
import {
  isValidSprintId,
  stripPositionSource,
  taskPositionToApi,
} from '@/lib/layers/data/mappers/taskPositionToApi';
import { DELAYS } from '@/utils/constants';

interface PendingUpdate { devTaskKey?: string; isQa: boolean; position: TaskPosition }

/** Одна сохранённая позиция после шага undo/redo — для сведения задач и оценок с трекером. */
export interface PlanHistoryAppliedSave {
  devTaskKey?: string;
  isQa: boolean;
  position: TaskPosition;
}

export type PlanHistoryAppliedPayload = { saves: PlanHistoryAppliedSave[] };

export interface PositionHistoryOptions {
  recordHistory?: boolean;
}

type PositionHistoryValue = TaskPosition | null;

interface PositionHistoryStep {
  after: Map<string, PositionHistoryValue>;
  before: Map<string, PositionHistoryValue>;
}

const MAX_PLAN_HISTORY_STEPS = 5;

/**
 * Позиции задач на спринте (карты на свимлейне / занятости) + синхронизация с API.
 * Один экземпляр на приложение (как планер спринта).
 */
export class TaskPositionsStore {
  /** taskId → позиция */
  positions = observable.map<string, TaskPosition>();

  undoStack: PositionHistoryStep[] = [];

  redoStack: PositionHistoryStep[] = [];

  /**
   * Идёт хотя бы один in-flight `fetchSprintPositions` для валидного спринта.
   * Нужен для полноэкранного лоадера до согласования списка «без позиции» в сайдбаре и доски.
   */
  positionsLoadPending = false;

  /** Последний спринт, для которого завершилась текущая волна загрузок позиций (inFlight → 0). */
  positionsSettledSprintId: number | null = null;

  private positionsFetchInFlight = 0;

  private debounceTimerRef: NodeJS.Timeout | null = null;

  private pendingUpdatesRef = new Map<string, PendingUpdate>();

  private resolveGetTaskInfo: () => GetTaskInfoFn | undefined = () => undefined;

  private sprintId: number | null = null;

  private syncAssignees = true;

  /**
   * Счётчик для отбрасывания устаревших ответов `fetchSprintPositions`.
   * Увеличивается при каждом старте loadSprint и при любой локальной мутации позиций,
   * чтобы ответ загрузки, пришедший после DnD/сохранения, не делал `clear()` и не затирал UI.
   */
  private reconcileGeneration = 0;

  private isApplyingHistory = false;

  private onPlanHistoryApplied?: (payload: PlanHistoryAppliedPayload) => void;

  constructor() {
    makeObservable(this, {
      deletePosition: action,
      canRedo: computed,
      canUndo: computed,
      loadSprint: action,
      positions: observable,
      positionsLoadPending: observable,
      positionsSettledSprintId: observable,
      redo: action,
      redoStack: observable.shallow,
      savePosition: action,
      setOnPlanHistoryApplied: action,
      setPositionsWithSave: action,
      setResolveGetTaskInfo: action,
      setSyncAssigneesFlag: action,
      undo: action,
      undoStack: observable.shallow,
    });
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private bumpReconcileGeneration(): void {
    this.reconcileGeneration++;
  }

  private positionsEqual(a: PositionHistoryValue, b: PositionHistoryValue): boolean {
    return JSON.stringify(a == null ? null : stripPositionSource(a)) ===
      JSON.stringify(b == null ? null : stripPositionSource(b));
  }

  private recordHistoryStep(step: PositionHistoryStep): void {
    if (this.isApplyingHistory) {
      return;
    }

    const hasChange = Array.from(new Set([...step.before.keys(), ...step.after.keys()])).some(
      (taskId) => !this.positionsEqual(step.before.get(taskId) ?? null, step.after.get(taskId) ?? null)
    );
    if (!hasChange) {
      return;
    }

    this.undoStack.push(step);
    if (this.undoStack.length > MAX_PLAN_HISTORY_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private buildHistoryStepForTask(
    taskId: string,
    nextPosition: PositionHistoryValue
  ): PositionHistoryStep {
    return {
      after: new Map([[taskId, nextPosition == null ? null : stripPositionSource(nextPosition)]]),
      before: new Map([[taskId, this.positions.get(taskId) ?? null]]),
    };
  }

  private buildHistoryStepForMap(updated: Map<string, TaskPosition>): PositionHistoryStep {
    const taskIds = new Set<string>([...this.positions.keys(), ...updated.keys()]);
    const before = new Map<string, PositionHistoryValue>();
    const after = new Map<string, PositionHistoryValue>();

    taskIds.forEach((taskId) => {
      before.set(taskId, this.positions.get(taskId) ?? null);
      after.set(taskId, updated.get(taskId) ?? null);
    });

    return { after, before };
  }

  private getPendingUpdateForPosition(position: TaskPosition): PendingUpdate {
    const fn = this.resolveGetTaskInfo();
    const info = fn ? fn(position.taskId) : { isQa: false };
    return {
      devTaskKey: info.devTaskKey,
      isQa: info.isQa,
      position,
    };
  }

  private notifyPlanHistoryApplied(values: Map<string, PositionHistoryValue>): void {
    if (!this.onPlanHistoryApplied) return;

    const saves: PlanHistoryAppliedSave[] = [];
    values.forEach((position) => {
      if (position != null) {
        saves.push(this.getPendingUpdateForPosition(position));
      }
    });
    if (saves.length === 0) return;

    this.onPlanHistoryApplied({ saves });
  }

  private async syncHistoryStepValues(values: Map<string, PositionHistoryValue>): Promise<void> {
    if (!isValidSprintId(this.sprintId)) return;
    const sprintId = this.sprintId!;

    const saves: PendingUpdate[] = [];
    const deletes: string[] = [];
    values.forEach((position, taskId) => {
      this.pendingUpdatesRef.delete(taskId);
      if (position == null) {
        deletes.push(taskId);
      } else {
        saves.push(this.getPendingUpdateForPosition(position));
      }
    });

    await Promise.all([
      ...deletes.map((taskId) =>
        deleteTaskPositionApi(sprintId, taskId).catch((error) => {
          console.error('Error deleting position during history apply:', error);
        })
      ),
      ...saves.map(({ position, isQa, devTaskKey }) => {
        const apiData = {
          ...taskPositionToApi(position, isQa, devTaskKey),
          syncAssignee: this.syncAssignees,
        };
        return saveTaskPosition(sprintId, apiData).catch((error) => {
          console.error('Error saving position during history apply:', error);
        });
      }),
    ]);
  }

  private applyHistoryValues(values: Map<string, PositionHistoryValue>): void {
    this.bumpReconcileGeneration();
    runInAction(() => {
      values.forEach((position, taskId) => {
        if (position == null) {
          this.positions.delete(taskId);
        } else {
          this.positions.set(taskId, stripPositionSource(position));
        }
      });
    });
  }

  undo(): void {
    const step = this.undoStack.pop();
    if (!step) return;

    this.isApplyingHistory = true;
    this.applyHistoryValues(step.before);
    this.isApplyingHistory = false;
    this.notifyPlanHistoryApplied(step.before);
    this.redoStack.push(step);
    void this.syncHistoryStepValues(step.before);
  }

  redo(): void {
    const step = this.redoStack.pop();
    if (!step) return;

    this.isApplyingHistory = true;
    this.applyHistoryValues(step.after);
    this.isApplyingHistory = false;
    this.notifyPlanHistoryApplied(step.after);
    this.undoStack.push(step);
    void this.syncHistoryStepValues(step.after);
  }

  setOnPlanHistoryApplied(handler?: (payload: PlanHistoryAppliedPayload) => void): void {
    this.onPlanHistoryApplied = handler;
  }

  setResolveGetTaskInfo(fn: () => GetTaskInfoFn | undefined): void {
    this.resolveGetTaskInfo = fn;
  }

  setSyncAssigneesFlag(syncAssignees: boolean): void {
    this.syncAssignees = syncAssignees;
  }

  async loadSprint(sprintId: number | null): Promise<void> {
    if (!isValidSprintId(sprintId)) {
      this.sprintId = sprintId;
      this.reconcileGeneration++;
      runInAction(() => {
        this.positions.clear();
        this.undoStack = [];
        this.redoStack = [];
        this.positionsFetchInFlight = 0;
        this.positionsLoadPending = false;
        this.positionsSettledSprintId = null;
      });
      return;
    }

    // Уже загрузили позиции для этого спринта и нет параллельного fetch — выходим без bump gen / pending.
    // Иначе повторный вызов из useTaskPositionsApi при монтировании планера включает positionsLoadPending,
    // полноэкранный лоадер снова скрывает SprintPlanner → размонтирование → бесконечный цикл.
    if (
      this.sprintId === sprintId &&
      this.positionsSettledSprintId === sprintId &&
      this.positionsFetchInFlight === 0
    ) {
      return Promise.resolve();
    }

    const sprintChanged = this.sprintId !== sprintId;
    this.sprintId = sprintId;
    const myGen = ++this.reconcileGeneration;

    runInAction(() => {
      if (sprintChanged) {
        this.undoStack = [];
        this.redoStack = [];
      }
      this.positionsFetchInFlight++;
      this.positionsLoadPending = true;
    });

    try {
      const data = await fetchSprintPositions(sprintId);
      if (myGen !== this.reconcileGeneration) {
        return;
      }
      runInAction(() => {
        this.positions.clear();
        if (data && Array.isArray(data)) {
          data.forEach((position: TaskPosition) => {
            this.positions.set(position.taskId, position);
          });
        }
      });
    } catch (error) {
      console.error('Error loading positions:', error);
    } finally {
      runInAction(() => {
        this.positionsFetchInFlight = Math.max(0, this.positionsFetchInFlight - 1);
        this.positionsLoadPending = this.positionsFetchInFlight > 0;
        if (this.positionsFetchInFlight === 0 && isValidSprintId(this.sprintId)) {
          this.positionsSettledSprintId = this.sprintId;
        }
      });
    }
  }

  savePosition(
    position: TaskPosition,
    isQa: boolean = false,
    devTaskKey?: string,
    immediate = false,
    options?: PositionHistoryOptions
  ): Promise<void> {
    if (!isValidSprintId(this.sprintId)) {
      return Promise.resolve();
    }

    const sprintId = this.sprintId!;

    if (options?.recordHistory) {
      this.recordHistoryStep(this.buildHistoryStepForTask(position.taskId, position));
    }

    this.bumpReconcileGeneration();
    runInAction(() => {
      this.positions.set(position.taskId, stripPositionSource(position));
    });

    if (immediate) {
      const apiData = {
        ...taskPositionToApi(position, isQa, devTaskKey),
        syncAssignee: this.syncAssignees,
      };
      return saveTaskPosition(sprintId, apiData).then(() => undefined);
    }

    this.pendingUpdatesRef.set(position.taskId, { position, isQa, devTaskKey });

    if (this.debounceTimerRef) {
      clearTimeout(this.debounceTimerRef);
    }

    const delay = immediate ? 0 : DELAYS.DEBOUNCE;
    return new Promise((resolve, reject) => {
      this.debounceTimerRef = setTimeout(async () => {
        const updates = new Map(this.pendingUpdatesRef);
        this.pendingUpdatesRef.clear();

        if (updates.size > 1) {
          try {
            const positionsArray = Array.from(updates.values()).map(
              ({ position: pos, isQa: qa, devTaskKey: devKey }) => ({
                ...taskPositionToApi(pos, qa, devKey),
                syncAssignee: this.syncAssignees,
              })
            );
            await saveTaskPositionsBatch(sprintId, positionsArray);
            resolve();
          } catch (error) {
            console.error('Error saving batch positions:', error);
            updates.forEach(({ position: pos, isQa: qa, devTaskKey: devKey }, taskId) => {
              this.pendingUpdatesRef.set(taskId, { position: pos, isQa: qa, devTaskKey: devKey });
            });
            reject(error);
          }
        } else if (updates.size === 1) {
          const [{ position: pos, isQa: qa, devTaskKey: devKey }] = Array.from(updates.values());
          try {
            const apiData = {
              ...taskPositionToApi(pos, qa, devKey),
              syncAssignee: this.syncAssignees,
            };
            await saveTaskPosition(sprintId, apiData);
            resolve();
          } catch (error) {
            console.error('Error saving position:', error);
            this.pendingUpdatesRef.set(pos.taskId, { position: pos, isQa: qa, devTaskKey: devKey });
            reject(error);
          }
        } else {
          resolve();
        }
      }, delay);
    });
  }

  async deletePosition(taskId: string, options?: PositionHistoryOptions): Promise<void> {
    if (!isValidSprintId(this.sprintId)) return;

    const sprintId = this.sprintId!;

    if (options?.recordHistory) {
      this.recordHistoryStep(this.buildHistoryStepForTask(taskId, null));
    }

    this.bumpReconcileGeneration();
    runInAction(() => {
      this.positions.delete(taskId);
    });

    this.pendingUpdatesRef.delete(taskId);

    try {
      await deleteTaskPositionApi(sprintId, taskId);
    } catch (error) {
      console.error('Error deleting position:', error);
    }
  }

  setPositionsWithSave(
    newPositions: Map<string, TaskPosition> | ((prev: Map<string, TaskPosition>) => Map<string, TaskPosition>),
    options?: PositionHistoryOptions
  ): void {
    this.bumpReconcileGeneration();
    const prev = new Map(this.positions);
    const updated =
      typeof newPositions === 'function' ? newPositions(prev) : newPositions;

    if (options?.recordHistory) {
      this.recordHistoryStep(this.buildHistoryStepForMap(updated));
    }

    const changed = new Map<string, TaskPosition>();
    updated.forEach((pos, taskId) => {
      const oldPos = prev.get(taskId);
      if (!oldPos || JSON.stringify(oldPos) !== JSON.stringify(pos)) {
        changed.set(taskId, pos);
      }
    });

    runInAction(() => {
      this.positions.clear();
      updated.forEach((pos, taskId) => {
        this.positions.set(taskId, pos);
      });
    });

    if (changed.size === 0) {
      return;
    }

    if (this.debounceTimerRef) {
      clearTimeout(this.debounceTimerRef);
    }

    changed.forEach((pos) => {
      const fn = this.resolveGetTaskInfo();
      const info = fn ? fn(pos.taskId) : { isQa: false };
      this.pendingUpdatesRef.set(pos.taskId, {
        position: pos,
        isQa: info.isQa,
        devTaskKey: info.devTaskKey,
      });
    });

    this.debounceTimerRef = setTimeout(async () => {
      const updates = new Map(this.pendingUpdatesRef);
      this.pendingUpdatesRef.clear();

      if (!isValidSprintId(this.sprintId)) return;
      const sprintId = this.sprintId!;

      if (updates.size > 1) {
        try {
          const positionsArray = Array.from(updates.values()).map(({ position: pos, isQa: qa, devTaskKey: devKey }) => ({
            ...taskPositionToApi(pos, qa, devKey),
            syncAssignee: this.syncAssignees,
          }));
          await saveTaskPositionsBatch(sprintId, positionsArray);
        } catch (error) {
          console.error('Error saving batch positions:', error);
          updates.forEach(({ position: pos, isQa: qa, devTaskKey: devKey }, taskId) => {
            this.pendingUpdatesRef.set(taskId, { position: pos, isQa: qa, devTaskKey: devKey });
          });
        }
      } else if (updates.size === 1) {
        const [{ position: pos, isQa: qa, devTaskKey: devKey }] = Array.from(updates.values());
        try {
          const apiData = {
            ...taskPositionToApi(pos, qa, devKey),
            syncAssignee: this.syncAssignees,
          };
          await saveTaskPosition(sprintId, apiData);
        } catch (error) {
          console.error('Error saving position:', error);
          this.pendingUpdatesRef.set(pos.taskId, { position: pos, isQa: qa, devTaskKey: devKey });
        }
      }
    }, DELAYS.DEBOUNCE);
  }
}
