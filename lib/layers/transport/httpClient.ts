/**
 * Фасад HTTP-транспорта. Реализация — существующие клиенты в `lib/axios`.
 * Новые вызовы API добавляем через thin-обёртки здесь или в соседних модулях transport,
 * без импорта axios напрямую из data/application.
 */

export { beerTrackerApi, trackerApi } from '@/lib/axios';
