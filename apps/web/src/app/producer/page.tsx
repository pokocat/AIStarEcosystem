"use client";

import { useRouter } from "next/navigation";
import ProducerDashboard from "@/components/ProducerDashboard";
import { useLang } from "@/lib/lang-context";

export default function ProducerRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  // onLogout 触发时 AuthProvider 已清 token，这里只做路由跳转。
  return <ProducerDashboard onLogout={() => router.push("/login")} lang={lang} setLang={setLang} />;
}
