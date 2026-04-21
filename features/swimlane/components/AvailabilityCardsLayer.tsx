'use client';

import type { TechSprintEntry, VacationEntry } from '@/types/quarterly';

import { getSegmentsForDeveloper } from '@/features/swimlane/utils/availabilitySegments';
import { getLeftPercent, getWidthPercent } from '@/features/swimlane/utils/positionUtils';

import { AvailabilityCard } from './AvailabilityCard';

export interface AvailabilityCardsLayerProps {
  developerId: string;
  /** Ширина колонки исполнителей — текст карточки прилипает справа от неё */
  participantsColumnWidth: number;
  sprintStartDate: Date;
  techSprints: TechSprintEntry[];
  totalHeight: number;
  vacations: VacationEntry[];
}

export function AvailabilityCardsLayer({
  developerId,
  participantsColumnWidth,
  sprintStartDate,
  totalHeight,
  vacations,
  techSprints,
}: AvailabilityCardsLayerProps) {
  const segments = getSegmentsForDeveloper(developerId, sprintStartDate, vacations, techSprints);
  if (segments.length === 0) return null;

  return (
    <div aria-hidden className="relative w-full pointer-events-none" style={{ height: totalHeight }}>
      {segments.map((seg, index) => {
        const leftPercent = getLeftPercent({
          taskId: `availability-${index}`,
          assignee: developerId,
          startDay: seg.startDay,
          startPart: 0,
          duration: seg.durationInParts,
        });
        const widthPercent = getWidthPercent(seg.durationInParts);
        return (
          <AvailabilityCard
            key={`${seg.kind}-${seg.startDay}-${index}`}
            dateRangeLabel={seg.dateRangeLabel}
            kind={seg.kind}
            leftPercent={leftPercent}
            participantsColumnWidth={participantsColumnWidth}
            totalHeight={totalHeight}
            widthPercent={widthPercent}
          />
        );
      })}
    </div>
  );
}
