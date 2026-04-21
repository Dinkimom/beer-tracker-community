export function formatAdminDateTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Алиас для использования внутри секций админки. */
export const formatDateTime = formatAdminDateTime;
