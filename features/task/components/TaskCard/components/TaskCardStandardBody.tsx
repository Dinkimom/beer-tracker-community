import type {
  PlanningPhaseCardColorScheme,
  SwimlaneCardFieldsVisibility,
} from '@/hooks/useLocalStorage';
import type { Developer, Task, TaskCardVariant, TaskPosition } from '@/types';

import React from 'react';

import { TaskCardBody } from './TaskCardBody';
import { TaskCardSprintBadges } from './TaskCardSprintBadges';
import { TaskCardTags } from './TaskCardTags';

interface TaskCardStandardBodyProps {
  actualDuration: number;
  assigneeName?: string;
  children?: React.ReactNode;
  developers: Developer[];
  dividerBgClass: string;
  extraSP: number;
  isDark: boolean;
  isDragging: boolean;
  isLocalTask?: boolean;
  isQATask: boolean;
  isSwimlane: boolean;
  isVeryNarrow: boolean;
  leftPercent: number;
  phaseCardColorScheme: PlanningPhaseCardColorScheme;
  qaRightBgColor?: string;
  rightPercent: number;
  showExtraSplit: boolean;
  sprintBadge?: { display: string; id: string } | null;
  swimlaneCardFields: SwimlaneCardFieldsVisibility | undefined;
  task: Task;
  taskPosition?: TaskPosition;
  variant: TaskCardVariant;
}

export function TaskCardStandardBody({
  showExtraSplit,
  isSwimlane,
  isQATask,
  qaRightBgColor,
  leftPercent,
  rightPercent,
  dividerBgClass,
  extraSP,
  isVeryNarrow,
  isDark,
  assigneeName,
  developers,
  actualDuration,
  isDragging,
  phaseCardColorScheme,
  swimlaneCardFields,
  task,
  variant,
  taskPosition,
  sprintBadge,
  isLocalTask,
  children,
}: TaskCardStandardBodyProps) {
  const showTpLabels = isQATask && task.hideTestPointsByIntegration !== true;
  return (
    <>
      {showExtraSplit && isSwimlane && (
        <>
          {isQATask && qaRightBgColor && (
            <div
              className="absolute right-0 top-0 bottom-0 rounded-r-lg pointer-events-none"
              style={{ width: `${rightPercent}%`, backgroundColor: qaRightBgColor }}
            />
          )}
          <div
            className="absolute right-0 top-0 bottom-0 rounded-r-lg pointer-events-none bg-white/40 dark:bg-black/25"
            style={{ width: `${rightPercent}%` }}
          />
          <div
            className={`absolute top-0 bottom-0 w-0.5 pointer-events-none z-10 ${dividerBgClass}`}
            style={{ left: `${leftPercent}%` }}
          />
          {extraSP > 0 && !isVeryNarrow && (
            <span
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-xs font-semibold whitespace-nowrap z-10 ${isDark ? 'text-white/95' : 'text-gray-800'}`}
              style={{
                left: `${leftPercent}%`,
                width: `${rightPercent}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +{extraSP} {showTpLabels ? 'tp' : 'sp'}
            </span>
          )}
        </>
      )}
      <TaskCardSprintBadges isLocalTask={isLocalTask} sprintBadge={sprintBadge} />

      <div
        className={`flex flex-col min-h-0 overflow-hidden${isSwimlane ? ' flex-1' : ''}`}
        style={showExtraSplit && isSwimlane ? { width: `${leftPercent}%` } : undefined}
      >
        <TaskCardBody
          assigneeName={assigneeName}
          developers={developers}
          displayDuration={actualDuration}
          isDragging={isDragging}
          isQATask={isQATask}
          phaseCardColorScheme={phaseCardColorScheme}
          swimlaneCardFields={swimlaneCardFields}
          task={task}
          variant={variant}
        />
      </div>

      <TaskCardTags
        displayDuration={actualDuration}
        task={task}
        taskPosition={taskPosition}
        variant={variant}
      />

      {children}
    </>
  );
}
