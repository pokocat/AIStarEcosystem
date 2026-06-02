"use client";

// 旧「短剧生成」单页能力已并入新工作台的 6 阶段流程。
// 本页保留为兼容深链入口,自动跳转到「我的短剧」。
import * as React from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ShortDramaRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/projects");
  }, [router]);
  return null;
}
