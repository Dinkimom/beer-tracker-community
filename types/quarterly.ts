/**
 * Типы данных для квартального планирования
 */

/**
 * Квартал года (1-4)
 */
export type Quarter = 1 | 2 | 3 | 4;

/**
 * Тип фазы разработки
 */
export type PhaseType = 'development' | 'discovery' | 'release' | 'testing';

/**
 * Фаза задачи в квартальном плане
 */
export interface TaskPhase {
  /** Исполнитель (ID участника команды) */
  assignee?: string;
  /** Имя исполнителя */
  assigneeName?: string;
  /** Дата окончания */
  endDate: string;
  /** Часть дня окончания (0=утро, 1=день, 2=вечер) */
  endPart?: number;
  /** ID фазы */
  id: string;
  /** ID спринта (если планирование по спринтам) */
  sprintId?: string;
  /** Название спринта */
  sprintName?: string;
  /** Дата начала */
  startDate: string;
  /** Часть дня начала (0=утро, 1=день, 2=вечер) */
  startPart?: number;
  /** Тип фазы */
  type: PhaseType;
}

/**
 * Тип элемента плана
 */
export type PlannedItemType = 'draft' | 'epic' | 'story' | 'task';

/**
 * Запланированный элемент (эпик/стори/задача/драфт)
 */
export interface PlannedItem {
  /** Исполнитель */
  assignee?: string;
  /** Имя исполнителя */
  assigneeName?: string;
  /** Дочерние элементы (заполняется на клиенте) */
  children?: PlannedItem[];
  /** Дата создания */
  createdAt: string;
  /** Описание */
  description?: string;
  /** Функциональная команда (для определения платформы) */
  functionalTeam?: string;
  /** Уровень иерархии: 0=epic, 1=story, 2=task */
  hierarchyLevel: number;
  /** Уникальный ID в плане */
  id: string;
  /** Свернут ли элемент (только для UI) */
  isCollapsed?: boolean;
  /** Порядок отображения */
  order: number;
  /** Статус из трекера */
  originalStatus?: string;
  /** Иерархия */
  /** ID родителя (для task -> story, для story -> epic) */
  parentId?: string;
  /** Фазы разработки */
  phases: TaskPhase[];
  /** Квартал (1-4) (для группировки) */
  quarter?: Quarter;
  /** Год квартала (для группировки) */
  quarterYear?: number;
  /** ID источника из трекера (если не драфт) */
  sourceId?: string;
  /** Ключ задачи из трекера (NW-1234) */
  sourceKey?: string;
  /** Story Points */
  storyPoints?: number;
  /** Теги/платформы */
  tags?: string[];
  /** Test Points */
  testPoints?: number;
  /** Название */
  title: string;
  /** Спринты из трекера (для отображения тега спринта в карточке) */
  trackerSprints?: Array<{ display: string; id: string }>;
  /** Тип задачи из трекера */
  trackerType?: string;
  /** Тип элемента */
  type: PlannedItemType;
  /** Дата обновления */
  updatedAt: string;
}

/**
 * Драфт задачи (еще не создана в трекере)
 */
export interface DraftTask {
  /** ID доски */
  boardId: number;
  /** Дочерние драфты (заполняется на клиенте) */
  children?: DraftTask[];
  /** Дата создания */
  createdAt: string;
  /** Описание */
  description?: string;
  /** ID эпика, к которому относится */
  epicId?: string;
  /** Ключ эпика */
  epicKey?: string;
  /** Уровень иерархии: 0=epic, 1=story, 2=task */
  hierarchyLevel: number;
  /** Уникальный ID драфта */
  id: string;
  /** Иерархия для драфтов */
  /** ID родительского драфта */
  parentId?: string;
  /** Story Points */
  storyPoints?: number;
  /** Теги/платформы */
  tags?: string[];
  /** Test Points */
  testPoints?: number;
  /** Название */
  title: string;
  /** Тип драфта */
  type: PlannedItemType;
  /** Дата обновления */
  updatedAt: string;
}

/**
 * Тип техспринта
 */
export type TechSprintType = 'back' | 'qa' | 'web';

/**
 * Запись о техспринте (отправка человека в техническую команду)
 */
export interface TechSprintEntry {
  /** Дата окончания */
  endDate: string;
  /** ID записи */
  id: string;
  /** ID участника команды */
  memberId: string;
  /** Имя участника */
  memberName: string;
  /** Дата начала */
  startDate: string;
  /** Тип техспринта */
  type: TechSprintType;
}

/**
 * Запись об отпуске
 */
export interface VacationEntry {
  /** Дата окончания */
  endDate: string;
  /** ID записи */
  id: string;
  /** ID участника команды */
  memberId: string;
  /** Имя участника */
  memberName: string;
  /** Дата начала */
  startDate: string;
}

/**
 * Тип события доступности на доске (свимлейн / занятость).
 */
export type BoardAvailabilityEventType = 'duty' | 'sick_leave' | 'tech_sprint' | 'vacation';

/**
 * Событие доступности участника доски (не привязано к квартальному плану).
 */
export interface BoardAvailabilityEvent {
  /** Дата окончания */
  endDate: string;
  /** Тип события */
  eventType: BoardAvailabilityEventType;
  /** ID записи */
  id: string;
  /** ID участника команды */
  memberId: string;
  /** Имя участника */
  memberName: string;
  /** Дата начала */
  startDate: string;
  /** Платформа техспринта — только для {@link eventType} === `tech_sprint` */
  techSprintSubtype?: TechSprintType;
}

/**
 * Данные о техспринтах и отпусках для квартала
 */
export interface QuarterlyAvailability {
  /** События доски (приоритетный источник для свимлейна, если переданы) */
  boardEvents?: BoardAvailabilityEvent[];
  /** ID плана */
  planId: string;
  /** Техспринты */
  techSprints: TechSprintEntry[];
  /** Отпуска */
  vacations: VacationEntry[];
}
