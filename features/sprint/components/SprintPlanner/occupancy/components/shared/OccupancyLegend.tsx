'use client';

import type { ReactNode } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { getQAStripedPattern, getStatusColors } from '@/utils/statusColors';

/** Образец статуса в легенде (border-2 как у карточек; у backlog в цветах уже есть border-dashed) */
function StatusLegendSwatch({ statusKey, children }: { statusKey: string; children: ReactNode }) {
  const c = getStatusColors(statusKey);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-24 h-10 shrink-0 rounded-lg border-2 ${c.bg} ${c.border} ${c.bgDark ?? ''} ${c.borderDark ?? ''}`}
      />
      <span className="text-gray-700 dark:text-gray-300">{children}</span>
    </div>
  );
}

function getLegendBacklogDarkStyle(): React.CSSProperties | undefined {
  const colors = getStatusColors('backlog');
  if (!colors.qaStripedDark) return undefined;
  return {
    backgroundImage: `repeating-linear-gradient(
      45deg,
      ${colors.qaStripedDark.base},
      ${colors.qaStripedDark.base} 10px,
      ${colors.qaStripedDark.stripe} 10px,
      ${colors.qaStripedDark.stripe} 20px
    )`,
  };
}

export function OccupancyLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button
          className="!h-8 gap-1 !px-3 text-sm font-medium text-gray-600 hover:!bg-gray-50 hover:!text-gray-800 dark:!bg-gray-800/80 dark:text-gray-300 dark:hover:!bg-white/[0.06] dark:hover:!text-gray-100"
          title="Показать легенду"
          type="button"
          variant="outline"
        >
          Легенда
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" style={{ zIndex: 50 }} />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[51] max-h-[85vh] w-[90vw] max-w-3xl translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Легенда визуализации задач
            </Dialog.Title>
            <Dialog.Close asChild>
              <HeaderIconButton aria-label="Закрыть" title="Закрыть" type="button">
                <Icon className="h-5 w-5" name="x" />
              </HeaderIconButton>
            </Dialog.Close>
          </div>
        <div className="space-y-6 text-sm">
          {/* Статусы */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Статусы задач</h3>
            <div className="space-y-2">
              <StatusLegendSwatch statusKey="backlog">Backlog — в бэклоге (пунктирная граница)</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="readyfordevelopment">
                Ready for Development — готово к разработке
              </StatusLegendSwatch>
              <StatusLegendSwatch statusKey="readyForDesignReview">
                Ready for Design Review — готово к дизайн-ревью
              </StatusLegendSwatch>
              <StatusLegendSwatch statusKey="inprogress">In Progress — в работе</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="inDesignReview">
                In Design Review — на дизайн-ревью
              </StatusLegendSwatch>
              <StatusLegendSwatch statusKey="inreview">In Review — на ревью</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="defect">Defect / Blocked — дефект / заблокирована</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="readyfortest">Ready for Test — готово к тестированию</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="intesting">In Testing — в тестировании</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="rc">RC — готово к релизу</StatusLegendSwatch>
              <StatusLegendSwatch statusKey="closed">Closed — закрыта</StatusLegendSwatch>
            </div>
          </div>

          {/* QA штриховка */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">QA задачи</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative w-24 h-10">
                  {/* Светлая тема */}
                  <div
                    className={`absolute inset-0 rounded-lg overflow-hidden border-2 dark:hidden ${getStatusColors('backlog').border}`}
                    style={getQAStripedPattern('backlog')}
                  />
                  {/* Темная тема */}
                  <div
                    className={`absolute inset-0 rounded-lg overflow-hidden border-2 border-dashed hidden dark:block ${getStatusColors('backlog').borderDark || ''}`}
                    style={getLegendBacklogDarkStyle()}
                  />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Полосатый фон для QA задач</span>
              </div>
            </div>
          </div>

          {/* Превышение оценки */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Превышение оценки</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-32 h-10 rounded-lg overflow-hidden flex border border-gray-300 dark:border-gray-600">
                  <div
                    className="h-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center"
                    style={{ width: '60%' }}
                  >
                    <span className="text-xs text-white font-medium">2 sp</span>
                  </div>
                  <div className="w-0.5 bg-emerald-700 dark:bg-emerald-800" />
                  <div
                    className="h-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center"
                    style={{ width: 'calc(40% - 2px)' }}
                  >
                    <span className="text-xs text-white font-medium">+1 sp</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-700 dark:text-gray-300 mb-1">
                    При увеличении длительности фазы (ресайз) полоса делится на две части:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-0.5">
                    <li>Левая — исходная оценка с контентом задачи</li>
                    <li>Правая — дополнительное время (+N sp/tp), только пока тянете край</li>
                    <li>В статике полоса цельная, без деления</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Адаптация контента */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Адаптация контента</h3>
            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p>Размер текста и количество отображаемой информации зависят от ширины карточки:</p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-0.5 ml-2">
                <li>Менее 2 sp — минимальный текст, компактное отображение</li>
                <li>Менее 3 sp — уменьшенный текст, сокращенная информация</li>
                <li>3+ sp — полноразмерный текст, вся информация</li>
              </ul>
            </div>
          </div>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
