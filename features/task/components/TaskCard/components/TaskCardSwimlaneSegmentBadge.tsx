'use client';

import { TextTooltip } from '@/components/TextTooltip';
import { useI18n } from '@/contexts/LanguageContext';

interface TaskCardSwimlaneSegmentBadgeProps {
  swimlaneSegmentBadge: { index: number; total: number };
}

export function TaskCardSwimlaneSegmentBadge({
  swimlaneSegmentBadge,
}: TaskCardSwimlaneSegmentBadgeProps) {
  const { t } = useI18n();
  return (
    <div
      className="pointer-events-none absolute z-10 -top-0.5 right-0.5"
    >
      <TextTooltip
        content={t('task.card.segmentTooltip', {
          index: swimlaneSegmentBadge.index,
          total: swimlaneSegmentBadge.total,
        })}
      >
        <span className="inline-flex shrink-0 cursor-default items-center rounded-md bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white ring-1 ring-inset ring-black/25 dark:bg-gray-800/90 dark:ring-white/20 pointer-events-auto">
          {swimlaneSegmentBadge.index}/{swimlaneSegmentBadge.total}
        </span>
      </TextTooltip>
    </div>
  );
}
