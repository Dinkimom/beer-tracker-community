import { redirect } from 'next/navigation';

/** Старый URL: приглашения перенесены на страницу «Пользователи». */
export default async function InvitationsRedirectPage() {
  redirect('/admin/members');
}
