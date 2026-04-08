"use client";

import { useRouter } from "next/navigation";
import { CoachDashboardPage } from "@/views/CoachDashboardPage";
import { LoadingPanel, ErrorPanel } from "@/features/shared/components/page-feedback";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { useDashboardData } from "@/features/analytics/hooks/use-dashboard-data";

export default function CoachRoute() {
  const router = useRouter();
  const { lang, copy, toggleLang } = useDictionary();
  const dashboard = useDashboardData();

  if (dashboard.isLoading || !dashboard.data) {
    return <LoadingPanel label="Loading coach dashboard..." />;
  }

  if (dashboard.error) {
    return <ErrorPanel title="Failed to load coach dashboard" detail={dashboard.error} />;
  }

  return (
    <CoachDashboardPage
      lang={lang}
      copy={copy.coach}
      metrics={dashboard.data.coachMetrics}
      trainees={dashboard.data.coachTrainees}
      onLogout={() => router.push("/portal")}
      onToggleLang={toggleLang}
    />
  );
}
