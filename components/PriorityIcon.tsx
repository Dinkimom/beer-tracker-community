'use client';

import { Icon } from './Icon';

interface PriorityIconProps {
  className?: string;
  priority?: string;
}

/**
 * Компонент для отображения иконки приоритета задачи
 */
export function PriorityIcon({ priority, className = '' }: PriorityIconProps) {
  if (!priority) return null;

  const normalizedPriority = priority.toLowerCase();

  // Маппинг приоритетов на иконки и цвета
  const getPriorityConfig = () => {
    // Blocker - красный восклицательный знак в кружке
    if (
      normalizedPriority === 'blocker' ||
      normalizedPriority === 'p1'
    ) {
      return {
        iconName: 'priority-blocker',
        color: 'text-red-600 dark:text-red-400',
        title: 'Blocker',
      };
    }

    // Critical - двойной chevron вверх
    if (
      normalizedPriority === 'critical' ||
      normalizedPriority === 'urgent' ||
      normalizedPriority === 'high' ||
      normalizedPriority === 'major' ||
      normalizedPriority === 'p2'
    ) {
      return {
        iconName: 'priority-critical',
        color: 'text-orange-600 dark:text-orange-400',
        title: 'Critical',
      };
    }

    // Medium / Normal - две горизонтальные линии
    if (
      normalizedPriority === 'medium' ||
      normalizedPriority === 'normal' ||
      normalizedPriority === 'p3' ||
      normalizedPriority === 'не указан'
    ) {
      return {
        iconName: 'priority-medium',
        color: 'text-gray-600 dark:text-gray-300',
        title: 'Medium',
      };
    }

    // Low / Minor - одинарный chevron вниз
    if (
      normalizedPriority === 'low' ||
      normalizedPriority === 'minor' ||
      normalizedPriority === 'p4'
    ) {
      return {
        iconName: 'priority-low',
        color: 'text-gray-500 dark:text-gray-400',
        title: 'Low',
      };
    }

    // Trivial - двойной chevron вниз
    if (normalizedPriority === 'trivial' || normalizedPriority === 'p5') {
      return {
        iconName: 'priority-trivial',
        color: 'text-gray-500 dark:text-gray-400',
        title: 'Trivial',
      };
    }

    // По умолчанию (если приоритет не распознан)
    return {
      iconName: 'priority-medium',
      color: 'text-gray-500 dark:text-gray-400',
      title: priority,
    };
  };

  const config = getPriorityConfig();

  // Определяем размер иконки из className
  const isCompact = className.includes('w-3') || className.includes('h-3');
  const isNarrow = className.includes('w-4') || className.includes('h-4');

  // Увеличиваем размер иконки для лучшей видимости
  const iconSize = isCompact ? 'w-4 h-4' : isNarrow ? 'w-5 h-5' : 'w-5 h-5';

  return (
    <span
      aria-label={`Приоритет: ${config.title}`}
      className={`inline-flex items-center justify-center ${config.color} ${className}`}
      title={config.title}
    >
      <Icon
        className={iconSize}
        name={config.iconName}
      />
    </span>
  );
}

