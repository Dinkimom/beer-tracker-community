/**
 * Generic хук для синхронизации **списка** сущностей с API (дебаунс, save/delete по элементу).
 * Обёртки: `useTaskLinksApi`, `useCommentsApi` в useApiStorage.ts.
 * Для одного документа (порядок занятости) — `useOccupancyTaskOrderApi`; см. ARCHITECTURE.md.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { isValidSprintId } from '@/lib/layers/data/mappers/taskPositionToApi';
import { DELAYS } from '@/utils/constants';

/**
 * Опции для хука синхронизации с API
 */
interface UseDebouncedApiSyncOptions<T, TId, TApiData> {
  debounceDelay?: number;
  sprintId: number | null;
  batchSaveFn?: (sprintId: number, items: TApiData[]) => Promise<{ success: boolean; count: number }>;
  compareItems?: (a: T, b: T) => boolean;
  deleteFn: (sprintId: number, id: TId) => Promise<boolean | void>;
  fetchFn: (sprintId: number) => Promise<T[]>;
  getId: (item: T) => TId;
  /**
   * После сохранения, если API вернул объект с другим id, слить поля клиента (например clientInstanceId).
   */
  mergeSavedItem?: (previous: T, saved: T) => T;
  /** При создании может вернуть созданный элемент с id с бэка (для подстановки в state) */
  saveFn: (sprintId: number, data: TApiData, isUpdate?: boolean) => Promise<T | boolean | void>;
  toApiFormat: (item: T, isUpdate?: boolean) => TApiData;
}

/**
 * Generic хук для работы с данными через API с дебаунсингом
 *
 * @template T - тип элемента данных
 * @template TId - тип идентификатора элемента
 * @template TApiData - тип данных для API
 */
export function useDebouncedApiSync<T, TId, TApiData>({
  sprintId,
  fetchFn,
  saveFn,
  batchSaveFn,
  deleteFn,
  getId,
  toApiFormat,
  compareItems,
  mergeSavedItem,
  debounceDelay = DELAYS.DEBOUNCE,
}: UseDebouncedApiSyncOptions<T, TId, TApiData>) {
  const [items, setItems] = useState<T[]>(() => []);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<TId, T>>(new Map());
  const itemsRef = useRef(items);

  // Синхронизируем ref с состоянием
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Загрузка данных при изменении спринта
  useEffect(() => {
    if (!isValidSprintId(sprintId)) {
      const timeoutId = setTimeout(() => {
        setItems([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    async function loadItems() {
      try {
        const data = await fetchFn(sprintId!);
        if (data && Array.isArray(data)) {
          setItems(data);
        }
      } catch (error) {
        console.error('Error loading items:', error);
      }
    }

    loadItems();
  }, [sprintId, fetchFn]);

  // Сохранение одного элемента
  const saveItem = useCallback(
    (item: T, isUpdate?: boolean): Promise<void> => {
      if (!isValidSprintId(sprintId)) return Promise.resolve();

      setItems((prev) => {
        const exists = prev.find((i) => getId(i) === getId(item));
        if (exists) {
          return prev.map((i) => (getId(i) === getId(item) ? item : i));
        }
        return [...prev, item];
      });

      pendingUpdatesRef.current.set(getId(item), item);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      return new Promise((resolve, reject) => {
        debounceTimerRef.current = setTimeout(async () => {
          const updates = new Map(pendingUpdatesRef.current);
          pendingUpdatesRef.current.clear();

          if (batchSaveFn && updates.size > 1) {
            try {
              const itemsArray = Array.from(updates.values()).map((item) => {
                const itemIsUpdate = isUpdate ?? itemsRef.current.some((i) => getId(i) === getId(item));
                return toApiFormat(item, itemIsUpdate);
              });
              await batchSaveFn(sprintId!, itemsArray);
              resolve();
            } catch (error) {
              console.error('Error saving batch items:', error);
              // В случае ошибки возвращаем элементы в pendingUpdates
              updates.forEach((item) => {
                pendingUpdatesRef.current.set(getId(item), item);
              });
              reject(error);
            }
          } else {
            // Для одной позиции или если нет batchSaveFn используем обычный endpoint
            const promises = Array.from(updates.values()).map((item) => {
              const itemIsUpdate = isUpdate ?? itemsRef.current.some((i) => getId(i) === getId(item));
              const apiData = toApiFormat(item, itemIsUpdate);
              return Promise.resolve(saveFn(sprintId!, apiData, itemIsUpdate)).catch((error) => {
                console.error('Error saving item:', error);
                // В случае ошибки возвращаем элемент в pendingUpdates
                pendingUpdatesRef.current.set(getId(item), item);
                throw error;
              });
            });

            try {
              await Promise.all(promises);
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        }, debounceDelay);
      });
    },
    [sprintId, saveFn, batchSaveFn, getId, toApiFormat, debounceDelay]
  );

  // Удаление элемента
  const deleteItem = useCallback(
    async (id: TId): Promise<void> => {
      if (!isValidSprintId(sprintId)) return;

      setItems((prev) => prev.filter((i) => getId(i) !== id));

      pendingUpdatesRef.current.delete(id);

      try {
        await deleteFn(sprintId!, id);
      } catch (error) {
        console.error('Error deleting item:', error);
        // В случае ошибки можно перезагрузить данные или показать уведомление
      }
    },
    [sprintId, deleteFn, getId]
  );

  // Обертка для setItems, которая также сохраняет изменения
  const setItemsWithSave = useCallback(
    (newItems: T[] | ((prev: T[]) => T[])) => {
      setItems((prev) => {
        const updated = typeof newItems === 'function' ? newItems(prev) : newItems;

        const defaultCompare = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
        const compare = compareItems || defaultCompare;

        const changed = new Map<TId, T>();
        updated.forEach((item) => {
          const oldItem = prev.find((i) => getId(i) === getId(item));
          if (!oldItem || !compare(oldItem, item)) {
            changed.set(getId(item), item);
          }
        });

        if (changed.size > 0 && isValidSprintId(sprintId)) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          changed.forEach((item) => {
            pendingUpdatesRef.current.set(getId(item), item);
          });

          debounceTimerRef.current = setTimeout(async () => {
            const updates = new Map(pendingUpdatesRef.current);
            pendingUpdatesRef.current.clear();

            if (batchSaveFn && updates.size > 1) {
              try {
                const itemsArray = Array.from(updates.values()).map((item) => {
                  const itemIsUpdate = prev.some((i) => getId(i) === getId(item));
                  return toApiFormat(item, itemIsUpdate);
                });
                await batchSaveFn(sprintId!, itemsArray);
              } catch (error) {
                console.error('Error saving batch items:', error);
                // В случае ошибки возвращаем элементы в pendingUpdates
                updates.forEach((item) => {
                  pendingUpdatesRef.current.set(getId(item), item);
                });
              }
            } else {
              // Для одной позиции или если нет batchSaveFn используем обычный endpoint
              const results = await Promise.all(
                Array.from(updates.values()).map(async (item) => {
                  const itemIsUpdate = prev.some((i) => getId(i) === getId(item));
                  const apiData = toApiFormat(item, itemIsUpdate);
                  try {
                    const result = await saveFn(sprintId!, apiData, itemIsUpdate);
                    return { item, result };
                  } catch (error) {
                    console.error('Error saving item:', error);
                    pendingUpdatesRef.current.set(getId(item), item);
                    return { item, result: null };
                  }
                })
              );
              const replacements = results.filter(
                (r) =>
                  r.result != null &&
                  typeof r.result === 'object' &&
                  !Array.isArray(r.result) &&
                  'id' in (r.result as object)
              ) as { item: T; result: T }[];
              if (replacements.length > 0) {
                setItems((prev) => {
                  let next: T[] = prev;
                  for (const { item, result } of replacements) {
                    const saved = result as T;
                    const merged =
                      mergeSavedItem != null ? mergeSavedItem(item, saved) : saved;
                    next = next.map((i) => (getId(i) === getId(item) ? merged : i));
                  }
                  return next;
                });
              }
            }
          }, debounceDelay);
        }

        return updated;
      });
    },
    [sprintId, saveFn, batchSaveFn, getId, toApiFormat, compareItems, debounceDelay, mergeSavedItem]
  );

  return [items, setItemsWithSave, saveItem, deleteItem] as const;
}

