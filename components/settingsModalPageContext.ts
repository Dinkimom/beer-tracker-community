import type { MainPage, SprintTab } from '@/components/PageHeader';
import type { PlanningGanttTab } from '@/components/SettingsModal/tabs/SettingsPlanningTab.types';
import type { BoardViewMode } from '@/hooks/useLocalStorage';

export type SettingsMainTab = 'general' | 'planning' | 'ytracker';

/**
 * Какой таб модалки настроек и подтаб «Планирование» соответствуют текущей странице приложения.
 *
 * @param boardViewMode — режим доски спринта из localStorage (`useBoardViewModeStorage`):
 * «По задачам» → sprint, «По исполнителям» → swimlane, «Канбан» → kanban. Иначе `null`.
 */
export function getSettingsTabsForPage(
  activeMainPage: MainPage,
  activeSprintTab: SprintTab,
  boardViewMode: BoardViewMode | null
): { mainTab: SettingsMainTab; planningGanttTab: PlanningGanttTab } {
  switch (activeMainPage) {
    case 'features':
      return { mainTab: 'planning', planningGanttTab: 'epics' };
    case 'quarterly-v2':
      return { mainTab: 'planning', planningGanttTab: 'quarterly-v2' };
    case 'sprints':
      if (activeSprintTab === 'board' && boardViewMode != null) {
        if (boardViewMode === 'occupancy') {
          return { mainTab: 'planning', planningGanttTab: 'sprint' };
        }
        if (boardViewMode === 'kanban') {
          return { mainTab: 'planning', planningGanttTab: 'kanban' };
        }
        // full | compact — «По исполнителям» (свимлейн)
        return { mainTab: 'planning', planningGanttTab: 'swimlane' };
      }
      return { mainTab: 'planning', planningGanttTab: 'sprint' };
  }
}
