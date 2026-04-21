/**
 * Слои приложения (зависимости только «вниз»):
 *
 * 1. **transport** — HTTP/WebSocket/сырые клиенты (`lib/layers/transport`, база в `lib/axios`).
 * 2. **data** — репозитории, маппинг DTO → домен (`lib/layers/data`).
 * 3. **application** — MobX-сторы, сценарии (`lib/layers/application`).
 * 4. **UI** — React-компоненты (`app/`, `features/`, `components/`), подписка через `mobx-react-lite` / провайдер.
 */

export type {
  SprintPlannerContextMenuAnchorRect,
  SprintPlannerContextMenuState,
} from './application/mobx/sprintPlannerUiTypes';
export type { RootStore } from './application/mobx/createRootStore';
export { createRootStore } from './application/mobx/createRootStore';
export { MobxRootProvider, useRootStore } from './application/mobx/MobxRootProvider';
export type { DataLayerError } from './data/types';
export type { TransportErr, TransportOk, TransportResult } from './transport/types';
export { beerTrackerApi, trackerApi } from './transport/httpClient';
