import type { Task } from '@/types';

/** Сериализуемый rect для якорения контекстного меню у карточки задачи */
export interface SprintPlannerContextMenuAnchorRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface SprintPlannerContextMenuState {
  anchorRect?: SprintPlannerContextMenuAnchorRect;
  /** false — меню из кнопки ⋯ в строке занятости: без затемнения карточек/фаз и без синей обводки фазы */
  dimPeerUi?: boolean;
  hideRemoveFromPlan?: boolean;
  isBacklogTask?: boolean;
  position: { x: number; y: number };
  task: Task;
}
