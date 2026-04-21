import type { OccupancyPhaseBarProps } from '../occupancyPhaseBar.types';
import type { CSSProperties } from 'react';

import { Icon } from '@/components/Icon';
import { TextTooltip } from '@/components/TextTooltip';

import { OccupancyPhaseBarCenterContent } from './OccupancyPhaseBarCenterContent';
import { OccupancyPhaseBarDimmedBackground } from './OccupancyPhaseBarDimmedBackground';
import { OccupancyResizeHandle } from './OccupancyResizeHandle';

type Position = OccupancyPhaseBarProps['position'];

interface OccupancyPhaseBarBarContentsProps {
  assigneeDisplayName?: string | null;
  avatarUrl?: string | null;
  backgroundDimmed: boolean;
  badgeClass?: string;
  compactRowMode: boolean;
  disableDragAndResize: boolean;
  dividerBgClass: string;
  errorTooltip?: string;
  estimatedPercent: number;
  extraPercent: number;
  extraSP: number;
  forceReleaseStyle: boolean;
  handleColors: {
    bg: string;
    bgDark: string;
    line: string;
    lineDark: string;
  };
  hideResizeHandles?: boolean;
  hoverLeft: boolean;
  hoverRight: boolean;
  initials: string;
  isInError?: boolean;
  isNarrow: boolean;
  isQa: boolean;
  phaseDateRangeLabel?: string;
  phaseDurationLabel?: string;
  phaseFillClass: string;
  plannedInSprintVariant: boolean;
  pointerEventsNone?: boolean;
  position: Position;
  qaBaseColor?: string;
  qaStripedStyle?: CSSProperties;
  readonly: boolean;
  resizeSide: 'left' | 'right' | null;
  showEndAnchor: boolean;
  showExtraPlanDuration: boolean;
  showStartAnchor: boolean;
  showToolsEmoji: boolean;
  taskId: string;
  teamPlanVariant: boolean;
  handleResizeStart: (e: React.MouseEvent, side: 'left' | 'right') => void;
  setHoverLeft: (v: boolean) => void;
  setHoverRight: (v: boolean) => void;
}

export function OccupancyPhaseBarBarContents(props: OccupancyPhaseBarBarContentsProps) {
  const {
    backgroundDimmed,
    compactRowMode,
    disableDragAndResize,
    hideResizeHandles,
    dividerBgClass,
    estimatedPercent,
    extraPercent,
    extraSP,
    handleColors,
    handleResizeStart,
    hoverLeft,
    hoverRight,
    isInError,
    isQa,
    phaseFillClass,
    pointerEventsNone,
    readonly,
    resizeSide,
    taskId,
    showEndAnchor,
    showExtraPlanDuration,
    showStartAnchor,
    showToolsEmoji,
    errorTooltip,
    setHoverLeft,
    setHoverRight,
    qaStripedStyle,
    qaBaseColor,
  } = props;

  return (
    <>
      {backgroundDimmed && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-lg pointer-events-none opacity-50"
        >
          <OccupancyPhaseBarDimmedBackground
            estimatedPercent={estimatedPercent}
            extraPercent={extraPercent}
            isQa={isQa}
            phaseFillClass={phaseFillClass}
            qaBaseColor={qaBaseColor}
            qaStripedStyle={qaStripedStyle}
            showExtraPlanDuration={showExtraPlanDuration}
          />
          {showExtraPlanDuration && (
            <div
              className="absolute right-0 top-0 bottom-0 rounded-r-lg bg-white/40 dark:bg-black/25"
              style={{ width: `${extraPercent}%` }}
            />
          )}
        </div>
      )}
      {showExtraPlanDuration && !backgroundDimmed && (
        <>
          {isQa && qaStripedStyle && qaBaseColor && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 rounded-l-lg pointer-events-none"
                style={{ width: `${estimatedPercent}%`, ...qaStripedStyle }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 rounded-r-lg pointer-events-none"
                style={{
                  width: `${extraPercent}%`,
                  backgroundColor: qaBaseColor,
                }}
              />
            </>
          )}
          <div
            className="absolute right-0 top-0 bottom-0 rounded-r-lg pointer-events-none bg-white/40 dark:bg-black/25"
            style={{ width: `${extraPercent}%` }}
          />
        </>
      )}
      {showExtraPlanDuration && (
        <>
          <div
            className={`absolute top-0 bottom-0 w-0.5 pointer-events-none ${dividerBgClass}`}
            style={{ left: `${estimatedPercent}%` }}
          />
          {extraSP > 0 && (
            <span
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-xs font-semibold whitespace-nowrap text-gray-800 dark:text-white/95"
              style={{
                left: `${estimatedPercent}%`,
                width: `${extraPercent}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +{extraSP} {isQa ? 'tp' : 'sp'}
            </span>
          )}
        </>
      )}
      {!disableDragAndResize && !readonly && !hideResizeHandles && (
        <OccupancyResizeHandle
          compact={compactRowMode}
          handleColors={handleColors}
          isActive={resizeSide === 'left'}
          isHovering={hoverLeft}
          side="left"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleResizeStart(e, 'left');
          }}
          onMouseEnter={() => setHoverLeft(true)}
          onMouseLeave={() => setHoverLeft(false)}
        />
      )}
      {!disableDragAndResize && !readonly && !hideResizeHandles && (
        <OccupancyResizeHandle
          compact={compactRowMode}
          handleColors={handleColors}
          isActive={resizeSide === 'right'}
          isHovering={hoverRight}
          side="right"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleResizeStart(e, 'right');
          }}
          onMouseEnter={() => setHoverRight(true)}
          onMouseLeave={() => setHoverRight(false)}
        />
      )}
      {isInError && (
        <span
          className="absolute top-0 right-0 z-10"
          style={{ transform: 'translate(50%, -50%)' }}
        >
          <TextTooltip content={errorTooltip || 'Ошибка планирования'}>
            <span
              className={`inline-flex ${compactRowMode ? 'w-4 h-4' : 'w-5 h-5'} items-center justify-center rounded-full bg-red-500 dark:bg-red-400 text-white border-2 border-white dark:border-gray-800 shadow-sm cursor-default transition-transform duration-150 hover:scale-125 ${pointerEventsNone ? 'pointer-events-none' : 'pointer-events-auto'}`}
            >
              <Icon
                className={`${compactRowMode ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0`}
                name="exclamation"
              />
            </span>
          </TextTooltip>
        </span>
      )}
      <div
        className={`absolute flex items-center justify-center gap-1 overflow-hidden ${pointerEventsNone ? 'pointer-events-none' : 'pointer-events-auto cursor-grab'} ${props.plannedInSprintVariant && props.position.sourceTaskId ? 'left-1 right-1 top-1/2 -translate-y-1/2' : ''}`}
        style={
          props.plannedInSprintVariant && props.position.sourceTaskId
            ? undefined
            : {
                left: showExtraPlanDuration ? `${estimatedPercent / 2}%` : '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }
        }
        title={props.assigneeDisplayName ?? undefined}
      >
        <OccupancyPhaseBarCenterContent
          avatarUrl={props.avatarUrl}
          badgeClass={props.badgeClass}
          compactRowMode={compactRowMode}
          forceReleaseStyle={props.forceReleaseStyle}
          initials={props.initials}
          isNarrow={props.isNarrow}
          phaseDateRangeLabel={props.phaseDateRangeLabel}
          phaseDurationLabel={props.phaseDurationLabel}
          plannedInSprintVariant={props.plannedInSprintVariant}
          position={props.position}
          showToolsEmoji={showToolsEmoji}
          teamPlanVariant={props.teamPlanVariant}
        />
      </div>
      {showStartAnchor && (
        <div
          className="pointer-events-none"
          id={`occupancy-start-${taskId}`}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1 }}
        />
      )}
      {showEndAnchor && (
        <div
          className="pointer-events-none"
          id={`occupancy-end-${taskId}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 1,
          }}
        />
      )}
    </>
  );
}
