import type { Metadata } from "next";

import MainPageClient from "./MainPageClient";

const PAGE_TITLES: Record<string, string> = {
  sprints: "Спринты",
  features: "Эпики",
  "quarterly-v2": "Квартальное планирование",
};

const TAB_TITLES: Record<string, string> = {
  backlog: "Бэклог",
  board: "Доска",
  burndown: "Диаграмма сгорания",
};

interface PageProps {
  searchParams: Promise<{ page?: string; tab?: string }>;
}

function getTitleFromSearchParams(sp: { page?: string; tab?: string } | null): string {
  const page =
    sp?.page === "sprints" || sp?.page === "features" || sp?.page === "quarterly-v2"
      ? sp.page
      : "sprints";
  const tab =
    sp?.tab === "backlog" || sp?.tab === "board" || sp?.tab === "burndown"
      ? sp.tab
      : "board";
  const base = PAGE_TITLES[page] ?? "Спринты";
  return page === "sprints" ? `${base} · ${TAB_TITLES[tab] ?? "Доска"}` : base;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: getTitleFromSearchParams(sp),
  };
}

export default function Page() {
  return <MainPageClient />;
}
