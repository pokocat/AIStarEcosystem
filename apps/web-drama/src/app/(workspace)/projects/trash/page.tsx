"use client";

export const dynamic = "force-dynamic";

// 旧路由兼容：短剧回收站已并入统一回收站 /trash（短剧 + 短视频分 Tab）。
// 保留本路由做重定向，避免旧链接 / 书签失效。
import * as React from "react";
import { useRouter } from "next/navigation";

export default function LegacyProjectsTrashRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/trash?tab=drama");
  }, [router]);
  return null;
}
