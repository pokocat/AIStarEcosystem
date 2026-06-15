"use client";

export const dynamic = "force-dynamic";

// 互动短剧已整合进「短剧工坊」(/projects)：同列表以「互动剧」标签展示 + 类型筛选，
// 创建走「转换成互动剧」或顶部「AI 起草 / 新建互动剧」。此页保留为旧链接重定向。
import * as React from "react";
import { useRouter } from "next/navigation";

export default function InteractiveRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/projects?filter=interactive");
  }, [router]);
  return null;
}
