/**
 * Транспортный слой — сырой HTTP/WebSocket; реализация клиентов в `httpClient.ts` и `lib/axios`.
 */

export interface TransportOk<T> {
  data: T;
  ok: true;
}

export interface TransportErr {
  error: unknown;
  ok: false;
}

export type TransportResult<T> = TransportErr | TransportOk<T>;
