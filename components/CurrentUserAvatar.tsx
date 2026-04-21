'use client';

import { Avatar } from '@/components/Avatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getInitials } from '@/utils/displayUtils';

/**
 * Аватар текущего пользователя (данные из Tracker GET /myself).
 * Показывается в шапке справа. Пока данных нет — плейсхолдер того же размера, что и `Avatar` lg (без скачка вёрстки).
 */
export function CurrentUserAvatar() {
  const { data: user, isError } = useCurrentUser();

  if (isError) {
    return null;
  }

  if (!user) {
    return (
      <span
        aria-hidden
        className="inline-block h-8 w-8 shrink-0 animate-pulse rounded-full border border-gray-400/40 bg-gray-200 dark:border-white/30 dark:bg-gray-600"
      />
    );
  }

  const avatarUrl = user.avatarUrl ?? null;
  const initials = getInitials(user.display);

  return (
    <Avatar
      avatarUrl={avatarUrl}
      initials={initials}
      initialsVariant="default"
      size="lg"
      title={user.display}
    />
  );
}
