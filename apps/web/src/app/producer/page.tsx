"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ProducerDashboard from "@/components/ProducerDashboard";
import { useLang } from "@/lib/lang-context";

function ProducerRouteContent() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  // onLogout 触发时 AuthProvider 已清 token，这里只做路由跳转。
  return <ProducerDashboard onLogout={() => router.push("/login")} lang={lang} setLang={setLang} />;
}

export default function ProducerRoute() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">正在加载制作人端...</div>}>
      <ProducerRouteContent />
    </React.Suspense>
  );
}
