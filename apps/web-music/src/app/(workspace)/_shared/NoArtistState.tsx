"use client";

import { Users } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { useProducerShell } from "@/lib/producer-shell-context";

/**
 * 需要 activeArtist 的页面在无签约艺人时显示的友好空态。
 * 原本在 ProducerDashboard.renderPage 里拼装，这里抽出成共用组件。
 */
export function NoArtistState() {
  const { artistsLoading, navigate } = useProducerShell();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-cyan-300" />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
        {artistsLoading ? "载入签约艺人中..." : "当前经纪公司暂无签约艺人"}
      </h2>
      <p className="text-sm text-gray-400 max-w-md mb-5 font-light">
        {artistsLoading
          ? "正在从后端拉取 /api/me/digital-ips，请稍候。"
          : "请先在「艺人管理」里从 AiAvatar 引入一位数字人；或联系平台运营将现有艺人归属到当前 studio。"}
      </p>
      {!artistsLoading && (
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("artists")} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90">
            去引入数字人
          </Button>
        </div>
      )}
    </div>
  );
}
