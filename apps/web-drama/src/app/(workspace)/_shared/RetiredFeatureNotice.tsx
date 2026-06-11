"use client";

// v0.60 收敛：本地「孵化 / 形象锻造」下线后的占位提示。
// 路由保留（避免外部书签 404），引导用户去 AiAvatar 创建数字人再回「演员 IP 阵容」引入。

import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/premium";
import { EmptyState } from "@/components/common";
import { AIAVATAR_URL } from "@/api/dap-avatars";

export function RetiredFeatureNotice({ feature }: { feature: string }) {
  return (
    <div style={{ paddingTop: 48 }}>
      <EmptyState
        icon={<Sparkles size={28} />}
        title={`${feature}已统一至 AiAvatar`}
        description="数字人（演员形象）的创建与渲染现统一在 AiAvatar 完成：真人复刻或 AI 生成、渲染造型与场景图。完成后回到「演员 IP 阵容」一键引入即可，形象会自动跟随更新。"
        action={
          <>
            <a href={AIAVATAR_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="md">
                去 AiAvatar 创建数字人 <ExternalLink size={12} />
              </Button>
            </a>
            <Link href="/cast" style={{ textDecoration: "none" }}>
              <Button variant="ghost" size="md">去演员阵容引入</Button>
            </Link>
          </>
        }
      />
    </div>
  );
}
