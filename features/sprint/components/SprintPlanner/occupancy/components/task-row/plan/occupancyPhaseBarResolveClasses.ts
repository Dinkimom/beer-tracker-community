import type { StatusColorGroup } from '@/utils/statusColors';
import type { CSSProperties } from 'react';

export interface PhaseBarClassContext {
  barColors: StatusColorGroup | null;
  closedGreenColors: StatusColorGroup;
  devBlueColors: StatusColorGroup;
  forceDevColor: boolean;
  forceReleaseStyle: boolean;
  plannedInSprintVariant: boolean;
  qaStripedStyle: CSSProperties | undefined;
  teamBorder: string;
  teamColor: string;
  teamPlanVariant: boolean;
}

export function resolvePhaseColorClass(ctx: PhaseBarClassContext): string {
  const {
    barColors,
    closedGreenColors,
    devBlueColors,
    forceDevColor,
    forceReleaseStyle,
    qaStripedStyle,
    teamBorder,
    teamColor,
    teamPlanVariant,
  } = ctx;

  if (barColors) {
    return `border-2 ${barColors.bg} ${barColors.border} ${barColors.bgDark ?? ''} ${barColors.borderDark ?? ''}`.trim();
  }
  if (forceReleaseStyle) {
    return `border-2 ${closedGreenColors.bg} ${closedGreenColors.border} ${closedGreenColors.bgDark ?? ''} ${closedGreenColors.borderDark ?? ''}`.trim();
  }
  if (teamPlanVariant) {
    return 'border-2 border-dashed border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600';
  }
  if (forceDevColor) {
    return `border-2 ${devBlueColors.bg} ${devBlueColors.border} ${devBlueColors.bgDark ?? ''} ${devBlueColors.borderDark ?? ''}`.trim();
  }
  if (qaStripedStyle) {
    return `border-2 ${teamBorder}`.trim();
  }
  return `border-2 ${teamColor} ${teamBorder}`.trim();
}

export function resolvePhaseBorderOnlyClass(ctx: PhaseBarClassContext): string {
  const {
    barColors,
    closedGreenColors,
    devBlueColors,
    forceDevColor,
    forceReleaseStyle,
    teamBorder,
    teamPlanVariant,
  } = ctx;

  if (teamPlanVariant) {
    return 'border-2 border-dashed border-gray-400 dark:border-gray-500';
  }
  if (barColors) {
    return `border-2 ${barColors.border} ${barColors.borderDark ?? ''}`.trim();
  }
  if (forceReleaseStyle) {
    return `border-2 ${closedGreenColors.border} ${closedGreenColors.borderDark ?? ''}`.trim();
  }
  if (forceDevColor) {
    return `border-2 ${devBlueColors.border} ${devBlueColors.borderDark ?? ''}`.trim();
  }
  return `border-2 ${teamBorder}`.trim();
}

export function resolvePhaseFillClass(ctx: PhaseBarClassContext): string {
  const {
    barColors,
    closedGreenColors,
    devBlueColors,
    forceDevColor,
    forceReleaseStyle,
    qaStripedStyle,
    teamColor,
    teamPlanVariant,
  } = ctx;

  if (barColors) {
    return `${barColors.bg} ${barColors.bgDark ?? ''}`.trim();
  }
  if (forceReleaseStyle) {
    return `${closedGreenColors.bg} ${closedGreenColors.bgDark ?? ''}`.trim();
  }
  if (teamPlanVariant) {
    return 'bg-gray-200 dark:bg-gray-600';
  }
  if (forceDevColor) {
    return `${devBlueColors.bg} ${devBlueColors.bgDark ?? ''}`.trim();
  }
  if (qaStripedStyle) {
    return '';
  }
  return teamColor;
}
