'use client';

import type { AdminTrackerCatalogPayload } from '@/features/admin/adminTeamCatalog';
import type { OrganizationTeamDirectoryItem } from '@/lib/organizations/organizationMembersRepository';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { CustomSelect, type CustomSelectOption } from '@/components/CustomSelect';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { cardBody, cardHeader, cardShell, hCard, muted } from '@/features/admin/adminUiTokens';

interface AdminOrganizationUsersClientProps {
  orgId: string;
  teamDirectory: OrganizationTeamDirectoryItem[];
}

interface TeamDraft {
  active: boolean;
  board: string;
  queue: string;
  title: string;
}

interface RegistrySearchItem {
  avatar_link: string | null;
  email: string | null;
  full_name: string | null;
  name: string | null;
  patronymic: string | null;
  staff_uid: string;
  surname: string | null;
  tracker_id: string | null;
}

function memberDisplayName(member: OrganizationTeamDirectoryItem['members'][number]): string {
  const full = member.full_name?.trim();
  if (full) {
    return full;
  }
  const composed = [member.surname, member.name, member.patronymic].filter(Boolean).join(' ').trim();
  if (composed) {
    return composed;
  }
  return member.email?.trim() || member.tracker_id?.trim() || member.staff_uid;
}

function memberInitials(member: OrganizationTeamDirectoryItem['members'][number]): string {
  const display = memberDisplayName(member);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

export function AdminOrganizationUsersClient({ orgId, teamDirectory }: AdminOrganizationUsersClientProps) {
  const { t } = useI18n();
  const { confirm, DialogComponent } = useConfirmDialog();
  const [teamDirectoryState, setTeamDirectoryState] = useState(teamDirectory);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [removingMemberKey, setRemovingMemberKey] = useState<string | null>(null);
  const [addingTeamId, setAddingTeamId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<RegistrySearchItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RegistrySearchItem | null>(null);
  const [catalog, setCatalog] = useState<AdminTrackerCatalogPayload | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const teams = useMemo(
    () =>
      teamDirectoryState
        .map((x) => x)
        .sort((a, b) => a.team.team_title.localeCompare(b.team.team_title, 'ru')),
    [teamDirectoryState]
  );
  const [drafts, setDrafts] = useState<Record<string, TeamDraft>>(() =>
    Object.fromEntries(
      teams.map(({ team }) => [
        team.team_id,
        {
          title: team.team_title,
          queue: team.queue ?? '',
          board: team.board != null ? String(team.board) : '',
          active: team.active,
        },
      ])
    )
  );
  const [savedDrafts, setSavedDrafts] = useState<Record<string, TeamDraft>>({});

  useEffect(() => {
    setTeamDirectoryState(teamDirectory);
  }, [teamDirectory]);

  useEffect(() => {
    setSavedDrafts({});
    setDrafts((prev) => {
      return Object.fromEntries(
        teams.map(({ team }) => [
          team.team_id,
          {
            title: prev[team.team_id]?.title ?? team.team_title,
            queue: prev[team.team_id]?.queue ?? (team.queue ?? ''),
            board: prev[team.team_id]?.board ?? (team.board != null ? String(team.board) : ''),
            active: prev[team.team_id]?.active ?? team.active,
          },
        ])
      );
    });
  }, [teams]);

  function teamBaseline(team: OrganizationTeamDirectoryItem['team']): TeamDraft {
    return (
      savedDrafts[team.team_id] ?? {
        active: team.active,
        board: team.board != null ? String(team.board) : '',
        queue: team.queue ?? '',
        title: team.team_title,
      }
    );
  }

  function hasTeamChanges(team: OrganizationTeamDirectoryItem['team']): boolean {
    const draft = drafts[team.team_id];
    if (!draft) return false;
    const baseline = teamBaseline(team);
    return (
      draft.title.trim() !== baseline.title.trim() ||
      draft.queue.trim() !== baseline.queue.trim() ||
      draft.board.trim() !== baseline.board.trim() ||
      draft.active !== baseline.active
    );
  }

  useEffect(() => {
    if (!orgId) {
      return;
    }
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}/teams/tracker-catalog`, {
          credentials: 'include',
        });
        const data = (await res.json()) as AdminTrackerCatalogPayload & { error?: string };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setCatalogError(data.error ?? 'Не удалось загрузить каталог досок и очередей');
          return;
        }
        setCatalogError(null);
        setCatalog(data);
      } catch {
        if (!cancelled) {
          setCatalogError('Сетевая ошибка при загрузке каталога досок и очередей');
        }
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const queueOptions = useMemo<CustomSelectOption<string>[]>(() => {
    if (!catalog?.queues) return [{ label: 'Нет данных каталога', value: '' }];
    return catalog.queues.map((q) => ({ label: `${q.name} (${q.key})`, value: q.key }));
  }, [catalog]);

  const boardOptions = useMemo<CustomSelectOption<string>[]>(() => {
    if (!catalog?.boards) return [{ label: 'Нет данных каталога', value: '' }];
    return catalog.boards.map((b) => ({ label: `${b.name} (${b.id})`, value: String(b.id) }));
  }, [catalog]);

  async function saveTeam(teamId: string): Promise<void> {
    const draft = drafts[teamId];
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error('Название команды обязательно');
      return;
    }
    if (!draft.queue.trim()) {
      toast.error('Ключ очереди обязателен');
      return;
    }
    if (!/^\d+$/.test(draft.board.trim())) {
      toast.error('ID доски должен быть числом');
      return;
    }

    setSavingTeamId(teamId);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/teams/${teamId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          tracker_queue_key: draft.queue.trim(),
          tracker_board_id: Number.parseInt(draft.board.trim(), 10),
          active: draft.active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Не удалось сохранить команду');
        return;
      }
      setSavedDrafts((prev) => ({
        ...prev,
        [teamId]: {
          active: draft.active,
          board: draft.board.trim(),
          queue: draft.queue.trim(),
          title: draft.title.trim(),
        },
      }));
      toast.success('Команда обновлена');
    } catch {
      toast.error('Сетевая ошибка при сохранении команды');
    } finally {
      setSavingTeamId(null);
    }
  }

  async function removeMember(
    teamId: string,
    staffUid: string,
    memberName: string
  ): Promise<void> {
    const confirmed = await confirm(
      `Удалить «${memberName}» из команды? Пользователь останется в реестре.`,
      {
        title: 'Подтвердите удаление',
        confirmText: 'Удалить из команды',
        variant: 'destructive',
      }
    );
    if (!confirmed) {
      return;
    }
    const opKey = `${teamId}:${staffUid}`;
    setRemovingMemberKey(opKey);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/teams/${teamId}/members/${staffUid}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Не удалось удалить участника из команды');
        return;
      }
      setTeamDirectoryState((prev) =>
        prev.map((group) =>
          group.team.team_id !== teamId
            ? group
            : {
                ...group,
                members: group.members.filter((m) => m.staff_uid !== staffUid),
              }
        )
      );
      toast.success('Участник удален из команды');
    } catch {
      toast.error('Сетевая ошибка при удалении участника');
    } finally {
      setRemovingMemberKey(null);
    }
  }

  function openAddModal(teamId: string): void {
    setAddingTeamId(teamId);
    setAddSearch('');
    setAddResults([]);
    setSelectedCandidate(null);
    setAddModalOpen(true);
  }

  function closeAddModal(): void {
    setAddModalOpen(false);
    setAddingTeamId(null);
    setAddSearch('');
    setAddResults([]);
    setSelectedCandidate(null);
    setAddLoading(false);
  }

  useEffect(() => {
    if (!orgId || !addModalOpen || !addingTeamId || addSearch.trim().length < 2) {
      setAddResults([]);
      setAddLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAddLoading(true);
      try {
        const res = await fetch(
          `/api/admin/organizations/${orgId}/teams/${addingTeamId}/registry-search?q=${encodeURIComponent(addSearch.trim())}`,
          { credentials: 'include', signal: controller.signal }
        );
        const data = (await res.json()) as { error?: string; items?: RegistrySearchItem[] };
        if (!res.ok) {
          toast.error(data.error ?? 'Не удалось выполнить поиск в реестре');
          setAddResults([]);
          return;
        }
        setAddResults(data.items ?? []);
      } catch {
        if (!controller.signal.aborted) {
          toast.error('Сетевая ошибка при поиске сотрудников');
          setAddResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAddLoading(false);
        }
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [addModalOpen, addingTeamId, addSearch, orgId]);

  async function addSelectedMemberToTeam(): Promise<void> {
    if (!addingTeamId || !selectedCandidate) {
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/teams/${addingTeamId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_uid: selectedCandidate.staff_uid,
          role_slug: null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Не удалось добавить сотрудника в команду');
        return;
      }
      setTeamDirectoryState((prev) =>
        prev.map((group) => {
          if (group.team.team_id !== addingTeamId) {
            return group;
          }
          if (group.members.some((m) => m.staff_uid === selectedCandidate.staff_uid)) {
            return group;
          }
          const nextMembers = [
            ...group.members,
            {
              avatar_link: selectedCandidate.avatar_link,
              email: selectedCandidate.email,
              full_name: selectedCandidate.full_name,
              name: selectedCandidate.name,
              patronymic: selectedCandidate.patronymic,
              staff_uid: selectedCandidate.staff_uid,
              surname: selectedCandidate.surname,
              tracker_id: selectedCandidate.tracker_id,
            },
          ].sort((a, b) => memberDisplayName(a).localeCompare(memberDisplayName(b), 'ru'));
          return { ...group, members: nextMembers };
        })
      );
      toast.success('Сотрудник добавлен в команду');
      closeAddModal();
    } catch {
      toast.error('Сетевая ошибка при добавлении в команду');
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <section className={cardShell}>
      <div className={cardHeader}>
        <h1 className={hCard}>{t('admin.shell.nav.teams')}</h1>
        <p className={`mt-1 ${muted}`}>
          Команды из `overseer.teams` и участники из `overseer.staff_teams` + `public.registry_employees`.
        </p>
      </div>
      <div className={`${cardBody} space-y-4`}>
        {!orgId ? <p className={muted}>{t('admin.membersPage.selectOrgInHeader')}</p> : null}
        {catalogError ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {catalogError}
          </p>
        ) : null}
        {teams.length === 0 ? (
          <p className={muted}>В `overseer.teams` пока нет данных.</p>
        ) : null}
        {teams.map(({ team, members }) => (
          <article
            key={team.team_id}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/30"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {team.team_title}
                </h2>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {team.team_slug ? `${team.team_slug} · ` : ''}
                  {team.queue ? `queue: ${team.queue} · ` : ''}
                  {team.board != null ? `board: ${team.board}` : 'board: —'}
                </p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center">
              <input
                className="h-10 rounded border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Название"
                value={drafts[team.team_id]?.title ?? ''}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [team.team_id]: { ...(prev[team.team_id] ?? { active: team.active, board: '', queue: '', title: '' }), title: e.target.value },
                  }))
                }
              />
              <CustomSelect
                className="w-full"
                disabled={!catalog || queueOptions.length === 0}
                options={queueOptions}
                selectedPrefix=""
                title="Очередь"
                value={drafts[team.team_id]?.queue ?? ''}
                onChange={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [team.team_id]: {
                      ...(prev[team.team_id] ?? {
                        active: team.active,
                        board: '',
                        queue: '',
                        title: '',
                      }),
                      queue: value,
                    },
                  }))
                }
              />
              <CustomSelect
                className="w-full"
                disabled={!catalog || boardOptions.length === 0}
                options={boardOptions}
                selectedPrefix=""
                title="Доска"
                value={drafts[team.team_id]?.board ?? ''}
                onChange={(value) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [team.team_id]: {
                      ...(prev[team.team_id] ?? {
                        active: team.active,
                        board: '',
                        queue: '',
                        title: '',
                      }),
                      board: value,
                    },
                  }))
                }
              />
              <label className="flex items-center gap-2 pr-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  checked={Boolean(drafts[team.team_id]?.active)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
                  type="checkbox"
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [team.team_id]: { ...(prev[team.team_id] ?? { active: team.active, board: '', queue: '', title: '' }), active: e.target.checked },
                    }))
                  }
                />
                Активна
              </label>
              <div className="flex md:justify-end md:pl-2">
                <Button
                  className="min-w-28"
                  disabled={savingTeamId === team.team_id || !hasTeamChanges(team)}
                  type="button"
                  variant="primary"
                  onClick={() => void saveTeam(team.team_id)}
                >
                  {savingTeamId === team.team_id ? 'Сохранение…' : 'Сохранить'}
                </Button>
              </div>
            </div>

            <div className="mb-2 flex justify-end">
              <Button
                className="h-8 px-3"
                type="button"
                variant="outline"
                onClick={() => openAddModal(team.team_id)}
              >
                <Icon className="h-4 w-4" name="plus" />
                Добавить
              </Button>
            </div>
            {members.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Участников нет</p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => (
                  <li
                    key={`${team.team_id}:${member.staff_uid}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        avatarUrl={member.avatar_link}
                        initials={memberInitials(member)}
                        size="md"
                        title={memberDisplayName(member)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-gray-900 dark:text-gray-100">{memberDisplayName(member)}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {member.email || 'email: —'}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      <Button
                        aria-label={`Удалить ${memberDisplayName(member)} из команды`}
                        className="h-8 min-w-24 px-3 whitespace-nowrap"
                        disabled={removingMemberKey === `${team.team_id}:${member.staff_uid}`}
                        title="Удалить из команды"
                        type="button"
                        variant="dangerOutline"
                        onClick={() =>
                          void removeMember(team.team_id, member.staff_uid, memberDisplayName(member))
                        }
                      >
                        {removingMemberKey === `${team.team_id}:${member.staff_uid}` ? (
                          <Icon className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" name="spinner" />
                        ) : (
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Удалить</span>
                        )}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {DialogComponent}
        {addModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Добавить сотрудника в команду
                </h3>
                <Button className="h-8 w-8 p-0" type="button" variant="outline" onClick={closeAddModal}>
                  <Icon className="h-4 w-4" name="x" />
                </Button>
              </div>
              <input
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Поиск по ФИО или email (мин. 2 символа)"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
              />
              <div className="mt-3 max-h-64 space-y-1 overflow-auto rounded border border-gray-200 p-1 dark:border-gray-700">
                {addLoading ? (
                  <p className="px-2 py-2 text-xs text-gray-500">Поиск...</p>
                ) : addSearch.trim().length < 2 ? (
                  <p className="px-2 py-2 text-xs text-gray-500">Введите минимум 2 символа</p>
                ) : addResults.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-gray-500">Ничего не найдено</p>
                ) : (
                  addResults.map((item) => (
                    <button
                      key={item.staff_uid}
                      className={`flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm ${
                        selectedCandidate?.staff_uid === item.staff_uid
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      }`}
                      type="button"
                      onClick={() => setSelectedCandidate(item)}
                    >
                      <Avatar
                        avatarUrl={item.avatar_link}
                        initials={memberInitials({
                          avatar_link: item.avatar_link,
                          email: item.email,
                          full_name: item.full_name,
                          name: item.name,
                          patronymic: item.patronymic,
                          staff_uid: item.staff_uid,
                          surname: item.surname,
                          tracker_id: item.tracker_id,
                        })}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-gray-900 dark:text-gray-100">
                          {item.full_name?.trim() ||
                            [item.surname, item.name, item.patronymic].filter(Boolean).join(' ').trim() ||
                            item.email ||
                            item.staff_uid}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {item.email || 'email: —'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeAddModal}>
                  Отмена
                </Button>
                <Button
                  disabled={!selectedCandidate || addLoading}
                  type="button"
                  variant="primary"
                  onClick={() => void addSelectedMemberToTeam()}
                >
                  Добавить в команду
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
