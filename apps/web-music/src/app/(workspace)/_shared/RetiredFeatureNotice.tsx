"use client";

// v0.60 收敛：本地「艺人孵化 / 形象锻造」下线后的占位提示。
// 路由保留（避免外部书签 404），引导用户去 AiAvatar 创建数字人再回来引入。

import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { useProducerShell } from "@/lib/producer-shell-context";
import { AIAVATAR_URL } from "@/api/dap-avatars";

export function RetiredFeatureNotice({ feature }: { feature: string }) {
  const { navigate } = useProducerShell();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-cyan-300" />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
        {feature}已统一至 AiAvatar
      </h2>
      <p className="text-sm text-gray-400 max-w-md mb-5 font-light leading-relaxed">
        数字人（艺人形象）的创建与渲染现统一在 AiAvatar 完成：真人复刻或 AI 生成、
        渲染造型与场景图。完成后回到「艺人管理」一键引入即可，形象会自动跟随更新。
      </p>
      <div className="flex items-center gap-2">
        <a href={AIAVATAR_URL} target="_blank" rel="noreferrer">
          <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2">
            去 AiAvatar 创建数字人 <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </a>
        <Button variant="outline" onClick={() => navigate("artists")} className="border-white/10">
          去艺人管理引入
        </Button>
      </div>
    </div>
  );
}
