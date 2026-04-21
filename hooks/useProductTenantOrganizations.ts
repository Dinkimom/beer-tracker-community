import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY } from '@/lib/tenantHttpConstants';

export type ProductSessionOrgRole = 'member' | 'org_admin' | 'team_lead';

export interface ProductSessionOrganization {
  canAccessAdmin: boolean;
  canUsePlanner: boolean;
  id: string;
  /** `null` — org_admin (все команды); иначе id команд, где пользователь тимлид. */
  managedTeamIds: string[] | null;
  name: string;
  role: ProductSessionOrgRole;
  slug: string | null;
}

interface SessionResponse {
  organizations?: Array<{
    canAccessAdmin?: boolean;
    canUsePlanner?: boolean;
    id: string;
    managedTeamIds?: string[] | null;
    name: string;
    role: ProductSessionOrgRole;
    slug: string | null;
  }>;
  user: { email: string; emailVerified: boolean; id: string } | null;
}

function readStoredOrganizationId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const v = localStorage.getItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

function writeStoredOrganizationId(id: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (!id) {
      localStorage.removeItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY);
    } else {
      localStorage.setItem(PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY, id);
    }
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key: PRODUCT_ACTIVE_ORGANIZATION_ID_STORAGE_KEY },
      })
    );
  } catch {
    /* ignore */
  }
}

function managedTeamIdsFromSessionOrg(
  o: NonNullable<SessionResponse['organizations']>[number]
): string[] | null {
  if (o.managedTeamIds !== undefined) {
    return o.managedTeamIds;
  }
  return o.role === 'org_admin' ? null : [];
}

function normalizeOrgs(raw: SessionResponse['organizations']): ProductSessionOrganization[] {
  if (!raw?.length) {
    return [];
  }
  return raw.map((o) => ({
    canAccessAdmin: o.canAccessAdmin ?? (o.role === 'org_admin' || o.role === 'team_lead'),
    canUsePlanner: o.canUsePlanner ?? true,
    id: o.id,
    managedTeamIds: managedTeamIdsFromSessionOrg(o),
    name: o.name,
    role: o.role,
    slug: o.slug,
  }));
}

export interface UseProductTenantOrganizationsResult {
  activeOrganization: ProductSessionOrganization | null;
  activeOrganizationId: string | null;
  organizations: ProductSessionOrganization[];
  /** Загрузка первого ответа сессии. */
  sessionLoading: boolean;
  signedIn: boolean;
  setActiveOrganizationId: (organizationId: string) => void;
}

const DEFAULT_POLL_MS = 30_000;

/**
 * Сессия продукта: список организаций, активный tenant в localStorage + заголовок {@link TENANT_ORG_HEADER}.
 * Периодически обновляет список организаций без перезагрузки страницы.
 */
export function useProductTenantOrganizations(options?: {
  pollIntervalMs?: number;
}): UseProductTenantOrganizationsResult {
  const queryClient = useQueryClient();
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_MS;

  const [organizations, setOrganizations] = useState<ProductSessionOrganization[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  const firstLoadDoneRef = useRef(false);

  const reconcileActiveOrg = useCallback((list: ProductSessionOrganization[]) => {
    if (list.length === 0) {
      writeStoredOrganizationId(null);
      setActiveOrganizationIdState(null);
      return;
    }
    const stored = readStoredOrganizationId();
    const next =
      stored && list.some((o) => o.id === stored) ? stored : list[0]!.id;
    if (next !== stored) {
      writeStoredOrganizationId(next);
    }
    setActiveOrganizationIdState(next);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as SessionResponse;
      const list = normalizeOrgs(data.organizations);
      setOrganizations(list);
      setSignedIn(data.user != null);
      reconcileActiveOrg(list);
    } catch {
      /* ignore */
    } finally {
      if (!firstLoadDoneRef.current) {
        firstLoadDoneRef.current = true;
        setSessionLoading(false);
      }
    }
  }, [reconcileActiveOrg]);

  useEffect(() => {
    loadSession().catch(() => {
      /* ignore */
    });
    if (pollIntervalMs <= 0) {
      return;
    }
    const id = setInterval(() => {
      loadSession().catch(() => {
        /* ignore */
      });
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [loadSession, pollIntervalMs]);

  const setActiveOrganizationId = useCallback(
    (organizationId: string) => {
      if (!organizations.some((o) => o.id === organizationId)) {
        return;
      }
      writeStoredOrganizationId(organizationId);
      setActiveOrganizationIdState(organizationId);
      queryClient.invalidateQueries().catch(() => {
        /* ignore */
      });
    },
    [organizations, queryClient]
  );

  const activeOrganization =
    activeOrganizationId != null
      ? organizations.find((o) => o.id === activeOrganizationId) ?? null
      : null;

  return {
    activeOrganization,
    activeOrganizationId,
    organizations,
    sessionLoading,
    setActiveOrganizationId,
    signedIn,
  };
}

/**
 * Только синхронизация localStorage с первой org сессии (без UI).
 * @deprecated Предпочтительнее {@link useProductTenantOrganizations} в одном месте дерева.
 */
export function useProductActiveOrganizationSync(): void {
  useProductTenantOrganizations({ pollIntervalMs: 0 });
}
