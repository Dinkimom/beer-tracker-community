'use client';

import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { YANDEX_OAUTH_CLIENT_ID } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';

interface SettingsYTrackerTabProps {
  error: string;
  isValidating: boolean;
  localToken: string;
  showToken: boolean;
  token: string;
  handleSave: () => void;
  setError: (v: string) => void;
  setLocalToken: (v: string) => void;
  setShowToken: (v: boolean) => void;
}

export function SettingsYTrackerTab({
  error,
  handleSave,
  isValidating,
  localToken,
  setLocalToken,
  setShowToken,
  setError,
  showToken,
  token,
}: SettingsYTrackerTabProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="tabpanel">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {t('settings.yTrackerTab.browserOnlyNote')}
        </p>
      </div>
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          htmlFor="oauth-token"
        >
          {t('settings.yTrackerTab.oauthTokenLabel')}{' '}
          <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              autoComplete="off"
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                error
                  ? 'border-red-500 focus:ring-red-500'
                  : token
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              id="oauth-token"
              placeholder={t('settings.yTrackerTab.oauthTokenPlaceholder')}
              type={showToken ? 'text' : 'password'}
              value={localToken}
              onChange={(e) => {
                setLocalToken(e.target.value);
                setError('');
              }}
            />
            <HeaderIconButton
              aria-label={
                showToken ? t('settings.yTrackerTab.hideToken') : t('settings.yTrackerTab.showToken')
              }
              className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2"
              title={showToken ? t('settings.yTrackerTab.hide') : t('settings.yTrackerTab.show')}
              type="button"
              onClick={() => setShowToken(!showToken)}
            >
              <Icon className="h-5 w-5" name={showToken ? 'eye-off' : 'eye'} />
            </HeaderIconButton>
          </div>
          <Button
            className="gap-2 whitespace-nowrap"
            disabled={isValidating}
            type="button"
            variant="primary"
            onClick={handleSave}
          >
            {isValidating ? (
              <>
                <Icon className="h-4 w-4 animate-spin" name="loader" />
                {t('settings.yTrackerTab.validating')}
              </>
            ) : (
              t('settings.yTrackerTab.save')
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <Icon
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              name="alert-circle"
            />
            <span>{error}</span>
          </p>
        )}
        {token && !error && (
          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <Icon className="w-4 h-4" name="check-circle" />
            {t('settings.yTrackerTab.tokenSaved')}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <a
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            href={`https://oauth.yandex.ru/authorize?response_type=token&client_id=${YANDEX_OAUTH_CLIENT_ID}&scope=tracker:read+tracker:write`}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('settings.yTrackerTab.getTokenLink')}
          </a>
        </p>
      </div>
    </div>
  );
}
