export function usePhaseBarOpacity({
  hoveredErrorTaskId,
  isOverlapping,
  isDimmedByLinkHover,
  isGrabbedForDrag,
  isDragging,
  isResizing,
  isBlurredBySiblingDrag,
}: {
  hoveredErrorTaskId?: string | null;
  isOverlapping?: boolean;
  isDimmedByLinkHover?: boolean;
  isGrabbedForDrag?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  isBlurredBySiblingDrag?: boolean;
}) {
  const baseOpacity =
    hoveredErrorTaskId && isOverlapping ? 1 : hoveredErrorTaskId ? 0.3 : 1;
  let opacity = baseOpacity;
  if (isDimmedByLinkHover) opacity *= 0.5;
  const backgroundDimmed =
    !!isGrabbedForDrag ||
    !!isDragging ||
    !!isResizing ||
    !!isBlurredBySiblingDrag;

  return { opacity, backgroundDimmed };
}
