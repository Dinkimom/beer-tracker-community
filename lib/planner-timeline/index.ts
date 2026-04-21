/**
 * Общие константы и чистые функции таймлайна/фаз планера (sprint occupancy + swimlane).
 * Импорты из `features/sprint/.../occupancy` в swimlane сюда — по мере миграции F1.
 */

export { OCCUPANCY_FACT_PHASE_GAP_PX } from './factPhaseGap';
export { formatDuration } from './formatOccupancyDuration';
export * from './occupancyErrorMessages';
export * from './occupancyUtils';
export { PHASE_ROW_INSET_PX } from './phaseRowInset';
export {
  getPhaseFocusRingClass,
  type PhaseFocusRingVariant,
  PHASE_FOCUS_RING_SOURCE,
  PHASE_FOCUS_RING_TARGET,
} from './phaseFocusRing';
export {
  dateTimeToFractionalCell,
  dateTimeToFractionalCellInRange,
  getPartAndFraction,
  getWorkingDayIndex,
  getWorkingDayIndexInRange,
  TOTAL_PARTS,
} from './sprintCellUtils';
export type { StatusDurationLike, StatusPhaseCell } from './statusToCells';
export { statusDurationsToCells } from './statusToCells';
