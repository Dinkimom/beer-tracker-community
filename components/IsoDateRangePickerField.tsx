'use client';

import * as Popover from '@radix-ui/react-popover';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { formatIsoDateRuNumericUtc, pad2, parseIsoDateOnly } from '@/lib/isoDateOnlyCalendar';

const WEEKDAYS_MON_FIRST = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

interface RangeDraft {
  end: string | null;
  start: string | null;
}

function isoDateRangeDayClassName(
  iso: string,
  draft: RangeDraft,
  todayUtc: { d: number; m: number; y: number },
  viewM: number,
  viewY: number,
): string {
  const isToday = viewY === todayUtc.y && viewM === todayUtc.m && parseIsoDateOnly(iso)?.d === todayUtc.d;
  const { start: s, end: e } = draft;

  const hasClosedRange = Boolean(s && e && s <= e);
  if (hasClosedRange) {
    const isEndpoint = iso === s || iso === e;
    const isBetween = Boolean(s && e && iso > s && iso < e);
    if (isEndpoint) {
      return '!bg-blue-600 !text-white hover:!bg-blue-700 dark:!bg-blue-600 dark:hover:!bg-blue-500 rounded-md';
    }
    if (isBetween) {
      return 'rounded-none bg-blue-100 text-gray-800 hover:!bg-blue-200 dark:bg-blue-900/40 dark:text-gray-100 dark:hover:!bg-blue-800/50';
    }
    if (isToday) {
      return 'text-gray-800 ring-2 ring-inset ring-blue-500 dark:text-gray-100 dark:ring-blue-400 hover:!bg-gray-100 dark:hover:!bg-gray-700 rounded-md';
    }
    return 'text-gray-800 hover:!bg-gray-100 dark:text-gray-100 dark:hover:!bg-gray-700 rounded-md';
  }

  if (s && !e && iso === s) {
    return '!bg-blue-600 !text-white hover:!bg-blue-700 dark:!bg-blue-600 dark:hover:!bg-blue-500 rounded-md';
  }

  if (isToday) {
    return 'text-gray-800 ring-2 ring-inset ring-blue-500 dark:text-gray-100 dark:ring-blue-400 hover:!bg-gray-100 dark:hover:!bg-gray-700 rounded-md';
  }
  return 'text-gray-800 hover:!bg-gray-100 dark:text-gray-100 dark:hover:!bg-gray-700 rounded-md';
}

export interface IsoDateRangePickerFieldProps {
  contentZIndex?: number;
  disabled?: boolean;
  endDate: string;
  placeholder?: string;
  startDate: string;
  onChange: (range: { endDate: string; startDate: string }) => void;
}

export function IsoDateRangePickerField({
  contentZIndex = ZIndex.modalNested + 2,
  disabled = false,
  endDate,
  placeholder = 'Выберите период',
  startDate,
  onChange,
}: IsoDateRangePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const nowUtc = useMemo(() => {
    const t = new Date();
    return { m: t.getUTCMonth() + 1, y: t.getUTCFullYear() };
  }, []);

  const [todayUtc, setTodayUtc] = useState(() => {
    const t = new Date();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  });

  const [draft, setDraft] = useState<RangeDraft>(() => ({
    start: parseIsoDateOnly(startDate) ? startDate : null,
    end: parseIsoDateOnly(endDate) ? endDate : null,
  }));

  const anchorIso = useMemo(() => {
    if (parseIsoDateOnly(startDate)) return startDate;
    if (parseIsoDateOnly(endDate)) return endDate;
    return null;
  }, [endDate, startDate]);

  const initialView = useMemo(() => {
    const p = anchorIso ? parseIsoDateOnly(anchorIso) : null;
    return { m: p?.m ?? nowUtc.m, y: p?.y ?? nowUtc.y };
  }, [anchorIso, nowUtc.m, nowUtc.y]);

  const [viewY, setViewY] = useState(initialView.y);
  const [viewM, setViewM] = useState(initialView.m);

  useEffect(() => {
    if (!open) return;
    const t = new Date();
    setTodayUtc({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
    const p = anchorIso ? parseIsoDateOnly(anchorIso) : null;
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    } else {
      setViewY(nowUtc.y);
      setViewM(nowUtc.m);
    }
    setDraft({
      start: parseIsoDateOnly(startDate) ? startDate : null,
      end: parseIsoDateOnly(endDate) ? endDate : null,
    });
  }, [anchorIso, endDate, nowUtc.m, nowUtc.y, open, startDate]);

  const displayLabel = useMemo(() => {
    if (!parseIsoDateOnly(startDate) || !parseIsoDateOnly(endDate)) return null;
    if (startDate > endDate) return null;
    return `${formatIsoDateRuNumericUtc(startDate)} — ${formatIsoDateRuNumericUtc(endDate)}`;
  }, [endDate, startDate]);

  const lastDay = new Date(Date.UTC(viewY, viewM, 0)).getUTCDate();
  const firstWeekdayUtc = new Date(Date.UTC(viewY, viewM - 1, 1)).getUTCDay();
  const startPad = (firstWeekdayUtc + 6) % 7;

  const monthTitle = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(viewY, viewM - 1, 1)));

  const goPrevMonth = () => {
    if (viewM <= 1) {
      setViewM(12);
      setViewY((y) => y - 1);
    } else {
      setViewM((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewM >= 12) {
      setViewM(1);
      setViewY((y) => y + 1);
    } else {
      setViewM((m) => m + 1);
    }
  };

  const onDayPick = (iso: string) => {
    const s = draft.start;
    const e = draft.end;
    const hasFull = Boolean(s && e);

    if (!s || hasFull) {
      setDraft({ start: iso, end: null });
      return;
    }

    let a = s;
    let b = iso;
    if (b < a) {
      const swap = a;
      a = b;
      b = swap;
    }
    setDraft({ start: a, end: b });
    onChange({ startDate: a, endDate: b });
    setOpen(false);
  };

  return (
    <Popover.Root modal={false} open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <Button
          aria-expanded={open}
          className="w-full !h-10 !min-h-10 !justify-between !gap-2 !px-3 font-normal"
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span
            className={
              displayLabel
                ? 'min-w-0 truncate text-left text-sm text-gray-900 dark:text-gray-100'
                : 'text-left text-sm text-gray-400 dark:text-gray-500'
            }
          >
            {displayLabel ?? placeholder}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" name="calendar" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="w-[min(100vw-2rem,288px)] rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
          side="bottom"
          sideOffset={6}
          style={{ zIndex: contentZIndex }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
            <Button
              aria-label="Предыдущий месяц"
              className="!h-8 !w-8 !min-w-0 shrink-0 !p-0"
              type="button"
              variant="ghost"
              onClick={goPrevMonth}
            >
              <Icon className="h-4 w-4" name="chevron-left" />
            </Button>
            <span className="min-w-0 truncate px-1 text-center text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
              {monthTitle}
            </span>
            <Button
              aria-label="Следующий месяц"
              className="!h-8 !w-8 !min-w-0 shrink-0 !p-0"
              type="button"
              variant="ghost"
              onClick={goNextMonth}
            >
              <Icon className="h-4 w-4" name="chevron-right" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS_MON_FIRST.map((w) => (
              <div
                key={w}
                className="flex h-7 items-center justify-center text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {w}
              </div>
            ))}
            {Array.from({ length: startPad }, (_, i) => (
              <div key={`pad-${i}`} className="h-8" />
            ))}
            {Array.from({ length: lastDay }, (_, i) => {
              const day = i + 1;
              const iso = `${viewY}-${pad2(viewM)}-${pad2(day)}`;
              return (
                <Button
                  key={iso}
                  className={`!h-8 !min-h-0 !w-full !px-0 !py-0 text-sm font-medium ${isoDateRangeDayClassName(iso, draft, todayUtc, viewM, viewY)}`}
                  type="button"
                  variant="ghost"
                  onClick={() => onDayPick(iso)}
                >
                  {day}
                </Button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
