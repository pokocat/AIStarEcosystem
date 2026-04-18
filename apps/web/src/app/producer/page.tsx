"use client";

import { useRouter } from "next/navigation";
import ProducerDashboard from "@/components/ProducerDashboard";
import { useLang } from "@/lib/lang-context";

export default function ProducerRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <ProducerDashboard onLogout={() => router.push("/")} lang={lang} setLang={setLang} />;
}
