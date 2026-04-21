'use client';

import type { OrgMemberRole } from '@/lib/organizations/types';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/Button';
import {
  type ConfirmDialogPromptOptions,
  useConfirmDialog,
} from '@/components/ConfirmDialog';
import { CustomSelect, type CustomSelectOption } from '@/components/CustomSelect';
import { Icon } from '@/components/Icon';
import {
  adminListRow,
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
} from '@/features/admin/adminUiTokens';
import { AdminUserSelector } from '@/features/admin/components/AdminUserSelector';
import { useI18n } from '@/contexts/LanguageContext';

type InviteTeamRole = 'team_lead' | 'team_member';

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

export interface PendingInvitationRow {
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  invitedTeamRole: 'team_lead' | 'team_member';
  teamId: string | null;
  teamTitle: string | null;
}

export interface TeamOption {
  active: boolean;
  id: string;
  title: string;
}

interface AdminOrganizationUsersClientProps {
  currentUserId: string;
  initialMembers: OrganizationUserRow[];
  initialPendingInvitations: PendingInvitationRow[];
  initialTeams: TeamOption[];
  orgId: string;
}

export function AdminOrganizationUsersClient({
  currentUserId,
  initialMembers,
  initialPendingInvitations,
  initialTeams,
  orgId,
}: AdminOrganizationUsersClientProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvitations, setPendingInvitations] = useState(initialPendingInvitations);
  const [loading, setLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const { confirm, DialogComponent } = useConfirmDialog();

  const soleOrgAdminUserId = useMemo(() => {
    const admins = members.filter((m) => m.orgRole === 'org_admin');
    return admins.length === 1 ? admins[0]!.userId : null;
  }, [members]);

  const defaultTeamId = useMemo(() => {
    const active = initialTeams.find((t) => t.active);
    return active?.id ?? initialTeams[0]?.id ?? '';
  }, [initialTeams]);

  const inviteTeamRoleOptions = useMemo(
    (): CustomSelectOption<InviteTeamRole>[] => [
      { label: t('admin.membersPage.teamMember'), value: 'team_member' },
      { label: t('admin.membersPage.teamLead'), value: 'team_lead' },
    ],
    [t],
  );

  const teamInviteOptions = useMemo((): CustomSelectOption<string>[] => {
    return initialTeams.map((team) => ({
      label: team.active ? team.title : `${team.title}${t('admin.membersPage.teamInactiveSuffix')}`,
      value: team.id,
    }));
  }, [initialTeams, t]);

  const [inviteTrackerUserId, setInviteTrackerUserId] = useState('');
  const [inviteUserMeta, setInviteUserMeta] = useState<{
    displayName?: string;
    email?: string | null;
  } | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState(defaultTeamId);
  const [inviteTeamRole, setInviteTeamRole] = useState<InviteTeamRole>('team_member');
  const [inviteExpiresDays, setInviteExpiresDays] = useState('7');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);

  useEffect(() => {
    setInviteTeamId((prev) => {
      if (prev && initialTeams.some((t) => t.id === prev)) return prev;
      return defaultTeamId;
    });
  }, [defaultTeamId, initialTeams]);

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
        pendingInvitations?: PendingInvitationRow[];
      };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.loadListFailed'));
        return;
      }
      setMembers(data.members ?? []);
      setPendingInvitations(data.pendingInvitations ?? []);
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  const hasAnyRows = members.length > 0 || pendingInvitations.length > 0;
  const inviteEmailReady = Boolean(inviteUserMeta?.email?.trim());
  const hasInviteTeams = teamInviteOptions.length > 0;

  const sendInvitation = useCallback(async () => {
    const email = inviteUserMeta?.email?.trim();
    if (!email) {
      toast.error(t('admin.membersPage.noTrackerEmail'));
      return;
    }
    if (hasInviteTeams && !inviteTeamId) {
      toast.error(t('admin.membersPage.selectTeam'));
      return;
    }
    setInviteSubmitting(true);
    try {
      const daysRaw = inviteExpiresDays.trim();
      const daysParsed = daysRaw === '' ? undefined : Number.parseInt(daysRaw, 10);
      const body: Record<string, unknown> = {
        email,
      };
      if (hasInviteTeams) {
        body.invited_team_role = inviteTeamRole;
        body.team_id = inviteTeamId;
      }
      const tid = inviteTrackerUserId.trim();
      if (tid) {
        body.tracker_user_id = tid;
        const name = inviteUserMeta?.displayName?.trim();
        if (name) {
          body.display_name = name;
        }
      }
      if (daysParsed != null && !Number.isNaN(daysParsed)) {
        body.expiresInDays = daysParsed;
      }
      const res = await fetch(`/api/admin/organizations/${orgId}/invitations`, {
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
      await loadMembers();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setInviteSubmitting(false);
    }
  }, [
    hasInviteTeams,
    inviteExpiresDays,
    inviteTeamId,
    inviteTeamRole,
    inviteTrackerUserId,
    inviteUserMeta,
    loadMembers,
    orgId,
    t,
  ]);

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      setRevokingInvitationId(invitationId);
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/invitations/${invitationId}`, {
          credentials: 'include',
          method: 'DELETE',
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? t('admin.membersPage.revokeFailed'));
          return;
        }
        toast.success(t('admin.membersPage.inviteRevoked'));
        await loadMembers();
      } catch {
        toast.error(t('admin.common.networkError'));
      } finally {
        setRevokingInvitationId(null);
      }
    },
    [loadMembers, orgId, t]
  );

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
                  <div className="w-full min-w-0 lg:w-44">
                    <p className={`${label} mb-1`}>{t('admin.membersPage.teamRoleLabel')}</p>
                    <CustomSelect<InviteTeamRole>
                      className="w-full"
                      options={inviteTeamRoleOptions}
                      selectedPrefix=""
                      title={t('admin.membersPage.teamRoleInviteTitle')}
                      value={inviteTeamRole}
                      onChange={(r) => setInviteTeamRole(r)}
                    />
                  </div>
                </>
              ) : null}
              <div className="w-full min-w-0 lg:min-w-[12rem] lg:max-w-[16rem]">
                <label className={label} htmlFor="invite-ttl-users">
                  {t('admin.membersPage.inviteTtlLabel')}
                </label>
                <input
                  className={field}
                  id="invite-ttl-users"
                  inputMode="numeric"
                  max={90}
                  min={1}
                  placeholder="7"
                  type="number"
                  value={inviteExpiresDays}
                  onChange={(e) => setInviteExpiresDays(e.target.value)}
                />
              </div>
              <Button
                className="w-full px-3.5 py-2 lg:w-auto"
                disabled={
                  inviteSubmitting || !inviteEmailReady || (initialTeams.length > 0 && !inviteTeamId)
                }
                type="button"
                variant="primary"
                onClick={() => void sendInvitation()}
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
                {pendingInvitations.map((row) => (
                  <PendingInviteGridRow
                    key={row.id}
                    gridClass={usersOrgRowGrid}
                    revokingId={revokingInvitationId}
                    row={row}
                    onRevoke={(id) => void revokeInvitation(id)}
                    t={t}
                  />
                ))}
                {members.flatMap((m) => {
                  if (!m.hasTeamMembership) {
                    return [
                      <AssignGridRow
                        key={m.userId}
                        confirm={confirm}
                        currentUserId={currentUserId}
                        defaultTeamId={defaultTeamId}
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

function inviteDisplayRole(
  row: PendingInvitationRow,
  tr: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!row.teamId) {
    return tr('admin.membersPage.inviteToOrg');
  }
  return row.invitedTeamRole === 'team_lead'
    ? tr('admin.membersPage.teamLead')
    : tr('admin.membersPage.teamMember');
}

function PendingInviteGridRow({
  gridClass,
  onRevoke,
  revokingId,
  row,
  t,
}: {
  gridClass: string;
  onRevoke: (invitationId: string) => void;
  revokingId: string | null;
  row: PendingInvitationRow;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const expired = new Date(row.expiresAt) < new Date();
  return (
    <li className={`${adminListRow} ${gridClass} px-3 py-2`}>
      <span
        className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100"
        title={row.email}
      >
        {row.email}
      </span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{inviteDisplayRole(row, t)}</span>
      <span
        className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200"
        title={row.teamTitle ?? t('admin.membersPage.inviteToOrg')}
      >
        {row.teamTitle ?? t('admin.membersPage.inviteToOrg')}
      </span>
      <div className="min-w-0 text-sm text-gray-700 dark:text-gray-200">
        <span className="font-medium">{t('admin.membersPage.inviteSentStatus')}</span>
        {expired ? (
          <span className={`mt-0.5 block text-xs text-amber-800 dark:text-amber-200`}>
            {t('admin.membersPage.inviteExpired')}
          </span>
        ) : (
          <span className={`mt-0.5 block text-xs ${muted}`}>
            {t('admin.membersPage.inviteValidUntil', {
              date: new Date(row.expiresAt).toLocaleString(),
            })}
          </span>
        )}
      </div>
      <div className="flex justify-center">
        <Button
          className="px-2 py-1.5 text-xs"
          disabled={revokingId === row.id}
          type="button"
          variant="outline"
          onClick={() => onRevoke(row.id)}
        >
          {revokingId === row.id ? t('admin.membersPage.revoking') : t('admin.membersPage.revoke')}
        </Button>
      </div>
    </li>
  );
}

function formatTeamsReadonlyLine(
  member: OrganizationUserRow,
  tr: (key: string, params?: Record<string, string | number>) => string,
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
  tr: (key: string, params?: Record<string, string | number>) => string,
): CustomSelectOption<OrgMemberRole>[] {
  return [
    { label: tr('admin.membersPage.orgRoleMember'), value: 'member' },
    { label: tr('admin.membersPage.orgRoleTeamLead'), value: 'team_lead' },
    { label: tr('admin.membersPage.orgRoleOrgAdmin'), value: 'org_admin' },
  ];
}

function orgRoleLabel(
  role: OrgMemberRole,
  tr: (key: string, params?: Record<string, string | number>) => string,
): string {
  const v = normalizeOrgRole(role);
  return orgRoleOptions(tr).find((o) => o.value === v)?.label ?? v;
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
        className="border-red-200 px-2 py-1.5 text-xs text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
        disabled={busy}
        title={t('admin.membersPage.deleteAccountTitle')}
        type="button"
        variant="outline"
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
      <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-200" title={team.title}>
        {team.title}
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
  defaultTeamId,
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
  defaultTeamId: string;
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
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!teamId) {
      toast.error(t('admin.membersPage.selectTeam'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/assign-user-team`, {
        body: JSON.stringify({
          team_id: teamId,
          team_role: 'team_member',
          user_id: member.userId,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.membersPage.assignFailed'));
        return;
      }
      toast.success(t('admin.membersPage.assignSuccess'));
      onUpdated();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setBusy(false);
    }
  }

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
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <select
            aria-label={t('admin.membersPage.assignTeamAria', { email: member.email })}
            className={`${field} min-w-0 max-w-[14rem] flex-1`}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.title}
                {!team.active ? t('admin.membersPage.teamDisabledInSelect') : ''}
              </option>
            ))}
          </select>
          <Button
            className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs"
            disabled={busy || !teamId}
            type="button"
            variant="primary"
            onClick={() => void assign()}
          >
            {busy ? t('admin.membersPage.assignBusy') : t('admin.membersPage.assignButton')}
          </Button>
        </div>
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
