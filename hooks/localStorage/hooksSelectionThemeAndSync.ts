import { useCallback, useEffect, useState } from 'react';

import { AppLanguage, DEFAULT_LANGUAGE, isAppLanguage } from '@/lib/i18n/model';
import { PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY } from '@/lib/tenantHttpConstants';
import {
  migrateTrackerTokenInLocalStorage,
  readTrackerTokenPayload,
  writeTrackerTokenPayload,
} from '@/lib/trackerTokenStorage';

import { STORAGE_KEYS } from './storageKeys';
import { getFromStorage, saveToStorage } from './storagePrimitives';
import { useLocalStorage as useLocalStorageBase } from './useLocalStorageBase';

type SelectedIdSetterArg<T extends number | null> = T | ((prev: T) => T) | null;

export function useSelectedSprintStorage(): [
  number | null,
  (sprintId: SelectedIdSetterArg<number | null>) => void
] {
  const [sprintId, setSprintIdState] = useState<number | null>(() => {
    const saved = getFromStorage<string>(STORAGE_KEYS.SELECTED_SPRINT, '');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return isNaN(parsed) ? null : parsed;
  });

  useEffect(() => {
    if (sprintId === null) {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_SPRINT);
    } else {
      saveToStorage(STORAGE_KEYS.SELECTED_SPRINT, sprintId.toString());
    }
  }, [sprintId]);

  const setSprintId = (
    newSprintId: number | ((prev: number | null) => number | null) | null
  ) => {
    setSprintIdState((prev) =>
      typeof newSprintId === 'function' ? newSprintId(prev) : newSprintId
    );
  };

  return [sprintId, setSprintId];
}

export function useSelectedBoardStorage(): [
  number | null,
  (boardId: SelectedIdSetterArg<number | null>) => void
] {
  const [boardId, setBoardIdState] = useState<number | null>(() => {
    const saved = getFromStorage<string>(STORAGE_KEYS.SELECTED_BOARD, '');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return isNaN(parsed) ? null : parsed;
  });

  useEffect(() => {
    if (boardId === null) {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_BOARD);
    } else {
      saveToStorage(STORAGE_KEYS.SELECTED_BOARD, boardId.toString());
    }
  }, [boardId]);

  const setBoardId = (
    newBoardId: number | ((prev: number | null) => number | null) | null
  ) => {
    setBoardIdState((prev) =>
      typeof newBoardId === 'function' ? newBoardId(prev) : newBoardId
    );
  };

  return [boardId, setBoardId];
}

export function useThemeStorage(): [
  'dark' | 'light',
  (theme: 'dark' | 'light' | ((prev: 'dark' | 'light') => 'dark' | 'light')) => void
] {
  return useLocalStorageBase<'dark' | 'light'>(STORAGE_KEYS.THEME, 'light');
}

export function useAppLanguageStorage(): [
  AppLanguage,
  (
    language:
      | AppLanguage
      | ((prev: AppLanguage) => AppLanguage)
  ) => void
] {
  const [storedLanguage, setStoredLanguage] = useLocalStorageBase<string>(
    STORAGE_KEYS.LANGUAGE,
    DEFAULT_LANGUAGE
  );

  const language = isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;

  useEffect(() => {
    if (!isAppLanguage(storedLanguage)) {
      setStoredLanguage(DEFAULT_LANGUAGE);
    }
  }, [storedLanguage, setStoredLanguage]);

  const setLanguage = useCallback(
    (nextValue: AppLanguage | ((prev: AppLanguage) => AppLanguage)) => {
      setStoredLanguage((prev) => {
        const safePrev = isAppLanguage(prev) ? prev : DEFAULT_LANGUAGE;
        const candidate =
          typeof nextValue === 'function'
            ? nextValue(safePrev)
            : nextValue;
        return isAppLanguage(candidate) ? candidate : DEFAULT_LANGUAGE;
      });
    },
    [setStoredLanguage]
  );

  return [language, setLanguage];
}

export function useChristmasThemeStorage(): [
  boolean,
  (enabled: boolean | ((prev: boolean) => boolean)) => void
] {
  return useLocalStorageBase<boolean>(STORAGE_KEYS.CHRISTMAS_THEME, true);
}

export function useExperimentalFeaturesStorage(): [
  boolean,
  (enabled: boolean | ((prev: boolean) => boolean)) => void
] {
  return useLocalStorageBase<boolean>(STORAGE_KEYS.EXPERIMENTAL_FEATURES, false);
}

export function useShowHolidaysStorage(): [
  boolean,
  (value: boolean | ((prev: boolean) => boolean)) => void
] {
  return useLocalStorageBase<boolean>(STORAGE_KEYS.SHOW_HOLIDAYS, true);
}

/**
 * Глобальная настройка синхронизации оценок с трекером.
 * Если выключено — UI может продолжать работать, но без отправки оценок в трекер.
 */
export function useDataSyncEstimatesStorage(): [
  boolean,
  (value: boolean | ((prev: boolean) => boolean)) => void
] {
  return useLocalStorageBase<boolean>(STORAGE_KEYS.DATA_SYNC_ESTIMATES, true);
}

/**
 * Глобальная настройка синхронизации исполнителей с трекером.
 * Если выключено — изменения исполнителей не должны отправляться в трекер.
 */
export function useDataSyncAssigneesStorage(): [
  boolean,
  (value: boolean | ((prev: boolean) => boolean)) => void
] {
  return useLocalStorageBase<boolean>(STORAGE_KEYS.DATA_SYNC_ASSIGNEES, true);
}

/**
 * OAuth токен трекера в localStorage: объект `{ token, organizationId }` (миграция со строки).
 * Первый элемент — сохранённый токен (для форм); при несовпадении org с активной tenant «эффективный»
 * токен для API см. {@link getEffectiveTrackerTokenForBrowser} / AuthGuard.
 */
export function useTrackerTokenStorage(): [
  string,
  (token: string, organizationId?: string) => void,
] {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    migrateTrackerTokenInLocalStorage();
    bump();
  }, [bump]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEYS.TRACKER_TOKEN ||
        e.key === PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY
      ) {
        bump();
      }
    };
    const onCustom = (e: Event) => {
      const k = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (k === STORAGE_KEYS.TRACKER_TOKEN || k === PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY) {
        bump();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('localStorageChange', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('localStorageChange', onCustom as EventListener);
    };
  }, [bump]);

  const setToken = useCallback(
    (token: string, organizationId?: string) => {
      const trimmed = token.trim();
      if (!trimmed) {
        writeTrackerTokenPayload({ organizationId: '', token: '' });
        window.dispatchEvent(
          new CustomEvent('localStorageChange', { detail: { key: STORAGE_KEYS.TRACKER_TOKEN } })
        );
        bump();
        return;
      }
      let org = organizationId?.trim() ?? '';
      if (!org) {
        try {
          org = localStorage.getItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY)?.trim() ?? '';
        } catch {
          org = '';
        }
      }
      writeTrackerTokenPayload({ organizationId: org, token: trimmed });
      window.dispatchEvent(
        new CustomEvent('localStorageChange', { detail: { key: STORAGE_KEYS.TRACKER_TOKEN } })
      );
      bump();
    },
    [bump]
  );

  const payload = readTrackerTokenPayload();
  return [payload.token, setToken];
}

/** Схема цвета фаз плана и карточек задач (свимлейн, занятость, канбан) */
export type PlanningPhaseCardColorScheme = 'monochrome' | 'status';

export function usePlanningPhaseCardColorSchemeStorage(): [
  PlanningPhaseCardColorScheme,
  (
    value:
      | PlanningPhaseCardColorScheme
      | ((prev: PlanningPhaseCardColorScheme) => PlanningPhaseCardColorScheme)
  ) => void,
] {
  return useLocalStorageBase<PlanningPhaseCardColorScheme>(
    STORAGE_KEYS.PLANNING_PHASE_CARD_COLOR_SCHEME,
    'status'
  );
}
