"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CoachDashboardFull } from "@/components/CoachDashboardFull";
import { useLang } from "@/lib/lang-context";

function CoachRouteContent() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <CoachDashboardFull onLogout={() => router.push("/")} lang={lang} setLang={setLang} />;
}

export default function CoachRoute() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">正在加载掌门人端...</div>}>
      <CoachRouteContent />
    </React.Suspense>
  );
}
