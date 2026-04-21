'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';
import { useRef } from 'react';

import { BeerLottie, type BeerLottieRef } from '@/components/BeerLottie';
import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useI18n } from '@/contexts/LanguageContext';
import { useThemeStorage } from '@/hooks/useLocalStorage';

interface AdminHeaderProps {
  canAdmin: boolean;
  organizationName: string | null;
  /** Селектор организации (супер-админ) — слева от названия org */
  organizationSelector?: ReactNode;
}

export function AdminHeader({ canAdmin, organizationName, organizationSelector }: AdminHeaderProps) {
  const { t } = useI18n();
  const [theme, setTheme] = useThemeStorage();
  const beerLottieRef = useRef<BeerLottieRef>(null);

  return (
    <header className="flex-shrink-0 border-b border-ds-border-subtle bg-ds-surface-header">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Логотип */}
          <Button
            aria-label={t('header.clickForAnimation')}
            className="h-auto min-h-0 gap-1 border-0 bg-transparent p-0 pr-2 text-left shadow-none hover:bg-transparent dark:hover:bg-transparent"
            type="button"
            variant="ghost"
            onClick={() => beerLottieRef.current?.play()}
          >
            <BeerLottie ref={beerLottieRef} />
            <span
              className="whitespace-nowrap text-2xl font-bold text-gray-900 dark:text-gray-100"
              style={{
                fontFamily: 'var(--font-caveat), cursive',
                fontWeight: 700,
                letterSpacing: '0.02em',
                transform: 'rotate(-1deg)',
              }}
            >
              {t('admin.header.brandTitle')}
            </span>
          </Button>

          <div className="h-6 w-px flex-shrink-0 bg-ds-border-subtle" />

          {canAdmin && organizationSelector ? (
            <div className="flex min-w-0 max-w-full flex-1 items-center">{organizationSelector}</div>
          ) : null}

          {canAdmin && !organizationSelector ? (
            <span className="whitespace-nowrap text-base font-semibold text-gray-900 dark:text-gray-100">
              {organizationName ?? '—'}
            </span>
          ) : null}

          {!canAdmin ? (
            <span className="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('admin.header.fallbackTitle')}
            </span>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSelector />
          <HeaderIconButton
            title={
              theme === 'light' ? t('header.actions.switchToDarkTheme') : t('header.actions.switchToLightTheme')
            }
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? (
              <Icon className="h-4 w-4 text-amber-500" name="sun" />
            ) : (
              <Icon className="h-4 w-4 text-amber-400" name="moon" />
            )}
          </HeaderIconButton>

          <Link
            className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-gray-800"
            href="/"
          >
            <span className="whitespace-nowrap">{t('admin.header.toPlanner')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
