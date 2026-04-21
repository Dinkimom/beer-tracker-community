'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

export interface ConfirmDialogPromptOptions {
  cancelText?: string;
  confirmText?: string;
  title?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmDialogProps {
  cancelText?: string;
  confirmText?: string;
  message: string;
  open: boolean;
  title: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  variant = 'default',
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const confirmLabel = confirmText ?? t('common.confirm');
  const cancelLabel = cancelText ?? t('common.cancel');
  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
        {/* Обёртка fixed inset-0 гарантирует, что бэкдроп перекрывает весь viewport при любом контейнере */}
        <div
          aria-hidden
          className="fixed inset-0 animate-in fade-in"
          style={{ zIndex: ZIndex.modalBackdrop }}
        >
          <Dialog.Overlay className="absolute inset-0 bg-black/50 dark:bg-black/70" />
        </div>
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md ${ZIndex.class('modal')} animate-in fade-in zoom-in-95`}
          data-confirm-dialog="true"
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {message}
          </Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={variant === 'destructive' ? 'danger' : 'primary'}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Хук для использования диалога подтверждения
 * Возвращает функцию, которая показывает диалог и возвращает Promise<boolean>
 */
export function useConfirmDialog() {
  const { t } = useI18n();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (message: string, options?: ConfirmDialogPromptOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialogState({
          open: true,
          title: options?.title || t('common.confirmDialogTitle'),
          message,
          confirmText: options?.confirmText,
          cancelText: options?.cancelText,
          variant: options?.variant,
          resolve,
        });
      });
    },
    [t]
  );

  const handleConfirm = useCallback(() => {
    if (dialogState) {
      dialogState.resolve(true);
      setDialogState(null);
    }
  }, [dialogState]);

  const handleCancel = useCallback(() => {
    if (dialogState) {
      dialogState.resolve(false);
      setDialogState(null);
    }
  }, [dialogState]);

  const dialogElement = dialogState ? (
    <ConfirmDialog
      cancelText={dialogState.cancelText}
      confirmText={dialogState.confirmText}
      message={dialogState.message}
      open={dialogState.open}
      title={dialogState.title}
      variant={dialogState.variant}
      onConfirm={handleConfirm}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}
    />
  ) : null;

  const DialogComponent =
    dialogElement && typeof document !== 'undefined' && document.body
      ? createPortal(dialogElement, document.body)
      : dialogElement;

  return { confirm, DialogComponent };
}

