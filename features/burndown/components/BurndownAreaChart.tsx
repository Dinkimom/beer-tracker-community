'use client';

import type { PointsType } from '@/types';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';

export interface BurndownChartDataPoint {
  date: string;
  dayChangelog?: Array<{ change: number; changeTP: number; issueKey: string; remainingSP: number; remainingTP: number; summary: string; type: string }>;
  fullDate: string;
  idealSP?: number;
  idealTP?: number;
  remainingSP?: number;
  remainingTP?: number;
}

interface BurndownAreaChartProps {
  chartData: BurndownChartDataPoint[];
  pinnedPoint?: BurndownChartDataPoint | null;
  theme: 'dark' | 'light';
  title: string;
  /** Legend / series label for the ideal (dashed) line */
  idealSeriesName: string;
  /** Legend / series label for remaining SP or TP */
  remainingSeriesName: string;
  type: PointsType;
  onPointClick?: (payload: BurndownChartDataPoint, metricType: PointsType, event: React.MouseEvent) => void;
  tooltipContent: (props: TooltipProps<number, string>) => React.ReactNode;
}

export function BurndownAreaChart({
  chartData,
  pinnedPoint,
  theme,
  tooltipContent,
  type,
  title,
  idealSeriesName,
  remainingSeriesName,
  onPointClick,
}: BurndownAreaChartProps) {
  const isSP = type === 'SP';
  const gradientId = isSP ? 'colorSP' : 'colorTP';
  const gradientColor = isSP ? '#3b82f6' : '#f59e0b';
  const idealDataKey = isSP ? 'idealSP' : 'idealTP';
  const remainingDataKey = isSP ? 'remainingSP' : 'remainingTP';

  const pinnedY = pinnedPoint != null
    ? (isSP ? pinnedPoint.remainingSP : pinnedPoint.remainingTP)
    : undefined;
  const showPinnedDot = pinnedPoint != null && pinnedPoint.date != null && pinnedY !== undefined;

  const handleDotClick = (e: React.MouseEvent, payload: BurndownChartDataPoint) => {
    e.preventDefault();
    e.stopPropagation();
    onPointClick?.(payload, type, e);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex-1 min-h-0 flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
              tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
            />
            <YAxis
              stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
              tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
            />
            <Tooltip content={tooltipContent} />
            <Legend />
            {showPinnedDot && (
              <ReferenceDot
                fill={gradientColor}
                isFront
                r={8}
                stroke={gradientColor}
                strokeWidth={2}
                x={pinnedPoint.date}
                y={pinnedY}
              />
            )}
            <Area
              dataKey={idealDataKey}
              fill="none"
              isAnimationActive={false}
              legendType="line"
              name={idealSeriesName}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="linear"
            />
            <Area
              activeDot={(props: { payload?: BurndownChartDataPoint; cx?: number; cy?: number; fill?: string; stroke?: string }) => (
                <circle
                  className="cursor-pointer"
                  cx={props.cx}
                  cy={props.cy}
                  fill={props.fill ?? gradientColor}
                  r={6}
                  stroke={props.stroke ?? gradientColor}
                  style={{ cursor: onPointClick ? 'pointer' : undefined }}
                  onClick={(e) => props.payload && handleDotClick(e, props.payload)}
                />
              )}
              dataKey={remainingDataKey}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              name={remainingSeriesName}
              stroke={gradientColor}
              strokeWidth={3}
              type="linear"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

