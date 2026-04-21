'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  AuthBackground,
  AuthCard,
  AuthPageLoadingFallback,
  authTextLinkClassName,
} from '@/components/AuthScreenChrome';
import { BeerLottie } from '@/components/BeerLottie';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { useI18n } from '@/contexts/LanguageContext';

interface SetupStatusResponse {
  initialized?: boolean;
  onPremMode?: boolean;
  selfRegistrationAllowed?: boolean;
}

function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [setupLoading, setSetupLoading] = useState(true);
  const [onPremMode, setOnPremMode] = useState(false);
  const [setupInitialized, setSetupInitialized] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onboardingMode = onPremMode && !setupInitialized;

  useEffect(() => {
    let cancelled = false;
    async function loadSetupState() {
      try {
        const res = await fetch('/api/onprem/setup-state', { credentials: 'include' });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as SetupStatusResponse;
        if (cancelled) {
          return;
        }
        setOnPremMode(Boolean(data.onPremMode));
        setSetupInitialized(Boolean(data.initialized));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          setSetupLoading(false);
        }
      }
    }
    void loadSetupState();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: { email: string; orgName?: string; password: string } = { email, password };
      if (onboardingMode) {
        body.orgName = organizationName;
      }
      const res = await fetch('/api/auth/register', {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t('productAuth.register.genericError'));
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(t('productAuth.register.networkError'));
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const submitLabel = onboardingMode
    ? 'Создать администратора и организацию'
    : t('productAuth.register.submit');

  if (setupLoading) {
    return <AuthPageLoadingFallback />;
  }

  if (onPremMode && setupInitialized) {
    return (
      <AuthBackground>
        <AuthCard>
          <div className="mb-6 flex justify-center">
            <BeerLottie size={88} />
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
            Регистрация закрыта
          </h1>
          <p className="mt-3 text-center text-sm text-gray-700 dark:text-gray-300">
            On-prem система уже инициализирована. Новые пользователи добавляются через приглашения администратором
            организации.
          </p>
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Перейти ко входу:{' '}
            <Link className={authTextLinkClassName} href={loginHref}>
              {t('productAuth.register.signInLink')}
            </Link>
          </p>
        </AuthCard>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <AuthCard>
        <div className="mb-6 flex justify-center">
          <BeerLottie size={88} />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
          {onboardingMode ? 'Первичная настройка компании' : t('productAuth.register.title')}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-700 dark:text-gray-300">
          {onboardingMode
            ? 'Создайте первую организацию и администратора системы.'
            : t('productAuth.register.tagline')}
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {onboardingMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="reg-org-name">
                Название организации
              </label>
              <Input
                className="mt-1"
                id="reg-org-name"
                required
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="reg-email">
              Email
            </label>
            <Input
              autoComplete="email"
              className="mt-1"
              id="reg-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="reg-password">
              {t('productAuth.register.password')}
            </label>
            <div className="mt-1">
              <PasswordInput
                autoComplete="new-password"
                id="reg-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/45 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          <Button className="w-full" disabled={loading} type="submit" variant="primary">
            {loading ? t('productAuth.register.submitLoading') : submitLabel}
          </Button>
        </form>
        {!onboardingMode ? (
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('productAuth.register.footerPrompt')}{' '}
            <Link className={authTextLinkClassName} href={loginHref}>
              {t('productAuth.register.signInLink')}
            </Link>
          </p>
        ) : null}
      </AuthCard>
    </AuthBackground>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthPageLoadingFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
