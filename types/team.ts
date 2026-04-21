/**
 * Типы данных команд и участников команды (хранятся в PostgreSQL приложения)
 */

/**
 * Команда из таблицы teams
 */
export interface AppTeam {
  active: boolean;
  board: number;
  queue: string;
  slug: string;
  title: string;
  uid: string;
}

/**
 * Расширенная информация о сотруднике с командой и ролью
 */
export interface TeamMember {
  active: boolean;
  /** URL фото профиля (из Tracker API) */
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  login: string;
  middleName?: string | null;
  role?: {
    uid: string;
    slug: string;
    title: string;
  };
  team: {
    uid: string;
    slug: string;
    title: string;
    queue: string;
    board: number;
  };
  tracker_uid: string | null;
  uid: string;
}
