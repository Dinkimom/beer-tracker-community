/**
 * Компонент tooltip для CommentCard
 */

import { ZIndex } from '@/constants';

interface CommentCardTooltipProps {
  emptyDisplayText: string;
  text: string;
  x: number;
  y: number;
}

export function CommentCardTooltip({ text, emptyDisplayText, x, y }: CommentCardTooltipProps) {
  return (
    <div
      className="fixed bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 text-xs rounded-lg px-3 py-2 shadow-2xl pointer-events-none font-medium cursor-default"
      style={{
        left: `${x}px`,
        top: `${y + 60}px`,
        zIndex: ZIndex.tooltip,
        maxWidth: '300px',
        wordWrap: 'break-word',
        whiteSpace: 'normal',
      }}
    >
      {text || emptyDisplayText}
    </div>
  );
}

