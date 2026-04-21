'use client';

import type { OrgMemberRole } from '@/lib/organizations/types';
import type { RoleCatalogEntry } from '@/lib/roles/catalog';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/Button';
import {
  type ConfirmDialogPromptOptions,
  useConfirmDialog,
} from '@/components/ConfirmDialog';
import { CustomSelect, type CustomSelectOption } from '@/components/CustomSelect';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import {
  adminListRow,
  cardBody,
  cardHeader,
  cardShell,
  hCard,
  label,
  muted,
} from '@/features/admin/adminUiTokens';
import { AdminUserSelector } from '@/features/admin/components/AdminUserSelector';

type InviteOrgRole = Extract<OrgMemberRole, 'member' | 'team_lead'>;

/** Строка таблицы «Пользователи»: одна линия, горизонтальный скролл на узких экранах */
const usersOrgRowGrid =
  'grid min-w-[780px] grid-cols-[minmax(0,1.28fr)_minmax(10rem,0.4fr)_minmax(0,1fr)_minmax(7.5rem,0.36fr)_minmax(6.25rem,auto)] items-center gap-x-3';

const usersOrgTableHeader =
  'border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400';

export interface OrganizationUserTeam {
  isTeamLead: boolean;
  isTeamMember: boolean;
  teamId: string;
  title: string;
}

export interface OrganizationUserRow {
  addedAt: string;
  email: string;
  hasTeamMembership: boolean;
  orgRole: OrgMemberRole;
  teams: OrganizationUserTeam[];
  userId: string;
}

export interface TeamOption {
  active: boolean;
  id: string;
  title: string;
}

interface AdminOrganizationUsersClientProps {
  currentUserId: string;
  initialMembers: OrganizationUserRow[];
  initialTeams: TeamOption[];
  orgId: string;
}

export function AdminOrganizationUsersClient({
  currentUserId,
  initialMembers,
  initialTeams,
  orgId,
}: AdminOrganizationUsersClientProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState(initialMembers);
  const [loading, setLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const { confirm, DialogComponent } = useConfirmDialog();

  const soleOrgAdminUserId = useMemo(() => {
    const admins = members.filter((m) => m.orgRole === 'org_admin');
    return admins.length === 1 ? admins[0]!.userId : null;
  }, [members]);

  const inviteOrgRoleOptions = useMemo(
    (): CustomSelectOption<InviteOrgRole>[] => [
      { label: t('admin.membersPage.orgRoleMember'), value: 'member' },
      { label: t('admin.membersPage.orgRoleTeamLead'), value: 'team_lead' },
    ],
    [t],
  );

  const teamInviteOptions = useMemo((): CustomSelectOption<string>[] => {
    const rows = initialTeams.map((team) => ({
      label: team.active ? team.title : `${team.title}${t('admin.membersPage.teamInactiveSuffix')}`,
      value: team.id,
    }));
    if (rows.length === 0) {
      return [];
    }
    return [{ label: t('admin.membersPage.teamNoneOption'), value: '' }, ...rows];
  }, [initialTeams, t]);

  const [inviteTrackerUserId, setInviteTrackerUserId] = useState('');
  const [inviteUserMeta, setInviteUserMeta] = useState<{
    displayName?: string;
    email?: string | null;
  } | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteOrgRole, setInviteOrgRole] = useState<InviteOrgRole>('member');
  const [inviteCatalogRoleSlug, setInviteCatalogRoleSlug] = useState('');
  const [inviteCatalogRoleOptions, setInviteCatalogRoleOptions] = useState<CustomSelectOption<string>[]>([
    { label: '', value: '' },
  ]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  useEffect(() => {
    setInviteTeamId((prev) => {
      if (!prev) return prev;
      if (initialTeams.some((t) => t.id === prev)) return prev;
      return '';
    });
  }, [initialTeams]);

  useEffect(() => {
    if (!inviteTeamId) {
      setInviteCatalogRoleSlug('');
    }
  }, [inviteTeamId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    async function loadInviteRoleCatalog() {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/roles`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { roles?: RoleCatalogEntry[] };
        if (cancelled || !Array.isArray(data.roles)) return;
        setInviteCatalogRoleOptions([
          { label: t('admin.teamDetail.noRole'), value: '' },
          ...data.roles.map((r) => ({ label: r.title, value: r.slug })),
        ]);
      } catch {
        /* ignore */
      }
    }

    void loadInviteRoleCatalog();
    return () => {
      cancelled = true;
    };
  }, [orgId, t]);

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members`, {
        credentials: 'include',
      });
      const data = (await res.json()) as {
        error?: string;
        members?: OrganizationUserRow[];
      };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.loadListFailed'));
        return;
      }
      setMembers(data.members ?? []);
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  const hasAnyRows = members.length > 0;
  const inviteEmailReady = Boolean(inviteUserMeta?.email?.trim());

  const addUserFromTracker = useCallback(async () => {
    const email = inviteUserMeta?.email?.trim();
    if (!email) {
      toast.error(t('admin.membersPage.noTrackerEmail'));
      return;
    }
    const tid = inviteTrackerUserId.trim();
    if (!tid) {
      toast.error(t('admin.teamDetail.noTrackerIdForDirectAdd'));
      return;
    }
    if (inviteTeamId && !initialTeams.some((team) => team.id === inviteTeamId)) {
      toast.error(t('admin.membersPage.selectTeam'));
      return;
    }
    setInviteSubmitting(true);
    try {
      const name = inviteUserMeta?.displayName?.trim();
      const body: Record<string, unknown> = {
        email,
        org_role: inviteOrgRole,
        tracker_user_id: tid,
      };
      if (name) {
        body.display_name = name;
      }
      if (inviteTeamId) {
        body.team_id = inviteTeamId;
        const slug = inviteCatalogRoleSlug.trim();
        if (slug) {
          body.role_slug = slug;
        }
      }
      const res = await fetch(`/api/admin/organizations/${orgId}/members`, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.inviteSendFailed'));
        return;
      }
      toast.success(t('admin.membersPage.inviteCreatedSuccess'));
      setInviteTrackerUserId('');
      setInviteUserMeta(null);
      setInviteTeamId('');
      setInviteOrgRole('member');
      setInviteCatalogRoleSlug('');
      await loadMembers();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setInviteSubmitting(false);
    }
  }, [
    inviteCatalogRoleSlug,
    inviteOrgRole,
    inviteTeamId,
    inviteTrackerUserId,
    inviteUserMeta,
    initialTeams,
    loadMembers,
    orgId,
    t,
  ]);

  if (!orgId) {
    return <p className={muted}>{t('admin.membersPage.selectOrgInHeader')}</p>;
  }

  return (
    <>
      <div className="space-y-6">
      <section className={cardShell}>
        <div
          className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6`}
        >
          <div className="min-w-0">
            <h1 className={hCard}>{t('admin.membersPage.title')}</h1>
            <p className={`mt-1 ${muted}`}>{t('admin.membersPage.subtitle')}</p>
          </div>
          <Button
            className="shrink-0 self-start px-3.5 py-2 sm:self-auto"
            disabled={loading}
            type="button"
            variant="outline"
            onClick={() => void loadMembers()}
          >
            {loading ? t('admin.membersPage.refreshLoading') : t('admin.membersPage.refreshIdle')}
          </Button>
        </div>
        <div className={`${cardBody} space-y-4`}>
          <div className="rounded-lg border border-gray-200 border-dashed bg-gray-50/80 px-4 py-4 dark:border-gray-600 dark:bg-gray-900/20">
            <p className={`mb-3 text-sm font-medium text-gray-800 dark:text-gray-200`}>
              {t('admin.membersPage.inviteSectionTitle')}
            </p>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="min-w-0 flex-1 lg:min-w-[14rem] lg:max-w-md">
                <p className={`${label} mb-1`}>{t('admin.membersPage.trackerUserLabel')}</p>
                <AdminUserSelector
                  orgId={orgId}
                  value={inviteTrackerUserId}
                  onChange={(trackerId, user) => {
                    setInviteTrackerUserId(trackerId);
                    setInviteUserMeta(
                      user ? { displayName: user.displayName, email: user.email } : null
                    );
                  }}
                />
              </div>
              <div className="w-full min-w-0 lg:w-44">
                <p className={`${label} mb-1`}>{t('admin.membersPage.systemRoleLabel')}</p>
                <CustomSelect<InviteOrgRole>
                  className="w-full"
                  options={inviteOrgRoleOptions}
                  selectedPrefix=""
                  title={t('admin.membersPage.systemRoleLabel')}
                  value={inviteOrgRole}
                  onChange={(r) => setInviteOrgRole(r)}
                />
              </div>
              {initialTeams.length > 0 ? (
                <>
                  <div className="w-full min-w-0 lg:w-52">
                    <p className={`${label} mb-1`}>{t('admin.membersPage.teamLabel')}</p>
                    <CustomSelect<string>
                      className="w-full"
                      options={teamInviteOptions}
                      selectedPrefix=""
                      title={t('admin.membersPage.teamInviteTitle')}
                      value={inviteTeamId}
                      onChange={(id) => setInviteTeamId(id)}
                    />
                  </div>
                  <div className="w-full min-w-0 lg:w-56">
                    <p className={`${label} mb-1`}>{t('admin.membersPage.catalogTeamRoleLabel')}</p>
                    <CustomSelect<string>
                      className="w-full"
                      disabled={!inviteTeamId}
                      options={inviteCatalogRoleOptions}
                      selectedPrefix=""
                      title={t('admin.membersPage.catalogTeamRoleInviteTitle')}
                      value={inviteCatalogRoleSlug}
                      onChange={(slug) => setInviteCatalogRoleSlug(slug)}
                    />
                  </div>
                </>
              ) : (
                <p className={`max-w-md text-sm ${muted}`}>{t('admin.membersPage.needTeamBeforeAdd')}</p>
              )}
              <Button
                className="w-full px-3.5 py-2 lg:w-auto"
                disabled={inviteSubmitting || !inviteEmailReady || !inviteTrackerUserId.trim()}
                type="button"
                variant="primary"
                onClick={() => void addUserFromTracker()}
              >
                {inviteSubmitting ? t('admin.membersPage.inviteSubmitting') : t('admin.membersPage.inviteSubmit')}
              </Button>
            </div>
          </div>

          {!loading && !hasAnyRows ? (
            <p className={muted}>{t('admin.membersPage.emptyState')}</p>
          ) : null}

          {hasAnyRows ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900/35">
              <div className={`${usersOrgTableHeader} ${usersOrgRowGrid}`}>
                <span>{t('admin.membersPage.tableUser')}</span>
                <span className="min-w-0 leading-tight">{t('admin.membersPage.tableRole')}</span>
                <span>{t('admin.membersPage.tableTeam')}</span>
                <span className="min-w-0 leading-tight">{t('admin.membersPage.tableStatus')}</span>
                <span className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.membersPage.tableActions')}
                </span>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {members.flatMap((m) => {
                  if (!m.hasTeamMembership) {
                    return [
                      <AssignGridRow
                        key={m.userId}
                        confirm={confirm}
                        currentUserId={currentUserId}
                        deletingUserId={deletingUserId}
                        gridClass={usersOrgRowGrid}
                        member={m}
                        orgId={orgId}
                        setDeletingUserId={setDeletingUserId}
                        showDeleteUser
                        soleOrgAdminUserId={soleOrgAdminUserId}
                        teams={initialTeams}
                        onUpdated={() => void loadMembers()}
                      />,
                    ];
                  }
                  const teamsEditable = m.teams.filter((t) => t.teamId);
                  if (teamsEditable.length > 0) {
                    return teamsEditable.map((t, idx) => (
                      <PlannerTeamRow
                        key={`${m.userId}-${t.teamId}`}
                        confirm={confirm}
                        currentUserId={currentUserId}
                        deletingUserId={deletingUserId}
                        gridClass={usersOrgRowGrid}
                        member={m}
                        orgId={orgId}
                        setDeletingUserId={setDeletingUserId}
                        showDeleteUser={idx === 0}
                        soleOrgAdminUserId={soleOrgAdminUserId}
                        team={t}
                        teams={initialTeams}
                        onUpdated={() => void loadMembers()}
                      />
                    ));
                  }
                  if (m.teams.length > 0) {
                    return [
                      <ReadonlyTeamsGridRow
                        key={m.userId}
                        confirm={confirm}
                        currentUserId={currentUserId}
                        deletingUserId={deletingUserId}
                        gridClass={usersOrgRowGrid}
                        line={formatTeamsReadonlyLine(m, t)}
                        member={m}
                        orgId={orgId}
                        setDeletingUserId={setDeletingUserId}
                        showDeleteUser
                        soleOrgAdminUserId={soleOrgAdminUserId}
                        onUpdated={() => void loadMembers()}
                      />,
                    ];
                  }
                  return [
                    <BrokenTeamsGridRow
                      key={m.userId}
                      confirm={confirm}
                      currentUserId={currentUserId}
                      deletingUserId={deletingUserId}
                      gridClass={usersOrgRowGrid}
                      member={m}
                      orgId={orgId}
                      setDeletingUserId={setDeletingUserId}
                      showDeleteUser
                      soleOrgAdminUserId={soleOrgAdminUserId}
                      onUpdated={() => void loadMembers()}
                    />,
                  ];
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
      </div>
      {DialogComponent}
    </>
  );
}

function formatTeamsReadonlyLine(
  member: OrganizationUserRow,
  tr: (key: string, params?: Record<string, number | string>) => string,
): string {
  return member.teams
    .map((team) => {
      const role = team.isTeamLead
        ? tr('admin.membersPage.teamsLineLead')
        : tr('admin.membersPage.teamsLineMember');
      return `${team.title} (${role})`;
    })
    .join(' · ');
}

function normalizeOrgRole(role: OrgMemberRole | string): OrgMemberRole {
  if (role === 'org_admin') return 'org_admin';
  if (role === 'team_lead') return 'team_lead';
  return 'member';
}

function orgRoleOptions(
  tr: (key: string, params?: Record<string, number | string>) => string,
): CustomSelectOption<OrgMemberRole>[] {
  return [
    { label: tr('admin.membersPage.orgRoleMember'), value: 'member' },
    { label: tr('admin.membersPage.orgRoleTeamLead'), value: 'team_lead' },
    { label: tr('admin.membersPage.orgRoleOrgAdmin'), value: 'org_admin' },
  ];
}

function orgRoleLabel(
  role: OrgMemberRole,
  tr: (key: string, params?: Record<string, number | string>) => string,
): string {
  const v = normalizeOrgRole(role);
  return orgRoleOptions(tr).find((o) => o.value === v)?.label ?? v;
}

function MemberTeamColumnSelect({
  memberEmail,
  memberUserId,
  onUpdated,
  orgId,
  selectedTeamId,
  teams,
}: {
  memberEmail: string;
  memberUserId: string;
  onUpdated: () => void;
  orgId: string;
  /** Пустая строка — «Без команды» */
  selectedTeamId: string;
  teams: TeamOption[];
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const options = useMemo((): CustomSelectOption<string>[] => {
    if (teams.length === 0) {
      return [];
    }
    return [
      { label: t('admin.membersPage.teamNoneOption'), value: '' },
      ...teams.map((team) => ({
        label: team.active ? team.title : `${team.title}${t('admin.membersPage.teamDisabledInSelect')}`,
        value: team.id,
      })),
    ];
  }, [teams, t]);

  async function apply(nextTeamId: string) {
    if (nextTeamId === selectedTeamId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${memberUserId}/team`, {
        body: JSON.stringify({ team_id: nextTeamId === '' ? null : nextTeamId }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.teamChangeFailed'));
        return;
      }
      toast.success(t('admin.membersPage.teamChangeSuccess'));
      onUpdated();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setBusy(false);
    }
  }

  if (teams.length === 0) {
    return <span className={`text-sm ${muted}`}>{t('admin.membersPage.noTeams')}</span>;
  }

  return (
    <div className={`min-w-0 max-w-[16rem] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      <CustomSelect<string>
        className="w-full"
        disabled={busy}
        options={options}
        selectedPrefix=""
        title={t('admin.membersPage.assignTeamAria', { email: memberEmail })}
        value={selectedTeamId || ''}
        onChange={(id) => void apply(id)}
      />
    </div>
  );
}

function UserDeleteControl({
  confirm,
  currentUserId,
  deletingUserId,
  email,
  orgId,
  setDeletingUserId,
  show,
  soleOrgAdminUserId,
  userId,
  onDeleted,
}: {
  confirm: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
  currentUserId: string;
  deletingUserId: string | null;
  email: string;
  orgId: string;
  setDeletingUserId: (id: string | null) => void;
  show: boolean;
  soleOrgAdminUserId: string | null;
  userId: string;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  if (!show) {
    return <span className={`justify-self-center text-xs ${muted}`}>—</span>;
  }

  const isSelf = userId === currentUserId;
  const isSoleAdmin = soleOrgAdminUserId != null && userId === soleOrgAdminUserId;
  const busy = deletingUserId === userId;

  async function remove() {
    if (isSelf || isSoleAdmin) return;
    const ok = await confirm(t('admin.membersPage.deleteUserMessage', { email }), {
      confirmText: t('common.delete'),
      title: t('admin.membersPage.deleteUserTitle'),
      variant: 'destructive',
    });
    if (!ok) return;
    setDeletingUserId(userId);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${userId}`, {
        credentials: 'include',
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.userDeleteFailed'));
        return;
      }
      toast.success(t('admin.membersPage.userDeleted'));
      onDeleted();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setDeletingUserId(null);
    }
  }

  if (isSelf) {
    return (
      <span
        className={`justify-self-center text-xs ${muted}`}
        title={t('admin.membersPage.cannotDeleteSelfTitle')}
      >
        —
      </span>
    );
  }

  if (isSoleAdmin) {
    return (
      <span
        className={`justify-self-center text-xs ${muted}`}
        title={t('admin.membersPage.cannotDeleteSoleAdminTitle')}
      >
        —
      </span>
    );
  }

  return (
    <div className="flex justify-center">
      <Button
        className="!px-2 !py-1.5 text-xs"
        disabled={busy}
        title={t('admin.membersPage.deleteAccountTitle')}
        type="button"
        variant="danger"
        onClick={() => void remove()}
      >
        {busy ? (
          <Icon className="h-4 w-4 animate-spin" name="loader" />
        ) : (
          <Icon className="h-4 w-4" name="trash" />
        )}
      </Button>
    </div>
  );
}

function OrgRoleSelect({
  currentUserId,
  memberEmail,
  orgId,
  orgRole,
  userId,
  onUpdated,
}: {
  currentUserId: string;
  memberEmail: string;
  orgId: string;
  orgRole: OrgMemberRole;
  userId: string;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const isSelf = userId === currentUserId;
  const roleOpts = useMemo(() => orgRoleOptions(t), [t]);

  async function apply(next: OrgMemberRole) {
    const current = normalizeOrgRole(orgRole);
    if (next === current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${userId}`, {
        body: JSON.stringify({ org_role: next }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.orgRoleUpdateFailed'));
        return;
      }
      toast.success(t('admin.membersPage.orgRoleUpdated'));
      onUpdated();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setBusy(false);
    }
  }

  const value = normalizeOrgRole(orgRole);

  if (isSelf) {
    return (
      <div
        className="min-w-0"
        title={t('admin.membersPage.cannotChangeOwnRoleTitle')}
      >
        <span className="flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100">
          {orgRoleLabel(orgRole, t)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 ${busy ? 'pointer-events-none opacity-60' : ''}`}
      title={busy ? t('admin.membersPage.savingOrgRoleTitle') : undefined}
    >
      <CustomSelect<OrgMemberRole>
        className="w-full"
        options={roleOpts}
        selectedPrefix=""
        title={t('admin.membersPage.orgRoleSelectTitle', { email: memberEmail })}
        value={value}
        onChange={(next) => void apply(next)}
      />
    </div>
  );
}

function PlannerTeamRow({
  confirm,
  currentUserId,
  deletingUserId,
  gridClass,
  member,
  onUpdated,
  orgId,
  setDeletingUserId,
  showDeleteUser,
  soleOrgAdminUserId,
  team,
  teams,
}: {
  confirm: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
  currentUserId: string;
  deletingUserId: string | null;
  gridClass: string;
  member: OrganizationUserRow;
  onUpdated: () => void;
  orgId: string;
  setDeletingUserId: (id: string | null) => void;
  showDeleteUser: boolean;
  soleOrgAdminUserId: string | null;
  team: OrganizationUserTeam;
  teams: TeamOption[];
}) {
  const { t } = useI18n();
  return (
    <li className={`${adminListRow} ${gridClass} px-3 py-2`}>
      <span
        className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
        title={member.email}
      >
        {member.email}
      </span>
      <OrgRoleSelect
        currentUserId={currentUserId}
        memberEmail={member.email}
        orgId={orgId}
        orgRole={member.orgRole}
        userId={member.userId}
        onUpdated={onUpdated}
      />
      <MemberTeamColumnSelect
        memberEmail={member.email}
        memberUserId={member.userId}
        orgId={orgId}
        selectedTeamId={team.teamId}
        teams={teams}
        onUpdated={onUpdated}
      />
      <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.membersPage.inSystemStatus')}</span>
      <UserDeleteControl
        confirm={confirm}
        currentUserId={currentUserId}
        deletingUserId={deletingUserId}
        email={member.email}
        orgId={orgId}
        setDeletingUserId={setDeletingUserId}
        show={showDeleteUser}
        soleOrgAdminUserId={soleOrgAdminUserId}
        userId={member.userId}
        onDeleted={onUpdated}
      />
    </li>
  );
}

function ReadonlyTeamsGridRow({
  confirm,
  currentUserId,
  deletingUserId,
  gridClass,
  line,
  member,
  onUpdated,
  orgId,
  setDeletingUserId,
  showDeleteUser,
  soleOrgAdminUserId,
}: {
  confirm: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
  currentUserId: string;
  deletingUserId: string | null;
  gridClass: string;
  line: string;
  member: OrganizationUserRow;
  onUpdated: () => void;
  orgId: string;
  setDeletingUserId: (id: string | null) => void;
  showDeleteUser: boolean;
  soleOrgAdminUserId: string | null;
}) {
  const { t } = useI18n();
  return (
    <li className={`${adminListRow} ${gridClass} px-3 py-2`}>
      <span
        className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
        title={member.email}
      >
        {member.email}
      </span>
      <OrgRoleSelect
        currentUserId={currentUserId}
        memberEmail={member.email}
        orgId={orgId}
        orgRole={member.orgRole}
        userId={member.userId}
        onUpdated={onUpdated}
      />
      <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200" title={line}>
        {line}
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.membersPage.inSystemStatus')}</span>
      <UserDeleteControl
        confirm={confirm}
        currentUserId={currentUserId}
        deletingUserId={deletingUserId}
        email={member.email}
        orgId={orgId}
        setDeletingUserId={setDeletingUserId}
        show={showDeleteUser}
        soleOrgAdminUserId={soleOrgAdminUserId}
        userId={member.userId}
        onDeleted={onUpdated}
      />
    </li>
  );
}

function BrokenTeamsGridRow({
  confirm,
  currentUserId,
  deletingUserId,
  gridClass,
  member,
  onUpdated,
  orgId,
  setDeletingUserId,
  showDeleteUser,
  soleOrgAdminUserId,
}: {
  confirm: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
  currentUserId: string;
  deletingUserId: string | null;
  gridClass: string;
  member: OrganizationUserRow;
  onUpdated: () => void;
  orgId: string;
  setDeletingUserId: (id: string | null) => void;
  showDeleteUser: boolean;
  soleOrgAdminUserId: string | null;
}) {
  const { t } = useI18n();
  return (
    <li className={`${adminListRow} ${gridClass} px-3 py-2`}>
      <span
        className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
        title={member.email}
      >
        {member.email}
      </span>
      <OrgRoleSelect
        currentUserId={currentUserId}
        memberEmail={member.email}
        orgId={orgId}
        orgRole={member.orgRole}
        userId={member.userId}
        onUpdated={onUpdated}
      />
      <span className={`text-sm ${muted}`}>—</span>
      <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.membersPage.inSystemStatus')}</span>
      <UserDeleteControl
        confirm={confirm}
        currentUserId={currentUserId}
        deletingUserId={deletingUserId}
        email={member.email}
        orgId={orgId}
        setDeletingUserId={setDeletingUserId}
        show={showDeleteUser}
        soleOrgAdminUserId={soleOrgAdminUserId}
        userId={member.userId}
        onDeleted={onUpdated}
      />
    </li>
  );
}

function AssignGridRow({
  confirm,
  currentUserId,
  deletingUserId,
  gridClass,
  member,
  onUpdated,
  orgId,
  setDeletingUserId,
  showDeleteUser,
  soleOrgAdminUserId,
  teams,
}: {
  confirm: (message: string, options?: ConfirmDialogPromptOptions) => Promise<boolean>;
  currentUserId: string;
  deletingUserId: string | null;
  gridClass: string;
  member: OrganizationUserRow;
  onUpdated: () => void;
  orgId: string;
  setDeletingUserId: (id: string | null) => void;
  showDeleteUser: boolean;
  soleOrgAdminUserId: string | null;
  teams: TeamOption[];
}) {
  const { t } = useI18n();
  return (
    <li className={`${adminListRow} ${gridClass} px-3 py-2`}>
      <span
        className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
        title={member.email}
      >
        {member.email}
      </span>
      <OrgRoleSelect
        currentUserId={currentUserId}
        memberEmail={member.email}
        orgId={orgId}
        orgRole={member.orgRole}
        userId={member.userId}
        onUpdated={onUpdated}
      />
      {teams.length === 0 ? (
        <span className={`text-sm ${muted}`}>{t('admin.membersPage.noTeams')}</span>
      ) : (
        <MemberTeamColumnSelect
          memberEmail={member.email}
          memberUserId={member.userId}
          orgId={orgId}
          selectedTeamId=""
          teams={teams}
          onUpdated={onUpdated}
        />
      )}
      <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.membersPage.inSystemStatus')}</span>
      <UserDeleteControl
        confirm={confirm}
        currentUserId={currentUserId}
        deletingUserId={deletingUserId}
        email={member.email}
        orgId={orgId}
        setDeletingUserId={setDeletingUserId}
        show={showDeleteUser}
        soleOrgAdminUserId={soleOrgAdminUserId}
        userId={member.userId}
        onDeleted={onUpdated}
      />
    </li>
  );
}
