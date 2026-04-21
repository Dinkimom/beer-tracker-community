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
}

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [setupLoading, setSetupLoading] = useState(true);
  const [onPremMode, setOnPremMode] = useState(false);
  const [setupInitialized, setSetupInitialized] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!setupLoading && onPremMode && !setupInitialized) {
      router.replace(`/register?next=${encodeURIComponent(next)}`);
    }
  }, [next, onPremMode, router, setupInitialized, setupLoading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t('productAuth.login.genericError'));
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(t('productAuth.login.networkError'));
    } finally {
      setLoading(false);
    }
  }

  const registerHref = `/register?next=${encodeURIComponent(next)}`;

  if (setupLoading || (onPremMode && !setupInitialized)) {
    return <AuthPageLoadingFallback />;
  }

  return (
    <AuthBackground>
      <AuthCard>
        <div className="mb-6 flex justify-center">
          <BeerLottie size={88} />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-gray-100">
          {t('productAuth.login.title')}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-700 dark:text-gray-300">
          {t('productAuth.login.tagline')}
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="email">
              Email
            </label>
            <Input
              autoComplete="email"
              className="mt-1"
              id="email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="password">
              {t('productAuth.login.password')}
            </label>
            <div className="mt-1">
              <PasswordInput
                autoComplete="current-password"
                id="password"
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
            {loading ? t('productAuth.login.submitLoading') : t('productAuth.login.submit')}
          </Button>
        </form>
        {!onPremMode ? (
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('productAuth.login.footerPrompt')}{' '}
            <Link className={authTextLinkClassName} href={registerHref}>
              {t('productAuth.login.registerLink')}
            </Link>
          </p>
        ) : null}
      </AuthCard>
    </AuthBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}
