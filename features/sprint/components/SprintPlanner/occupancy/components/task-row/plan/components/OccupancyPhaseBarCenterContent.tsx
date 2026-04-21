import type { OccupancyPhaseBarProps } from '../occupancyPhaseBar.types';

import { Avatar } from '@/components/Avatar';

import { PhaseBarTaskLink } from './PhaseBarTaskLink';

type Position = OccupancyPhaseBarProps['position'];

interface OccupancyPhaseBarCenterContentProps {
  avatarUrl?: string | null;
  badgeClass?: string;
  compactRowMode: boolean;
  forceReleaseStyle: boolean;
  initials: string;
  isNarrow: boolean;
  phaseDateRangeLabel?: string;
  phaseDurationLabel?: string;
  plannedInSprintVariant: boolean;
  position: Position;
  showToolsEmoji: boolean;
  teamPlanVariant: boolean;
}

export function OccupancyPhaseBarCenterContent({
  plannedInSprintVariant,
  position,
  forceReleaseStyle,
  phaseDateRangeLabel,
  phaseDurationLabel,
  teamPlanVariant,
  showToolsEmoji,
  avatarUrl,
  initials,
  badgeClass,
  compactRowMode,
  isNarrow,
}: OccupancyPhaseBarCenterContentProps) {
  if (plannedInSprintVariant && position.sourceTaskId) {
    return <PhaseBarTaskLink position={position} />;
  }
  if (plannedInSprintVariant) return null;
  if (forceReleaseStyle) {
    return (
      <span aria-hidden className="text-lg leading-none">
        🚀
      </span>
    );
  }
  if (phaseDateRangeLabel) {
    return (
      <span
        aria-hidden
        className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
      >
        {phaseDateRangeLabel}
      </span>
    );
  }
  if (phaseDurationLabel) {
    return (
      <span
        aria-hidden
        className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
      >
        {phaseDurationLabel}
      </span>
    );
  }
  if (teamPlanVariant || showToolsEmoji) {
    return (
      <span aria-hidden className="text-sm leading-none">
        🔧
      </span>
    );
  }

  let avatarSize: 'md' | 'sm' | 'xs' = 'md';
  if (compactRowMode) avatarSize = 'xs';
  else if (isNarrow) avatarSize = 'sm';

  return (
    <Avatar
      avatarUrl={avatarUrl ?? undefined}
      initials={initials}
      initialsClassName={
        badgeClass ??
        'bg-gray-500 dark:bg-gray-600 text-white border-gray-600 dark:border-gray-700'
      }
      size={avatarSize}
    />
  );
}
