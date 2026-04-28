'use client';

import type { UserOrganizationSummary } from '@/lib/organizations';
import type { ReactNode } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { AdminHeader } from '@/features/admin/AdminHeader';
import { useAdminOrganizationId } from '@/features/admin/AdminOrganizationIdContext';
import { AdminOrganizationSelector } from '@/features/admin/components/AdminOrganizationSelector';
import { useAdminTrackerConnectionReady } from '@/features/admin/hooks/useAdminTrackerConnectionReady';
import { resolvePrimaryAdminOrganization } from '@/lib/access/resolvePrimaryAdminOrganization';
import { PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY } from '@/lib/tenantHttpConstants';

interface NavItem {
  href: string;
  icon: string;
  /** i18n key under messages, e.g. `admin.shell.nav.organization` */
  labelKey: string;
  /** Needs saved OAuth token and Cloud Organization ID (Yandex Tracker section). */
  requiresTracker?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/org', icon: 'home', labelKey: 'admin.shell.nav.organization' },
  { href: '/admin/teams', icon: 'users', labelKey: 'admin.shell.nav.teams' },
  { href: '/admin/members', icon: 'user', labelKey: 'admin.shell.nav.members' },
  { href: '/admin/tracker', icon: 'link', labelKey: 'admin.shell.nav.tracker' },
  { href: '/admin/roles', icon: 'hash', labelKey: 'admin.shell.nav.roles' },
  { href: '/admin/sync', icon: 'refresh', labelKey: 'admin.shell.nav.sync', requiresTracker: true },
];

interface AdminShellProps {
  children: ReactNode;
  email: string;
  exporterEnabled: boolean;
  isSuperAdmin: boolean;
  orgs: UserOrganizationSummary[];
}

function displayOrgMemberRole(role: string, has: (key: string) => boolean, t: (key: string) => string): string {
  const key = `admin.shell.orgRole.${role}`;
  return has(key) ? t(key) : role;
}

export function AdminShell({ children, email, exporterEnabled, isSuperAdmin, orgs }: AdminShellProps) {
  const { has, t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const connectOrgId = useAdminOrganizationId();
  const activeOrg = useMemo(
    () =>
      orgs.find((o) => o.organization_id === connectOrgId) ?? resolvePrimaryAdminOrganization(orgs),
    [connectOrgId, orgs]
  );
  const canAdmin = Boolean(activeOrg);
  const isOrgAdminForActive = activeOrg?.role === 'org_admin';

  const { loading: trackerGateLoading, ready: trackerConnectionReady } =
    useAdminTrackerConnectionReady(canAdmin && connectOrgId ? connectOrgId : '');

  useEffect(() => {
    if (!connectOrgId) return;
    try {
      localStorage.setItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY, connectOrgId);
    } catch {
      /* ignore */
    }
  }, [connectOrgId]);

  function makeNavHref(href: string) {
    return href;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const activeSection = NAV_ITEMS.find((item) => pathname.startsWith(item.href));

  const navList = (
    <nav aria-label={t('admin.shell.navAriaLabel')} className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          if (!exporterEnabled && item.href === '/admin/sync') return null;
          if (!activeOrg?.canAccessAdmin) return null;
          const teamLeadAllowed = item.href === '/admin/teams';
          if (!isOrgAdminForActive && !teamLeadAllowed) return null;
          const isActive = pathname.startsWith(item.href);
          const showTrackerIncomplete =
            item.href === '/admin/tracker' &&
            isOrgAdminForActive &&
            Boolean(connectOrgId) &&
            !trackerGateLoading &&
            !trackerConnectionReady;
          const trackerLocked =
            Boolean(item.requiresTracker) &&
            connectOrgId &&
            (trackerGateLoading || !trackerConnectionReady);

          if (trackerLocked) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  className={[
                    'flex w-full cursor-not-allowed items-center gap-3 rounded-lg border-l-2 border-transparent py-2.5 pl-2.5 pr-3 text-left text-sm font-medium text-gray-400 opacity-80 dark:text-gray-500',
                  ].join(' ')}
                  title={t('admin.shell.trackerNavLockTitle')}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-gray-400 dark:text-gray-500" name={item.icon} />
                  <span className="flex-1 truncate">{t(item.labelKey)}</span>
                  <Icon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" name="lock" />
                </span>
              </li>
            );
          }

          const trackerIncompleteActive = isActive && showTrackerIncomplete;

          let navLinkSurface: string;
          if (trackerIncompleteActive) {
            navLinkSurface =
              'border-amber-500 bg-amber-100 text-amber-950 focus-visible:ring-amber-500 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-50';
          } else if (isActive) {
            navLinkSurface =
              'border-blue-600 bg-blue-100 text-blue-800 focus-visible:ring-blue-500 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100';
          } else {
            navLinkSurface =
              'border-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-white/[0.04] dark:hover:text-gray-100';
          }

          let navLeadIconTone: string;
          if (trackerIncompleteActive) {
            navLeadIconTone = 'text-amber-700 dark:text-amber-300';
          } else if (isActive) {
            navLeadIconTone = 'text-blue-600 dark:text-blue-300';
          } else {
            navLeadIconTone = 'text-gray-500 dark:text-gray-400';
          }

          const navAlertIconTone = trackerIncompleteActive
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-amber-600 dark:text-amber-400';

          return (
            <li key={item.href}>
              <Link
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  showTrackerIncomplete ? t('admin.shell.trackerIncompleteAria') : undefined
                }
                className={[
                  'flex w-full cursor-pointer items-center gap-3 rounded-lg border-l-2 py-2.5 pl-2.5 pr-3 text-left text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2',
                  navLinkSurface,
                ].join(' ')}
                href={makeNavHref(item.href)}
                title={showTrackerIncomplete ? t('admin.shell.trackerIncompleteTitle') : undefined}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon className={['h-[18px] w-[18px] shrink-0', navLeadIconTone].join(' ')} name={item.icon} />
                <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                {showTrackerIncomplete ? (
                  <span aria-hidden className="inline-flex shrink-0">
                    <Icon className={['h-4 w-4', navAlertIconTone].join(' ')} name="alert-triangle" />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-ds-border-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{email}</p>
          {activeOrg ? (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {isSuperAdmin ? t('admin.shell.superAdmin') : displayOrgMemberRole(activeOrg.role, has, t)}
            </p>
          ) : null}
        </div>
        <HeaderIconButton
          aria-label={t('admin.shell.logoutAria')}
          title={t('admin.shell.logout')}
          type="button"
          onClick={() => void logout()}
        >
          <Icon className="h-4 w-4" name="log-out" />
        </HeaderIconButton>
      </div>
    </div>
  );

  const sidebarContent = (
    <>
      {navList}
      {sidebarFooter}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <AdminHeader
        canAdmin={canAdmin}
        organizationName={activeOrg?.name ?? null}
        organizationSelector={
          isSuperAdmin ? (
            <AdminOrganizationSelector
              organizations={orgs}
              selectedOrganizationId={connectOrgId}
            />
          ) : undefined
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-ds-border-subtle bg-gray-50 dark:bg-gray-800/70 md:flex">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 cursor-pointer bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-shrink-0 items-center justify-between border-b border-ds-border-subtle px-4 py-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('admin.shell.mobileMenuTitle')}
                </span>
                <HeaderIconButton
                  aria-label={t('admin.shell.closeMenuAria')}
                  title={t('admin.shell.closeMenu')}
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon className="h-5 w-5" name="x" />
                </HeaderIconButton>
              </div>
              {sidebarContent}
            </aside>
          </div>
        ) : null}

        {/* Main area */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-ds-border-subtle bg-ds-surface-header px-4 py-3 md:hidden">
            <HeaderIconButton
              aria-label={t('admin.shell.openMenuAria')}
              title={t('admin.shell.openMenu')}
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              <Icon className="h-5 w-5" name="menu" />
            </HeaderIconButton>
            <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {activeSection ? t(activeSection.labelKey) : t('admin.shell.defaultSectionTitle')}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain">
            <div className="px-5 py-6 sm:px-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
