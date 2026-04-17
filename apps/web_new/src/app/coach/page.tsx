"use client";

import { useRouter } from "next/navigation";
import { CoachDashboardFull } from "@/components/CoachDashboardFull";
import { useLang } from "@/lib/lang-context";

export default function CoachRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <CoachDashboardFull onLogout={() => router.push("/")} lang={lang} setLang={setLang} />;
}
