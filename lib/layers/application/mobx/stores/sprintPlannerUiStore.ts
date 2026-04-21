import type { SprintPlannerContextMenuState } from '../sprintPlannerUiTypes';
import type { Task } from '@/types';

import { action, makeObservable, observable } from 'mobx';
import { v4 as uuid } from 'uuid';

import { STORAGE_KEYS } from '@/hooks/localStorage/storageKeys';
import { getFromStorage, saveToStorage } from '@/hooks/localStorage/storagePrimitives';

/**
 * UI-состояние планера спринта (MobX).
 * Сюда по мере рефакторинга переносим флаги из useState/пропсов.
 */
export class SprintPlannerUiStore {
  /** Идентификатор «сессии» планера на клиенте (отладка, будущие подписки). */
  sessionId = uuid();

  /** Видимость комментариев в таймлайне (persist в localStorage). */
  commentsVisible = true;

  /** Открыт ли сайдбар планера (persist в localStorage). */
  sidebarOpen = true;

  /** Подсветка связей / затемнение при hover по карточке. */
  hoveredTaskId: string | null = null;

  /** Контекстное меню по задаче (позиция + задача). */
  contextMenu: SprintPlannerContextMenuState | null = null;

  /** Какая задача открыла контекстное меню (обводка карточки). */
  contextMenuTaskId: string | null = null;

  /** Модалка «учёт работ» по задаче. */
  accountWorkModal: Task | null = null;

  /** Редактирование сегментов фазы на свимлейне / в занятости. */
  segmentEditTaskId: string | null = null;

  /** Фокус редактирования комментария в таймлайне занятости. */
  openCommentEditId: string | null = null;

  /** Глобальный фильтр по имени/ключу в планере. */
  globalNameFilter = '';

  constructor() {
    this.commentsVisible = getFromStorage(STORAGE_KEYS.COMMENTS_VISIBLE, true);
    this.sidebarOpen = getFromStorage(STORAGE_KEYS.SIDEBAR_OPEN, true);
    makeObservable(this, {
      accountWorkModal: observable,
      clearTransientUiOnSprintChange: action.bound,
      closeContextMenu: action.bound,
      commentsVisible: observable,
      contextMenu: observable,
      contextMenuTaskId: observable,
      globalNameFilter: observable,
      hoveredTaskId: observable,
      openCommentEditId: observable,
      resetSession: action,
      segmentEditTaskId: observable,
      sessionId: observable,
      setAccountWorkModal: action.bound,
      setCommentsVisible: action.bound,
      setContextMenu: action.bound,
      setContextMenuTaskId: action.bound,
      setGlobalNameFilter: action.bound,
      setHoveredTaskId: action.bound,
      setOpenCommentEditId: action.bound,
      setSegmentEditTaskId: action.bound,
      setSidebarOpen: action.bound,
      sidebarOpen: observable,
    });
  }

  setCommentsVisible(visible: boolean): void {
    this.commentsVisible = visible;
    saveToStorage(STORAGE_KEYS.COMMENTS_VISIBLE, visible);
  }

  setSidebarOpen(open: boolean | ((prev: boolean) => boolean)): void {
    const next = typeof open === 'function' ? open(this.sidebarOpen) : open;
    this.sidebarOpen = next;
    saveToStorage(STORAGE_KEYS.SIDEBAR_OPEN, next);
  }

  resetSession(): void {
    this.sessionId = uuid();
  }

  setHoveredTaskId(id: string | null): void {
    this.hoveredTaskId = id;
  }

  setContextMenu(menu: SprintPlannerContextMenuState | null): void {
    this.contextMenu = menu;
  }

  setContextMenuTaskId(id: string | null): void {
    this.contextMenuTaskId = id;
  }

  closeContextMenu(): void {
    this.contextMenu = null;
    this.contextMenuTaskId = null;
  }

  setAccountWorkModal(task: Task | null): void {
    this.accountWorkModal = task;
  }

  setSegmentEditTaskId(id: string | null): void {
    this.segmentEditTaskId = id;
  }

  setOpenCommentEditId(id: string | null): void {
    this.openCommentEditId = id;
  }

  setGlobalNameFilter(value: string): void {
    this.globalNameFilter = value;
  }

  /** Сброс преходящего UI при смене спринта (поиск, меню, редактор сегментов). */
  clearTransientUiOnSprintChange(): void {
    this.globalNameFilter = '';
    this.segmentEditTaskId = null;
    this.contextMenu = null;
    this.contextMenuTaskId = null;
    this.openCommentEditId = null;
    this.hoveredTaskId = null;
    this.accountWorkModal = null;
  }
}
