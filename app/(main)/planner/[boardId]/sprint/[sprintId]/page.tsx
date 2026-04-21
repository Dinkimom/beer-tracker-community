import type { Metadata } from 'next';

import PlannerSprintPageClient from './PlannerSprintPageClient';

interface PageProps {
  params: Promise<{ boardId: string; sprintId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { boardId, sprintId } = await params;
  return {
    title: `Спринты · доска ${boardId} · спринт ${sprintId}`,
  };
}

export default function PlannerSprintPage(props: PageProps) {
  return <PlannerSprintPageClient params={props.params} />;
}
