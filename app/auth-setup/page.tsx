'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { BeerLottie } from '@/components/BeerLottie';
import { Button } from '@/components/Button';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { ProductPlannerTenantBar } from '@/components/ProductPlannerTenantBar';
import { useI18n } from '@/contexts/LanguageContext';
import { YANDEX_OAUTH_CLIENT_ID } from '@/constants';
import { useTrackerTokenStorage } from '@/hooks/useLocalStorage';
import { useProductTenantOrganizations } from '@/hooks/useProductTenantOrganizations';
import { validateToken } from '@/lib/beerTrackerApi';

export default function AuthSetupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [, setToken] = useTrackerTokenStorage();
  const productTenant = useProductTenantOrganizations({ pollIntervalMs: 0 });

  const [localToken, setLocalToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [onPremGate, setOnPremGate] = useState<{
    firstRun: boolean;
    loading: boolean;
    organizationId: string | null;
  }>({ loading: true, firstRun: false, organizationId: null });

  useEffect(() => {
    let cancelled = false;
    async function loadOnPremOrg() {
      try {
        const setupRes = await fetch('/api/onprem/setup-state', { credentials: 'include' });
        if (!setupRes.ok) {
          if (!cancelled) {
            setOnPremGate({ loading: false, firstRun: false, organizationId: null });
          }
          return;
        }
        const setup = (await setupRes.json()) as { hasUsers?: boolean; onPremMode?: boolean };
        if (!setup.onPremMode) {
          if (!cancelled) {
            setOnPremGate({ loading: false, firstRun: false, organizationId: null });
          }
          return;
        }
        if (setup.hasUsers !== true) {
          if (!cancelled) {
            setOnPremGate({ loading: false, firstRun: true, organizationId: null });
          }
          return;
        }
        const orgRes = await fetch('/api/onprem/default-organization', { credentials: 'include' });
        if (!orgRes.ok) {
          if (!cancelled) {
            setOnPremGate({ loading: false, firstRun: false, organizationId: null });
          }
          return;
        }
        const orgJson = (await orgRes.json()) as { organizationId?: string };
        if (!cancelled) {
          setOnPremGate({
            firstRun: false,
            loading: false,
            organizationId: orgJson.organizationId?.trim() || null,
          });
        }
      } catch {
        if (!cancelled) {
          setOnPremGate({ loading: false, firstRun: false, organizationId: null });
        }
      }
    }
    void loadOnPremOrg();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onPremGate.loading && onPremGate.firstRun) {
      router.replace('/register?next=/admin');
    }
  }, [onPremGate.firstRun, onPremGate.loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!localToken.trim()) {
      return;
    }
    const orgIdForToken = productTenant.activeOrganizationId ?? onPremGate.organizationId;
    if (!orgIdForToken) {
      setError(t('auth.setup.chooseOrganizationFirst'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Валидируем токен перед сохранением
      const result = await validateToken(localToken, {
        organizationId: orgIdForToken,
      });

      if (!result.valid) {
        setError(result.error || t('auth.setup.invalidToken'));
        setIsLoading(false);
        return;
      }

      if (onPremGate.organizationId && !productTenant.signedIn) {
        const sessionRes = await fetch('/api/auth/onprem/tracker-session', {
          body: JSON.stringify({
            organizationId: orgIdForToken,
            token: localToken.trim(),
          }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const sessionJson = (await sessionRes.json()) as { error?: string };
        if (!sessionRes.ok) {
          setError(sessionJson.error ?? t('auth.setup.validationError'));
          setIsLoading(false);
          return;
        }
      }

      // Если токен валидный, сохраняем его
      setToken(localToken.trim(), orgIdForToken);

      // Небольшая задержка для сохранения в localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      // Перенаправляем на главную страницу
      router.push('/');
    } catch (error) {
      console.error('Error validating token:', error);
      setError(t('auth.setup.validationError'));
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const onPremGateResolved = !onPremGate.loading;
  const showAuthSetupSpinner =
    !onPremGateResolved ||
    onPremGate.firstRun ||
    (productTenant.sessionLoading && !onPremGate.organizationId && !onPremGate.firstRun);

  let cardInner: ReactNode;
  if (showAuthSetupSpinner) {
    cardInner = (
      <div className="p-12 flex flex-col items-center gap-4">
        <Icon className="h-10 w-10 animate-spin text-amber-600" name="loader" />
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('auth.setup.sessionLoading')}</p>
      </div>
    );
  } else if (
    !productTenant.signedIn &&
    !(onPremGate.organizationId && onPremGateResolved)
  ) {
    cardInner = (
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-700 dark:text-gray-200">
          {t('auth.setup.signInRequiredDescription')}
        </p>
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
          href="/login?next=/auth-setup"
        >
          {t('auth.setup.signInAction')}
        </Link>
      </div>
    );
  } else if (productTenant.signedIn && productTenant.organizations.length === 0) {
    cardInner = (
      <div className="p-8 text-center space-y-2">
        <p className="text-gray-700 dark:text-gray-200">
          {t('auth.setup.noOrganizationsDescription')}
        </p>
        <Link className="text-sm font-semibold text-amber-600 hover:underline" href="/register">
          {t('auth.setup.registerOrganizationAction')}
        </Link>
      </div>
    );
  } else {
    cardInner = (
      <>
        {productTenant.organizations.length > 0 ? (
          <ProductPlannerTenantBar
            activeOrganizationId={productTenant.activeOrganizationId}
            organizations={productTenant.organizations}
            sessionLoading={productTenant.sessionLoading}
            onOrganizationChange={productTenant.setActiveOrganizationId}
          />
        ) : null}
        <form className="p-8 pt-6" onSubmit={handleSubmit}>
          {/* Информационный блок */}
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/25 border border-amber-200/80 dark:border-amber-700/50 rounded-xl">
            <div className="flex gap-3">
              <Icon
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                name="info"
              />
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                {t('auth.setup.infoMessage')}
              </p>
            </div>
          </div>

          {/* Поле OAuth Token */}
          <div className="mb-6">
            <label
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              htmlFor="token"
            >
              {t('auth.setup.tokenLabel')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                autoComplete="off"
                autoFocus
                className={`w-full px-4 py-3 pr-11 text-sm border-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all ${
                  error
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                id="token"
                placeholder={t('auth.setup.tokenPlaceholder')}
                required
                type={showToken ? 'text' : 'password'}
                value={localToken}
                onChange={(e) => {
                  setLocalToken(e.target.value);
                  setError('');
                }}
              />
              <HeaderIconButton
                aria-label={showToken ? t('auth.setup.hideToken') : t('auth.setup.showToken')}
                className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-gray-500 hover:!bg-gray-200/50 dark:text-gray-400 dark:hover:!bg-gray-600/50"
                type="button"
                onClick={() => setShowToken(!showToken)}
              >
                <Icon className="h-5 w-5" name={showToken ? 'eye-off' : 'eye'} />
              </HeaderIconButton>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" name="alert-circle" />
                <span>{error}</span>
              </p>
            )}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {t('auth.setup.getTokenPrefix')}{' '}
              <a
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline font-semibold transition-colors cursor-pointer"
                href={`https://oauth.yandex.ru/authorize?response_type=token&client_id=${YANDEX_OAUTH_CLIENT_ID}&scope=tracker:read+tracker:write`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('auth.setup.oauthLink')} →
              </a>
            </p>
          </div>

          {/* Кнопка отправки */}
          <Button
            className="w-full !rounded-xl !border-0 !bg-amber-500 py-3.5 !text-sm !font-semibold !shadow-lg !shadow-amber-500/25 hover:!bg-amber-600 active:scale-[0.98] disabled:!scale-100 disabled:!cursor-not-allowed disabled:!bg-gray-400 disabled:!shadow-none dark:!shadow-amber-500/10 dark:disabled:!bg-gray-500"
            disabled={
              !localToken.trim() ||
              isLoading ||
              !(productTenant.activeOrganizationId ?? onPremGate.organizationId)
            }
            type="submit"
            variant="primary"
          >
            {isLoading ? (
              <>
                <Icon className="h-5 w-5 animate-spin" name="loader" />
                <span>{t('auth.setup.validatingToken')}</span>
              </>
            ) : (
              <>
                <Icon className="h-5 w-5" name="check" />
                <span>{t('auth.setup.continueAction')}</span>
              </>
            )}
          </Button>
        </form>
        <div className="border-t border-gray-200/80 px-8 pb-8 pt-5 text-center dark:border-gray-600/80">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span>{t('auth.setup.adminLoginHint')}</span>{' '}
            <Link
              className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
              href="/login?next=/admin"
            >
              {t('auth.setup.adminLoginLink')}
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(165deg, #f0f9ff 0%, #e0f2fe 25%, #fefce8 50%, #fef3c7 75%, #fef9c3 100%)',
      }}
    >
      {/* Тёмная тема — приглушённый градиент */}
      <div
        aria-hidden
        className="absolute inset-0 dark:block hidden pointer-events-none"
        style={{
          background:
            'linear-gradient(165deg, #0f172a 0%, #1e293b 30%, #1e3a5f 60%, #0f172a 100%)',
        }}
      />
      {/* Декоративные круги для глубины */}
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 dark:opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20 dark:opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Логотип и приветствие */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-5">
            <div className="drop-shadow-md">
              <BeerLottie size={72} />
            </div>
            <h1
              className="font-bold text-gray-900 dark:text-gray-100 text-3xl md:text-4xl drop-shadow-sm"
              style={{
                fontFamily: 'var(--font-caveat), cursive',
                fontWeight: 700,
                letterSpacing: '0.02em',
                transform: 'rotate(-1deg)',
              }}
            >
              {t('auth.setup.appTitle')}
            </h1>
          </div>
          <p className="text-2xl md:text-2xl text-gray-700 dark:text-gray-200 mt-2">
            {t('auth.setup.welcome')}
          </p>
        </div>

        {/* Карточка формы */}
        <div className="bg-white/90 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-200/80 dark:border-gray-600/80 overflow-hidden">
          {cardInner}
        </div>
      </div>
    </div>
  );
}
