'use client';

import React from 'react';

interface IconProps {
  className?: string;
  name: string;
  /** Условный размер иконки, если className не передан */
  size?: 'lg' | 'md' | 'sm';
}

// Маппинг иконок - SVG контент напрямую для поддержки currentColor
const icons: Record<string, React.ReactNode> = {
  // Chevron иконки
  'chevron-down': (
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'chevron-up': (
    <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'chevron-right': (
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'chevron-left': (
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),

  'arrow-left': (
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'undo': (
    <>
      <path d="M9 14 4 9l5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 9h10.5a5.5 5.5 0 1 1 0 11H11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'redo': (
    <>
      <path d="m15 14 5-5-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M20 9H9.5a5.5 5.5 0 1 0 0 11H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),

  // Действия
  'plus': (
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'plus-bold': (
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
  ),
  'check': (
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'check-bold': (
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
  ),
  'x': (
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  /** Алиас к `x` — в UI часто семантически «закрыть» */
  close: (
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'grip-vertical': (
    <>
      <circle cx="9" cy="5" fill="currentColor" r="1" />
      <circle cx="9" cy="12" fill="currentColor" r="1" />
      <circle cx="9" cy="19" fill="currentColor" r="1" />
      <circle cx="15" cy="5" fill="currentColor" r="1" />
      <circle cx="15" cy="12" fill="currentColor" r="1" />
      <circle cx="15" cy="19" fill="currentColor" r="1" />
    </>
  ),
  'x-bold': (
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
  ),
  'circle-x': (
    <>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M16 8l-8 8M8 8l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'circle-help': (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M12 17h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'edit': (
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'users': (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  /** Фаза на таймлайне, разбитая на отрезки (занятость) */
  'phase-segments': (
    <>
      <rect
        fill="none"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
        width="16"
        x="4"
        y="7"
      />
      <path d="M9.5 7v10M14.5 7v10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </>
  ),
  'trash': (
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'drag-handle': (
    <>
      <circle cx="9" cy="5" fill="currentColor" r="1"/>
      <circle cx="9" cy="12" fill="currentColor" r="1"/>
      <circle cx="9" cy="19" fill="currentColor" r="1"/>
      <circle cx="15" cy="5" fill="currentColor" r="1"/>
      <circle cx="15" cy="12" fill="currentColor" r="1"/>
      <circle cx="15" cy="19" fill="currentColor" r="1"/>
    </>
  ),
  'dots-horizontal': (
    <>
      <circle cx="6" cy="12" fill="currentColor" r="1.5" />
      <circle cx="12" cy="12" fill="currentColor" r="1.5" />
      <circle cx="18" cy="12" fill="currentColor" r="1.5" />
    </>
  ),
  'sparkles': (
    <>
      <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor" />
      <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor" />
      <path d="M5 19L5.5 20.5L7 21L5.5 21.5L5 23L4.5 21.5L3 21L4.5 20.5L5 19Z" fill="currentColor" />
    </>
  ),
  'play': (
    <>
      <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),

  // UI элементы
  'calendar': (
    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'user': (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'spinner': (
    <>
      <circle cx="12" cy="12" opacity="0.25" r="10" stroke="currentColor" strokeWidth="4" />
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
    </>
  ),
  'search': (
    <>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'menu': (
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'refresh': (
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'home': (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'mail': (
    <>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="m22 6-10 7L2 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'minimize': (
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'maximize': (
    <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'sun': (
    <>
      <circle cx="12" cy="12" fill="currentColor" r="5" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="12" x2="12" y1="1" y2="3"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="12" x2="12" y1="21" y2="23"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="4.22" x2="5.64" y1="4.22" y2="5.64"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="18.36" x2="19.78" y1="18.36" y2="19.78"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="1" x2="3" y1="12" y2="12"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="21" x2="23" y1="12" y2="12"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="4.22" x2="5.64" y1="19.78" y2="18.36"/>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>
    </>
  ),
  'moon': (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
  ),
  'snowflake': (
    <>
      <path d="M12 2v20M2 12h20M6.34 6.34l11.32 11.32M17.66 6.34L6.34 17.66M19.07 4.93L4.93 19.07M4.93 4.93L19.07 19.07" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="2" fill="currentColor" r="1.5" />
      <circle cx="12" cy="22" fill="currentColor" r="1.5" />
      <circle cx="2" cy="12" fill="currentColor" r="1.5" />
      <circle cx="22" cy="12" fill="currentColor" r="1.5" />
      <circle cx="6.34" cy="6.34" fill="currentColor" r="1" />
      <circle cx="17.66" cy="17.66" fill="currentColor" r="1" />
      <circle cx="17.66" cy="6.34" fill="currentColor" r="1" />
      <circle cx="6.34" cy="17.66" fill="currentColor" r="1" />
    </>
  ),
  'tree': (
    <>
      {/* Три треугольника, образующих форму ёлки */}
      <path d="M12 4L8 11L16 11L12 4Z" fill="currentColor" />
      <path d="M12 9L9 15L15 15L12 9Z" fill="currentColor" />
      <path d="M12 14L10 19L14 19L12 14Z" fill="currentColor" />
    </>
  ),
  'archive': (
    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'comment': (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'settings': (
    <>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'bar-chart': (
    <>
      <path d="M12 20V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M18 20V4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M6 20v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="16" x2="8" y1="13" y2="13" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  // Иконки для markdown редактора
  'hash': (
    <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'bold': (
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'italic': (
    <path d="M19 4h-9M14 20H5M15 4L9 20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'strikethrough': (
    <path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6M4 12h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'code': (
    <>
      <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'code-block': (
    <>
      <path d="M4 4h16v16H4z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9 9l-2 3 2 3M15 9l2 3-2 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'link': (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'copy': (
    <path
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  ),
  'image': (
    <>
      <rect height="18" rx="2" ry="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="18" x="3" y="3" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'list': (
    <>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="8" x2="21" y1="6" y2="6" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="8" x2="21" y1="12" y2="12" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="8" x2="21" y1="18" y2="18" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="3" x2="3.01" y1="6" y2="6" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="3" x2="3.01" y1="12" y2="12" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="3" x2="3.01" y1="18" y2="18" />
    </>
  ),
  'list-ordered': (
    <>
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10" x2="21" y1="6" y2="6" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10" x2="21" y1="12" y2="12" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10" x2="21" y1="18" y2="18" />
      <path d="M4 6h1v4M3 10h3M6 18H3c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'quote': (
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'minus': (
    <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="5" x2="19" y1="12" y2="12" />
  ),
  'diagram': (
    <>
      <rect height="7" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="7" x="3" y="3" />
      <rect height="7" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="7" x="14" y="3" />
      <rect height="7" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="7" x="14" y="14" />
      <path d="M7 10v4a1 1 0 0 0 1 1h6M17 10v1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'test-plan': (
    <>
      <path d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v1H9V3a1 1 0 0 0-1-1z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9 6h6M9 10h6M9 14h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'loader': (
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  'log-out': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="21" x2="9" y1="12" y2="12" />
    </>
  ),
  'lock': (
    <>
      <rect height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" width="18" x="3" y="11" />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </>
  ),
  'eye': (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'eye-off': (
    <>
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="1" x2="23" y1="1" y2="23" />
    </>
  ),
  'warning': (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12" y1="9" y2="13" />
      <line stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12.01" y1="17" y2="17" />
    </>
  ),
  'check-square': (
    <>
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'check-circle': (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'alert-triangle': (
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  /** Восклицательный знак (без треугольника), для бейджей ошибок */
  'exclamation': (
    <path d="M12 2v10M12 16v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),

  // Иконки приоритетов
  'priority-low': (
    <path clipRule="evenodd" d="M1.867 6.097a.75.75 0 0 1 1.036-.23L8 9.111l5.097-3.244a.75.75 0 0 1 .806 1.266l-5.5 3.5a.75.75 0 0 1-.806 0l-5.5-3.5a.75.75 0 0 1-.23-1.036" fill="currentColor" fillRule="evenodd" />
  ),
  'priority-medium': (
    <path clipRule="evenodd" d="M13.5 11a.75.75 0 0 0 0-1.5h-11a.75.75 0 0 0 0 1.5zm0-4.5a.75.75 0 0 0 0-1.5h-11a.75.75 0 0 0 0 1.5z" fill="currentColor" fillRule="evenodd" />
  ),
  'priority-blocker': (
    <path clipRule="evenodd" d="M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m1-4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M8.75 5a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0z" fill="currentColor" fillRule="evenodd" />
  ),
  'priority-trivial': (
    <path clipRule="evenodd" d="M2.903 3.617a.75.75 0 1 0-.806 1.266l5.5 3.5a.75.75 0 0 0 .806 0l5.5-3.5a.75.75 0 1 0-.806-1.266L8 6.861zm0 4.5a.75.75 0 1 0-.806 1.266l5.5 3.5a.75.75 0 0 0 .806 0l5.5-3.5a.75.75 0 1 0-.806-1.266L8 11.361z" fill="currentColor" fillRule="evenodd" />
  ),
  'priority-critical': (
    <path clipRule="evenodd" d="M13.097 12.383a.75.75 0 0 0 .806-1.266l-5.5-3.5a.75.75 0 0 0-.806 0l-5.5 3.5a.75.75 0 1 0 .806 1.266L8 9.139zm0-4.5a.75.75 0 0 0 .806-1.266l-5.5-3.5a.75.75 0 0 0-.806 0l-5.5 3.5a.75.75 0 0 0 .806 1.266L8 4.639z" fill="currentColor" fillRule="evenodd" />
  ),

  // Иконки типов задач
  'issue-bug': (
    <path d="M10.63 3.38v.1c0 .44-.36.77-.8.77H6.14a.75.75 0 0 1-.76-.77v-.1a2.63 2.63 0 0 1 5.25 0m-8.56.19a.64.64 0 0 1 .9 0l2 2c.43-.28.92-.45 1.5-.45h3.06c.55 0 1.04.17 1.48.44l2-2a.64.64 0 0 1 .9 0c.27.28.27.69 0 .94l-1.97 2c.27.43.44.92.44 1.47h1.96c.36 0 .66.3.66.66 0 .38-.3.65-.66.65h-1.96v.22c0 .77-.2 1.45-.52 2.08l2.05 2.05c.27.27.27.68 0 .93a.6.6 0 0 1-.9 0l-1.95-1.92a4.43 4.43 0 0 1-6.15 0l-1.94 1.92a.6.6 0 0 1-.9 0c-.28-.25-.28-.66 0-.93l2.05-2.05a4.4 4.4 0 0 1-.5-2.08v-.22H1.67A.63.63 0 0 1 1 8.63c0-.36.27-.66.66-.66h1.97c0-.55.13-1.04.4-1.48l-1.96-2c-.28-.24-.28-.65 0-.92M4.94 9.5c0 1.48 1 2.7 2.4 3V8.4c0-.35.28-.65.66-.65.36 0 .66.3.66.66v4.1a3.08 3.08 0 0 0 2.4-3.01V7.97c0-.82-.7-1.53-1.53-1.53H6.47c-.85 0-1.53.7-1.53 1.53z" fill="currentColor" />
  ),
  'issue-task': (
    <path d="m12.73 3.32-2.05-2.05A1.74 1.74 0 0 0 9.45.75H4.5c-.98 0-1.75.8-1.75 1.75V13c0 .98.77 1.75 1.75 1.75h7c.96 0 1.75-.77 1.75-1.75V4.55c0-.46-.2-.9-.52-1.23m-.8 9.68c0 .25-.21.44-.43.44h-7a.43.43 0 0 1-.44-.44V2.53c0-.25.2-.44.44-.44h4.38v2.16c0 .5.38.88.87.88h2.16V13zM5.39 8.4c0 .39.27.66.65.66h3.94c.35 0 .65-.27.65-.65 0-.36-.3-.66-.65-.66H6.03c-.38 0-.66.3-.66.66Zm4.59 1.97H6.03c-.38 0-.66.3-.66.66 0 .38.28.66.66.66h3.94c.35 0 .65-.28.65-.66 0-.35-.3-.65-.65-.65Z" fill="currentColor" />
  ),
  'issue-epic': (
    <path d="M14.78 3.38a1.08 1.08 0 0 0-.87 1.75l-2.46 1.96a.84.84 0 0 1-.55.2.9.9 0 0 1-.77-.5L8.55 3.65c.32-.2.52-.52.52-.93 0-.6-.47-1.1-1.07-1.1-.63 0-1.12.5-1.12 1.1 0 .4.22.74.52.93L5.84 6.79c-.14.3-.46.5-.77.5a.84.84 0 0 1-.54-.2L2.07 5.13c.13-.2.22-.42.22-.66a1.1 1.1 0 0 0-2.19 0c0 .63.49 1.1 1.1 1.1l1.39 7.6a.9.9 0 0 0 .87.7h9.05c.41 0 .8-.3.85-.7l1.4-7.6h.02a1.1 1.1 0 0 0 0-2.19m-2.65 9.18H3.84l-.93-5.08.8.63A2.16 2.16 0 0 0 7 7.4l1-1.96.96 1.94a2.18 2.18 0 0 0 3.31.72l.79-.63z" fill="currentColor" />
  ),
  'issue-story': (
    <path d="M14.95 12.67 11.99 1.73a1.34 1.34 0 0 0-1.26-.98c-.1 0-.21.03-.35.05l-1.67.47a.94.94 0 0 0-.44.2A1.33 1.33 0 0 0 7.13.74H5.38c-.25 0-.47.08-.66.2a1.5 1.5 0 0 0-.66-.2H2.31C1.57.75 1 1.35 1 2.06v11.38c0 .74.57 1.31 1.31 1.31h1.75c.22 0 .44-.05.66-.16.19.1.4.16.66.16h1.75c.7 0 1.3-.57 1.3-1.31V5.29l2.28 8.5c.16.58.68.96 1.28.96.11 0 .22 0 .33-.03l1.7-.46c.7-.2 1.12-.9.93-1.59M7.13 2.07v1.3H5.38v-1.3zM5.38 4.68h1.75v6.12H5.38V4.7ZM4.05 10.8H2.31V4.7h1.75v6.12Zm0-8.75v1.31H2.31v-1.3h1.75ZM2.31 13.44v-1.31h1.75v1.3zm3.06 0v-1.29l1.75-.03v1.32zM9.04 2.53l1.7-.44.32 1.23-1.7.47zm.68 2.51 1.7-.43L13 10.48l-1.7.44zM12 13.46l-.35-1.25 1.7-.47.35 1.26z" fill="currentColor" />
  ),
  'target': (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
  'wrench': (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  ),
  /** Строительный кран — для экспериментальных фич */
  'crane': (
    <>
      <path d="M12 2v6l4 4h-8l4-4V2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M12 12v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 20h16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 20V12l4-4 4 4v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </>
  ),
};

/**
 * Маппинг смещений для центрирования иконок
 * Ключ - имя иконки, значение - [x, y] смещение в пикселях для центрирования
 * Положительные значения сдвигают путь вправо и вниз к центру viewBox (12, 12)
 */
const iconOffsets: Record<string, [number, number]> = {
  'priority-medium': [4, 4],
  'priority-low': [4, 3.75],
  'priority-critical': [4, 4.25],
  'priority-trivial': [4, 3.75],
  'priority-blocker': [4, 4], // Центр круга в (8,8), сдвигаем к (12,12)
  'issue-bug': [4, 4.16],
  'issue-task': [4, 4.25],
  'issue-epic': [4, 4],
  'issue-story': [4, 4.25],
};

/**
 * Универсальный компонент для отображения SVG иконок
 * Рендерит SVG напрямую для поддержки currentColor и CSS стилизации
 */
export function Icon({ name, className, size = 'md' }: IconProps) {
  const iconContent = icons[name];

  if (!iconContent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const offset = iconOffsets[name];

  // Для иконок sun, moon, tree и sparkles используем fill, для остальных - stroke
  const useFill = name === 'sun' || name === 'moon' || name === 'tree' || name === 'sparkles';

  const computedClassName =
    className
      ?? (size === 'sm'
        ? 'w-4 h-4'
        : size === 'lg'
          ? 'w-6 h-6'
          : 'w-5 h-5');

  return (
    <svg
      className={computedClassName}
      fill={useFill ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {offset ? (
        <g transform={`translate(${offset[0]}, ${offset[1]})`}>
          {iconContent}
        </g>
      ) : (
        iconContent
      )}
    </svg>
  );
}

