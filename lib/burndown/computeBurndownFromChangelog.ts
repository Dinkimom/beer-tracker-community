/**
 * Публичный вход для burndown по changelog: реализация в {@link ./burndownFromChangelogReplay}.
 */

export {
  applyFieldToTaskState,
  buildDailyChangelogFromFieldStream,
  buildTaskStateAtSprintStart,
  collectBurndownEventsInSprintWindow,
  computeBurndownFromChangelog,
  extractStatusKey,
  sprintArrayContainsSprint,
  toBurndownDateKey,
  type BurndownDataPoint,
  type BurndownEvent,
  type ComputeBurndownFromChangelogInput,
  type ComputeBurndownFromChangelogResult,
  type TaskState,
} from './burndownFromChangelogReplay';

export {
  buildSprintChangelogTimelineByDay,
  buildTaskChangelogTimelineByDay,
  collectSprintChangelogRows,
  computeSprintTimelineTotals,
  groupChangelogRowsIntoTaskDays,
  parseChangelogEntryToTimelineItems,
  rollupTaskDayEventsForEndOfDayView,
  rollupTaskDayReestimatesToOne,
  rollupTaskDayStatusChainToOne,
  type BuildTaskChangelogTimelineOptions,
  type ComputeSprintTimelineTotalsOptions,
  type SprintTimelineTotals,
  type TaskChangelogDay,
  type TaskChangelogDayTaskRollup,
  type TaskChangelogTimelineItem,
} from './taskChangelogTimeline';
