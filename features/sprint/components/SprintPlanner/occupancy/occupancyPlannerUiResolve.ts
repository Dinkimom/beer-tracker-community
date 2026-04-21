import type { SprintPlannerUiStore } from '@/lib/layers/application/mobx/stores/sprintPlannerUiStore';

/** Поля UI планера, которые при `usePlannerUiStore` читаются из стора, иначе — из пропсов. */
export interface OccupancyPlannerUiResolved {
  contextMenuTaskId: string | null;
  globalNameFilter: string;
  openCommentEditId: string | null;
  segmentEditTaskId: string | null;
}

export function resolveOccupancyPlannerUiState(
  usePlannerUiStore: boolean,
  store: Pick<
    SprintPlannerUiStore,
    'contextMenuTaskId' | 'globalNameFilter' | 'openCommentEditId' | 'segmentEditTaskId'
  >,
  props: OccupancyPlannerUiResolved
): OccupancyPlannerUiResolved {
  if (usePlannerUiStore) {
    return {
      contextMenuTaskId: store.contextMenuTaskId,
      globalNameFilter: store.globalNameFilter,
      openCommentEditId: store.openCommentEditId,
      segmentEditTaskId: store.segmentEditTaskId,
    };
  }
  return props;
}
