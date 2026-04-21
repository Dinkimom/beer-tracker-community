'use client';

import type { Developer, Task, TaskLink, TaskPosition } from '@/types';

import { useState } from 'react';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { ZIndex } from '@/constants';
import {
  buildTasksMapById,
  filterTaskLinksByVisibleDevelopers,
  filterTaskLinksForActiveDrag,
  filterTaskLinksForSegmentEdit,
  mergeTaskLinksWithDevQa,
  partitionTaskArrowLinks,
} from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';

import { TaskArrowLayer } from './TaskArrowLayer';
import { TaskArrowLink } from './TaskArrowLink';

interface TaskArrowsProps {
  activeTaskId?: string | null;
  /** Порядок строк свимлейна (как в UI) — для вертикальных якорей между разными участниками */
  developers?: Developer[];
  hoveredTaskId?: string | null;
  /** Dev task id → QA task. Если передан, рисуются стрелки от задачи разработки к задаче тестирования. */
  qaTasksMap?: Map<string, Task>;
  /** Задача в режиме редактирования отрезков — связи с ней скрываем (как в занятости). */
  segmentEditTaskId?: string | null;
  /** Связи между задачами (в т.ч. пользовательские) */
  taskLinks: TaskLink[];
  taskPositions?: Map<string, TaskPosition>;
  tasks: Task[];
  visibleDeveloperIds?: Set<string>;
  onDeleteLink?: (linkId: string) => void;
}

export function TaskArrows({
  taskLinks,
  taskPositions,
  tasks,
  qaTasksMap,
  activeTaskId = null,
  hoveredTaskId = null,
  segmentEditTaskId = null,
  visibleDeveloperIds,
  developers,
  onDeleteLink,
}: TaskArrowsProps) {
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const tasksMap = buildTasksMapById(tasks);

  const allLinks = mergeTaskLinksWithDevQa(taskLinks, qaTasksMap, taskPositions);

  let visibleLinks = filterTaskLinksForActiveDrag(allLinks, activeTaskId);
  visibleLinks = filterTaskLinksForSegmentEdit(visibleLinks, segmentEditTaskId);

  if (visibleDeveloperIds) {
    visibleLinks = filterTaskLinksByVisibleDevelopers(
      visibleLinks,
      tasksMap,
      taskPositions,
      visibleDeveloperIds
    );
  }

  const hoveredTaskIdForArrows = hoveredTaskId;
  const { hoveredLink, hoveredTaskLinks, regularLinks } = partitionTaskArrowLinks(
    visibleLinks,
    hoveredLinkId,
    hoveredTaskIdForArrows ?? null
  );
  const arrowPointerEventsEnabled = true;

  const linkProps = {
    arrowPointerEventsEnabled,
    developers,
    hoveredLinkId,
    hoveredTaskIdForArrows: hoveredTaskIdForArrows ?? null,
    onDeleteLink,
    onHoveredLinkIdChange: setHoveredLinkId,
    phaseCardColorScheme,
    taskPositions,
    tasksMap,
  };

  return (
    <>
      <TaskArrowLayer zIndex={ZIndex.contentOverlay}>
        {regularLinks.map((link) => (
          <TaskArrowLink key={link.id} {...linkProps} link={link} />
        ))}
      </TaskArrowLayer>
      {hoveredTaskLinks.length > 0 && (
        <TaskArrowLayer zIndex={ZIndex.stickyElevated}>
          {hoveredTaskLinks.map((link) => (
            <TaskArrowLink key={link.id} {...linkProps} link={link} />
          ))}
        </TaskArrowLayer>
      )}
      {hoveredLink && (
        <TaskArrowLayer zIndex={ZIndex.arrowsHovered}>
          <TaskArrowLink {...linkProps} link={hoveredLink} />
        </TaskArrowLayer>
      )}
    </>
  );
}
