import { WORKING_DAYS } from '@/constants';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Рабочий день: 9 часов (9:00–18:00), пн–пт */
const WORKDAY_START_MS = 9 * MS_PER_HOUR;
const WORKDAY_END_MS = 18 * MS_PER_HOUR;

function isWeekendDate(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Проверяет, является ли дата выходным днем (суббота или воскресенье)
 */
export function isWeekend(date: Date): boolean {
  return isWeekendDate(date);
}

/**
 * Получает конец рабочего дня пятницы (18:00) для данной даты
 * Если дата уже в пятницу, возвращает 18:00 этого дня
 * Если дата в субботу или воскресенье, возвращает 18:00 предыдущей пятницы
 */
export function getFridayEndOfDay(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();

  // Если это пятница (5), устанавливаем 18:00 этого дня
  if (dayOfWeek === 5) {
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Если это суббота (6), откатываемся на 1 день назад (пятница)
  if (dayOfWeek === 6) {
    d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Если это воскресенье (0), откатываемся на 2 дня назад (пятница)
  if (dayOfWeek === 0) {
    d.setDate(d.getDate() - 2);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Если это рабочий день, возвращаем как есть (но это не должно использоваться)
  return d;
}

/**
 * Проверяет, полностью ли период находится в выходные дни
 * (и начало, и конец в выходные дни)
 */
export function isFullyOnWeekend(startDate: Date, endDate: Date): boolean {
  return isWeekendDate(startDate) && isWeekendDate(endDate);
}

/**
 * Эффективное начало таймлайна от даты создания задачи.
 * - Выходные → 9:00 понедельника (следующий рабочий день)
 * - После 18:00 рабочего дня → 9:00 следующего дня
 * - Иначе → дата создания как есть
 */
export function getEffectiveTimelineStartFromCreation(createdAt: Date): Date {
  const d = new Date(createdAt);
  const dayOfWeek = d.getDay();
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  const workdayEndMinutes = 18 * 60;

  if (dayOfWeek === 6) {
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (dayOfWeek === 0) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (totalMinutes >= workdayEndMinutes) {
    if (dayOfWeek === 5) {
      d.setDate(d.getDate() + 3);
    } else {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(9, 0, 0, 0);
    return d;
  }
  return d;
}

/**
 * Получает следующий рабочий день после данной даты
 * Если дата в выходной - возвращает следующий понедельник 9:00
 * Если дата в рабочий день, но после 17:00 - возвращает следующий рабочий день 9:00
 * Если дата в рабочий день до 17:00 - возвращает эту дату с началом рабочего дня (9:00)
 */
export function getNextWorkingDay(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const workdayEndMinutes = 18 * 60; // 18:00

  // Если это выходной (суббота или воскресенье)
  if (dayOfWeek === 6) {
    // Суббота - следующий рабочий день понедельник (+2 дня)
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (dayOfWeek === 0) {
    // Воскресенье - следующий рабочий день понедельник (+1 день)
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // Если это рабочий день после 17:00, следующий рабочий день
  if (totalMinutes >= workdayEndMinutes) {
    if (dayOfWeek === 5) {
      // Пятница после 17:00 - следующий рабочий день понедельник (+3 дня)
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d;
    } else {
      // Другой рабочий день после 17:00 - следующий день (+1 день)
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  }

  // Если это рабочий день до 17:00, возвращаем эту дату с началом рабочего дня
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Вычисляет рабочее время в миллисекундах между двумя моментами.
 * Учитываются только пн–пт и часы 9:00–18:00 (9 часов в день, по локальному времени).
 */
export function getWorkingHoursBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;

  let total = 0;
  const start = new Date(startMs);
  const end = new Date(endMs);

  const startDateOnly = new Date(start);
  startDateOnly.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(end);
  endDateOnly.setHours(0, 0, 0, 0);

  const current = new Date(startDateOnly);

  while (current.getTime() <= endDateOnly.getTime()) {
    if (isWeekendDate(current)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const dayStartMs = current.getTime() + WORKDAY_START_MS;
    const dayEndMs = current.getTime() + WORKDAY_END_MS;

    const effectiveStart = Math.max(startMs, dayStartMs);
    const effectiveEnd = Math.min(endMs, dayEndMs);

    if (effectiveEnd > effectiveStart) {
      total += effectiveEnd - effectiveStart;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
}


/**
 * Находит индекс понедельника для следующей недели, если сегодня выходной
 * Возвращает null, если сегодня не выходной или не в спринте
 */
/**
 * Вычисляет календарную дату для dayIndex в мультиспринтовой сетке.
 * Каждый спринт = 10 рабочих дней = 2 недели = 14 календарных дней.
 * dayIndex 0-4: неделя 1 спринта 0; 5-9: неделя 2; 10-14: неделя 1 спринта 1; и т.д.
 */
export function getDateForDayIndex(sprintStartDate: Date, dayIndex: number): Date {
  const sprintIdx = Math.floor(dayIndex / 10);
  const dayInSprint = dayIndex % 10;
  const sprintCalendarOffset = sprintIdx * 14; // каждый спринт = 14 к.д.

  const dayDate = new Date(sprintStartDate);
  if (dayInSprint < 5) {
    dayDate.setDate(dayDate.getDate() + sprintCalendarOffset + dayInSprint);
  } else {
    // Вторая неделя: +5 к.д. недели 1 + 2 выходных + оставшиеся дни
    dayDate.setDate(dayDate.getDate() + sprintCalendarOffset + 5 + 2 + (dayInSprint - 5));
  }
  dayDate.setHours(0, 0, 0, 0);
  return dayDate;
}

/**
 * Локальный календарный день «сегодня» совпадает с понедельником недели 1 спринта (dayIndex 0).
 * Нужен, чтобы после запуска спринта ещё разрешать правки целей в этот день.
 */
export function isTodaySprintFirstWeekMonday(
  sprintStartDateStr: string,
  now: Date = new Date()
): boolean {
  const part = sprintStartDateStr.split('T')[0];
  const seg = part.split('-').map(Number);
  if (seg.length !== 3 || seg.some((n) => Number.isNaN(n))) return false;
  const [y, m, d] = seg;
  const sprintStart = new Date(y, m - 1, d);
  sprintStart.setHours(0, 0, 0, 0);
  const firstWeekMonday = getDateForDayIndex(sprintStart, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (today.getDay() !== 1) return false;
  return today.getTime() === firstWeekMonday.getTime();
}

/**
 * Число пн–пт от start до end включительно (по календарным датам).
 */
export function countWorkingDaysInclusiveCalendarRange(start: Date, end: Date): number {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endOnly = new Date(end);
  endOnly.setHours(0, 0, 0, 0);
  if (endOnly < cur) return 0;
  let n = 0;
  while (cur.getTime() <= endOnly.getTime()) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/**
 * Длина таймлайна спринта в рабочих днях по датам из API; при отсутствии данных — fallback (10).
 */
export function resolveSprintTimelineWorkingDaysCount(
  startStr?: string | null,
  endStr?: string | null,
  fallback: number = WORKING_DAYS
): number {
  if (!startStr || !endStr) return fallback;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fallback;
  const n = countWorkingDaysInclusiveCalendarRange(start, end);
  return n > 0 ? n : fallback;
}

const MAX_WORKING_DAYS_FOR_WEEKEND_LOOKUP = 200;

function getMondayIndexForWeekend(
  sprintStartDate: Date,
  workingDaysCount: number = WORKING_DAYS
): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!isWeekend(today)) return null;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (today.getDay() === 6 ? 2 : 1));
  nextMonday.setHours(0, 0, 0, 0);

  const scan = Math.min(Math.max(1, workingDaysCount), MAX_WORKING_DAYS_FOR_WEEKEND_LOOKUP);
  const days = getWorkingDaysRange(sprintStartDate, scan);
  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i]!);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === nextMonday.getTime()) return i;
  }

  return null;
}

/**
 * Получает статус дня относительно текущей даты
 * @param workingDaysCount — число рабочих колонок таймлайна (по длительности спринта или нескольких спринтов)
 */
export function getDayStatus(
  dayIndex: number,
  sprintStartDate?: Date,
  workingDaysCount: number = WORKING_DAYS
): SprintStatus | 'today' {
  if (!sprintStartDate) return 'future';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mondayIndex = getMondayIndexForWeekend(sprintStartDate, workingDaysCount);
  if (mondayIndex !== null && dayIndex === mondayIndex) {
    return 'today';
  }

  const count = Math.max(1, workingDaysCount);
  const range = getWorkingDaysRange(sprintStartDate, count);
  const dayDate = range[dayIndex] ?? range[range.length - 1];
  if (!dayDate) return 'future';

  const diffTime = dayDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'past';
  if (diffDays === 0) return 'today';
  return 'future';
}

/**
 * Вычисляет дату начала спринта (понедельник текущей недели)
 */
export function getSprintStartDate(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  // Находим понедельник текущей недели
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Возвращает массив из 10 рабочих дней спринта (пн–пт, пн–пт)
 */
export function getSprintWorkingDays(sprintStartDate: Date): Date[] {
  const days: Date[] = [];
  for (let dayIndex = 0; dayIndex < 10; dayIndex++) {
    const d = new Date(sprintStartDate);
    if (dayIndex < 5) {
      d.setDate(sprintStartDate.getDate() + dayIndex);
    } else {
      d.setDate(sprintStartDate.getDate() + 5 + 2 + (dayIndex - 5));
    }
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

/**
 * Возвращает массив из count рабочих дней (пн–пт), начиная с startDate.
 * Для мультиспринта: один диапазон для одного запроса isdayoff.
 */
export function getWorkingDaysRange(startDate: Date, count: number): Date[] {
  const days: Date[] = [];
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < count) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      days.push(new Date(d));
      added++;
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Получает статус сегмента времени в текущем дне
 * @param dayIndex - индекс дня в спринте
 * @param partIndex - индекс части дня (0, 1, 2)
 * @param sprintStartDate - дата начала спринта
 * @param partsPerDay - количество частей в дне (по умолчанию 3)
 */
import type { SprintStatus } from '@/types';

export function getPartStatus(
  dayIndex: number,
  partIndex: number,
  sprintStartDate: Date,
  workingDaysCount: number = WORKING_DAYS
): SprintStatus {
  const status = getDayStatus(dayIndex, sprintStartDate, workingDaysCount);

  // Если не сегодня, возвращаем базовый статус
  if (status === 'past') return 'past';
  if (status === 'future') return 'future';

  // Если сегодня выходной, показываем первую часть понедельника как current
  const mondayIndex = getMondayIndexForWeekend(sprintStartDate, workingDaysCount);
  if (mondayIndex !== null && dayIndex === mondayIndex) {
    // Если это первая часть (утро понедельника), показываем как current
    if (partIndex === 0) {
      return 'current';
    }
    // Остальные части понедельника - future
    return 'future';
  }

  // Для текущего рабочего дня определяем текущую часть
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // День делится на три трети:
  // Первая часть (0): 00:00 - 12:00
  // Вторая часть (1): 12:01 - 15:00
  // Третья часть (2): 15:01 - 23:59
  let currentPart: number;
  if (hours < 12 || (hours === 12 && minutes === 0)) {
    currentPart = 0;
  } else if (hours < 15 || (hours === 15 && minutes === 0)) {
    currentPart = 1;
  } else {
    currentPart = 2;
  }

  if (partIndex < currentPart) return 'past';
  if (partIndex === currentPart) return 'current';
  return 'future';
}

/**
 * Вычисляет текущую позицию в спринте (в ячейках)
 * @param sprintStartDate - дата начала спринта
 * @param partsPerDay - количество частей в дне
 */
export function getCurrentSprintCell(
  sprintStartDate: Date,
  partsPerDay: number = 3,
  workingDaysCount: number = WORKING_DAYS
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mondayIndex = getMondayIndexForWeekend(sprintStartDate, workingDaysCount);
  if (mondayIndex !== null) {
    return mondayIndex * partsPerDay;
  }

  const count = Math.max(1, workingDaysCount);
  const range = getWorkingDaysRange(sprintStartDate, count);
  let workingDayIndex = -1;
  for (let i = 0; i < range.length; i++) {
    const dayDate = new Date(range[i]!);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate.getTime() === today.getTime()) {
      workingDayIndex = i;
      break;
    }
  }

  if (workingDayIndex >= 0 && workingDayIndex < count) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Определяем текущую часть дня
    // День делится на три трети:
    // Первая часть (0): 00:00 - 12:00
    // Вторая часть (1): 12:01 - 15:00
    // Третья часть (2): 15:01 - 23:59
    let currentPart: number;
    if (hours < 12 || (hours === 12 && minutes === 0)) {
      currentPart = 0;
    } else if (hours < 15 || (hours === 15 && minutes === 0)) {
      currentPart = 1;
    } else {
      currentPart = 2;
    }

    return workingDayIndex * partsPerDay + currentPart;
  }

  // Если спринт еще не начался
  const firstDay = new Date(sprintStartDate);
  firstDay.setHours(0, 0, 0, 0);
  if (today.getTime() < firstDay.getTime()) return 0;

  return count * partsPerDay;
}
