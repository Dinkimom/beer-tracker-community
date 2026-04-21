/**
 * Утилиты для перевода статусов и тегов на русский язык
 */

/**
 * Переводит статус задачи на русский язык
 */
export function translateStatus(status: string | null | undefined): string {
  if (!status) return '';

  const statusMap: Record<string, string> = {
    // Серые статусы
    'backlog': 'Бэклог',
    'readyfordevelopment': 'Готово к разработке',
    'transferredtodevelopment': 'Передано в разработку',

    // Синие статусы
    'inprogress': 'В работе',

    // Розовые статусы
    'review': 'На ревью',
    'inreview': 'На ревью',

    // Красные статусы
    'defect': 'Дефект',
    'blocked': 'Заблокировано',

    // Оранжевые статусы
    'readyfortest': 'Готово к тестированию',
    'readyfortesting': 'Готово к тестированию',
    'intesting': 'В тестировании',

    // Зеленые статусы
    'rc': 'RC',
    'closed': 'Закрыто',
  };

  return statusMap[status.toLowerCase()] || status;
}

/**
 * Переводит статус спринта на русский язык
 */
export function translateSprintStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'in_progress': 'В работе',
    'closed': 'Завершен',
    'draft': 'Черновик',
  };

  return statusMap[status] || status;
}
