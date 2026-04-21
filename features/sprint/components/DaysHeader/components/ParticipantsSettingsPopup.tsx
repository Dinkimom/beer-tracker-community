'use client';

import type { Developer } from '@/types';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { DevelopersManagementContent } from '@/features/sidebar/components/DevelopersManagement';

interface ParticipantsSettingsPopupProps {
  developers: Developer[];
  developersManagement: {
    handleDragEnd: (activeId: string, overId: string) => void;
    hiddenIds: Set<string>;
    hideAllDevelopers: () => void;
    setSortBy: (sort: 'custom' | 'name' | 'sp' | 'tasks' | 'tp') => void;
    showAllDevelopers: () => void;
    sortBy: 'custom' | 'name' | 'sp' | 'tasks' | 'tp';
    sortedDevelopers: Developer[];
    toggleDeveloperVisibility: (id: string) => void;
  };
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
}

export function ParticipantsSettingsPopup({
  developers,
  developersManagement,
  isOpen,
  onClose,
  position,
}: ParticipantsSettingsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Закрываем попап при клике вне его или нажатии Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const popupContent = (
    <>
      {/* Overlay */}
      <div className="fixed inset-0" style={{ zIndex: ZIndex.contextMenu }} onClick={onClose} />

      {/* Popup — выше оверлея и остального контента */}
      <div
        ref={popupRef}
        className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-80 max-h-[600px] overflow-y-auto"
        style={{
          zIndex: ZIndex.popupContent,
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Участники</h3>
            <HeaderIconButton
              aria-label="Закрыть"
              className="!h-6 !w-6"
              title="Закрыть"
              type="button"
              onClick={onClose}
            >
              <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" name="x" />
            </HeaderIconButton>
          </div>

          {developersManagement && developers.length > 0 && (
            <DevelopersManagementContent
              developers={developers}
              developersManagement={developersManagement}
            />
          )}
        </div>
      </div>
    </>
  );

  return createPortal(popupContent, document.body);
}

