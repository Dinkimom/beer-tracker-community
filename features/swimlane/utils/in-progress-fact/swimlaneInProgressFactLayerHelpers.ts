import type { SwimlaneInProgressFactSegment } from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';

import { type StatusPhaseCell, statusDurationsToCells } from '@/lib/planner-timeline';

export interface SegmentWithPhase {
  phase: StatusPhaseCell;
  seg: SwimlaneInProgressFactSegment;
}

/** Как в занятости: фаза closed — не полоса по длительности, а маркер «закрыто» */
export function isClosedFactPhase(phase: StatusPhaseCell): boolean {
  return phase.statusKey.toLowerCase().replace(/\s+/g, '') === 'closed';
}

/** Стабильный id DOM для react-xarrows (только [a-zA-Z0-9_-]) */
export function swimlaneFactBarElementId(
  layerId: string,
  seg: Pick<SwimlaneInProgressFactSegment, 'endTimeMs' | 'startTimeMs' | 'taskId'>
): string {
  const safe = layerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `factbar_${safe}_${seg.taskId}_${seg.startTimeMs}_${seg.endTimeMs}`;
}

export function hexToRgbaArrow(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function buildArrowPairsForSameTask(
  items: SegmentWithPhase[],
  layerId: string
): Array<{ from: string; to: string; taskId: string }> {
  const byTask = new Map<string, SegmentWithPhase[]>();
  for (const item of items) {
    const tid = item.seg.taskId;
    if (!byTask.has(tid)) byTask.set(tid, []);
    byTask.get(tid)!.push(item);
  }
  const pairs: Array<{ from: string; to: string; taskId: string }> = [];
  for (const list of byTask.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.seg.startTimeMs - b.seg.startTimeMs);
    for (let i = 0; i < sorted.length - 1; i++) {
      pairs.push({
        from: swimlaneFactBarElementId(layerId, sorted[i]!.seg),
        to: swimlaneFactBarElementId(layerId, sorted[i + 1]!.seg),
        taskId: sorted[i]!.seg.taskId,
      });
    }
  }
  return pairs;
}

export function buildWithPhases(
  segments: SwimlaneInProgressFactSegment[],
  sprintStartDate: Date,
  nowCell: number,
  timelineStartCell: number,
  totalParts: number
): SegmentWithPhase[] {
  const out: SegmentWithPhase[] = [];
  for (const seg of segments) {
    const cells = statusDurationsToCells(
      sprintStartDate,
      [
        {
          endTime: seg.endTime,
          endTimeMs: seg.endTimeMs,
          startTime: seg.startTime,
          startTimeMs: seg.startTimeMs,
          statusKey: seg.statusKey,
          statusName: seg.statusName,
        },
      ],
      totalParts
    );
    const phase = cells[0];
    if (!phase || phase.endCell <= timelineStartCell || phase.startCell >= nowCell) continue;
    out.push({ phase, seg });
  }
  return out;
}

export function buildLanes(withPhases: SegmentWithPhase[]): SegmentWithPhase[][] {
  if (withPhases.length === 0) return [];
  const maxLane = Math.max(...withPhases.map((x) => x.seg.laneIndex));
  const L: SegmentWithPhase[][] = Array.from({ length: maxLane + 1 }, () => []);
  for (const item of withPhases) {
    L[item.seg.laneIndex]!.push(item);
  }
  for (const lane of L) {
    lane.sort((a, b) => a.phase.startCell - b.phase.startCell);
  }
  const nonEmpty = L.filter((lane) => lane.length > 0);
  nonEmpty.sort((a, b) => {
    const minA = Math.min(...a.map((x) => x.phase.startCell));
    const minB = Math.min(...b.map((x) => x.phase.startCell));
    return minA - minB;
  });
  return nonEmpty;
}
