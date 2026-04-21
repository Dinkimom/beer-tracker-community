'use client';

import type { Developer } from '@/types';

import { TEAM_TAG_BG, TEAM_TAG_BORDER } from '@/utils/teamColors';

const SIZE_CLASSES = {
  /** 22px — иконка комментария на таймлайне занятости */
  xs: 'w-[22px] h-[22px] text-[10px]',
  /** 24px — узкая фаза в плане занятости */
  sm: 'w-6 h-6 text-[9px]',
  /** 28px — пикер исполнителя, фаза в плане занятости */
  md: 'w-7 h-7 text-xs',
  /** 32px — заголовок разработчика, тултипы */
  lg: 'w-8 h-8 text-xs',
} as const;

/** Единый бордер для фото и инициалов (совпадает с baseImageClasses) */
const AVATAR_BORDER = 'border border-gray-400 dark:border-white';

const teamVariant = (team: string) =>
  `${TEAM_TAG_BG[team]} text-white border ${TEAM_TAG_BORDER[team]}`;

const INITIALS_VARIANT_CLASSES = {
  /** Серый фон (списки, заголовки разработчиков, тултипы переходов) */
  default: `bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 ${AVATAR_BORDER}`,
  /** Синий градиент (комментарии, автор) */
  primary: `bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 text-white ${AVATAR_BORDER} font-bold`,
  /** Цвета команд из teamColors.ts */
  qa: teamVariant('QA'),
  back: teamVariant('Back'),
  web: teamVariant('Web'),
  devops: teamVariant('DevOps'),
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;
export type AvatarInitialsVariant = keyof typeof INITIALS_VARIANT_CLASSES;

/** Возвращает вариант аватара по данным разработчика */
export function getAvatarVariantForDeveloper(dev: Pick<Developer, 'platforms' | 'role'>): AvatarInitialsVariant {
  if (dev.role === 'tester') return 'qa';
  if (dev.platforms?.includes('back')) return 'back';
  if (dev.platforms?.includes('web')) return 'web';
  return 'default';
}

const TEAM_TO_VARIANT: Record<string, AvatarInitialsVariant> = {
  QA: 'qa',
  Back: 'back',
  Web: 'web',
  DevOps: 'devops',
};

/**
 * Возвращает вариант аватара по команде задачи — используется как запасной вариант,
 * когда конкретный исполнитель неизвестен.
 */
export function getAvatarVariantForTeam(team: string | null | undefined): AvatarInitialsVariant {
  return TEAM_TO_VARIANT[team ?? ''] ?? 'default';
}

export interface AvatarProps {
  /** URL фото; при отсутствии показываются инициалы */
  avatarUrl?: string | null;
  className?: string;
  /** Инициалы (1–2 символа), используются при отсутствии avatarUrl */
  initials: string;
  /** Доп. классы для контейнера инициалов (например, badge из getTeamTagClasses) */
  initialsClassName?: string;
  /** Вариант фона для инициалов (игнорируется при наличии avatarUrl) */
  initialsVariant?: AvatarInitialsVariant;
  size?: AvatarSize;
  style?: React.CSSProperties;
  title?: string;
}

export function Avatar({
  avatarUrl,
  initials,
  size = 'lg',
  initialsVariant = 'default',
  initialsClassName,
  className = '',
  style,
  title,
}: AvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];
  const baseImageClasses = `rounded-full object-cover shrink-0 ${AVATAR_BORDER}`;
  const baseInitialsClasses =
    'rounded-full shrink-0 flex items-center justify-center font-semibold';

  if (avatarUrl) {
    return (
      <img
        alt=""
        className={`${baseImageClasses} ${sizeClasses} ${className}`.trim()}
        src={avatarUrl}
        style={style}
        title={title}
      />
    );
  }

  const variantClasses = initialsClassName ?? INITIALS_VARIANT_CLASSES[initialsVariant];
  return (
    <span
      className={`${baseInitialsClasses} ${sizeClasses} ${variantClasses} ${className}`.trim()}
      style={style}
      title={title}
    >
      {initials}
    </span>
  );
}
