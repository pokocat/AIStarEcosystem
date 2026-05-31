"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@ai-star-eco/api-client";

/** 根路由：已登录 → 资产总库；未登录 → 登录页。 */
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  React.useEffect(() => {
    if (loading) return;
    router.replace(user ? "/library" : "/login");
  }, [user, loading, router]);
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
      载入中…
    </div>
  );
}
