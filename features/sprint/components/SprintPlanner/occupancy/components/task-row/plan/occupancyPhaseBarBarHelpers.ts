import type { CSSProperties } from 'react';

export function resolvePhaseBarPointerEvents(
  dimPeersByContextMenu: boolean,
  pointerEventsNone: boolean
): 'auto' | 'none' {
  if (dimPeersByContextMenu) return 'none';
  if (pointerEventsNone) return 'none';
  return 'auto';
}

export function resolvePhaseBarStripeOverlayStyle(
  backgroundDimmed: boolean,
  isQa: boolean,
  showExtraPlanDuration: boolean,
  qaStripedStyle: CSSProperties | undefined
): CSSProperties | undefined {
  if (backgroundDimmed) return undefined;
  if (isQa && showExtraPlanDuration) return undefined;
  return qaStripedStyle;
}

export function buildOccupancyPhaseBarSurfaceClass(
  isInHoveredConnectionGroup: boolean,
  backgroundDimmed: boolean,
  phaseBorderOnlyClass: string,
  phaseColorClass: string,
  linkRingClass: string,
  contextMenuBorderClass: string,
  disableDragAndResize: boolean,
  isLinkTarget: boolean
): string {
  const shadowPart = isInHoveredConnectionGroup ? 'shadow-sm' : '';
  const surfacePart = backgroundDimmed
    ? `bg-transparent ${phaseBorderOnlyClass}`
    : phaseColorClass;
  const cursorPart =
    disableDragAndResize || isLinkTarget
      ? 'cursor-pointer'
      : 'cursor-grab active:cursor-grabbing';

  return [
    'task-bar-opacity-layer absolute flex items-center justify-center rounded-lg overflow-visible p-1 group/phase dark:shadow-sm hover:shadow-sm',
    shadowPart,
    surfacePart,
    linkRingClass,
    contextMenuBorderClass,
    cursorPart,
  ]
    .filter(Boolean)
    .join(' ');
}
