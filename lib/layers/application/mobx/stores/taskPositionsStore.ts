import type { GetTaskInfoFn } from '@/lib/layers/data/taskPositionsTypes';
import type { TaskPosition } from '@/types';

import { action, makeObservable, observable, runInAction } from 'mobx';

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

/**
 * Позиции задач на спринте (карты на свимлейне / занятости) + синхронизация с API.
 * Один экземпляр на приложение (как планер спринта).
 */
export class TaskPositionsStore {
  /** taskId → позиция */
  positions = observable.map<string, TaskPosition>();

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

  constructor() {
    makeObservable(this, {
      deletePosition: action,
      loadSprint: action,
      positions: observable,
      positionsLoadPending: observable,
      positionsSettledSprintId: observable,
      savePosition: action,
      setPositionsWithSave: action,
      setResolveGetTaskInfo: action,
      setSyncAssigneesFlag: action,
    });
  }

  private bumpReconcileGeneration(): void {
    this.reconcileGeneration++;
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

    this.sprintId = sprintId;
    const myGen = ++this.reconcileGeneration;

    runInAction(() => {
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
    immediate = false
  ): Promise<void> {
    if (!isValidSprintId(this.sprintId)) {
      return Promise.resolve();
    }

    const sprintId = this.sprintId!;

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
        } else {
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
        }
      }, delay);
    });
  }

  async deletePosition(taskId: string): Promise<void> {
    if (!isValidSprintId(this.sprintId)) return;

    const sprintId = this.sprintId!;

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
    newPositions: Map<string, TaskPosition> | ((prev: Map<string, TaskPosition>) => Map<string, TaskPosition>)
  ): void {
    this.bumpReconcileGeneration();
    const prev = new Map(this.positions);
    const updated =
      typeof newPositions === 'function' ? newPositions(prev) : newPositions;

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
