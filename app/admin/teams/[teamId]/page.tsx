import { redirect } from 'next/navigation';

interface TeamDetailPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  await params;
  redirect('/admin/teams');
}
