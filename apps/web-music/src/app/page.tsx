"use client";

// metadata 由根 layout.tsx 提供；client component 不导出 metadata。
import { Music, Mic2, TrendingUp, Shield } from "lucide-react";
import { ProductLanding } from "@ai-star-eco/landing";

export default function MusicLandingPage() {
  return (
    <ProductLanding
      product="music"
      label="AI 音乐人"
      tagline="为 MCN 机构打造歌手 IP 的全周期数字人工作台"
      description="从 AI 形象锻造、声线设计、单曲制作到版权登记与全网分发，一站式贯通歌手类数字人 IP 的孵化与商业化路径，让 MCN 与厂牌以更小团队跑通更稳的发行节奏。"
      icon={Music}
      accentGradient="from-violet-500 via-fuchsia-500 to-purple-600"
      accentText="text-fuchsia-300"
      postLoginPath="/"
      features={[
        {
          icon: Mic2,
          title: "歌手 IP 孵化",
          body: "声线设计 + 形象锻造 + 造型道具一体化，从零到出道仅需数日。",
        },
        {
          icon: TrendingUp,
          title: "单曲发布与商业",
          body: "创作工坊、音乐商业、版权资产、全网分发，覆盖发行全链路。",
        },
        {
          icon: Shield,
          title: "合规与变现",
          body: "版权登记、平台审计、收益结算贯穿主线，让 MCN 经营更可预期。",
        },
      ]}
    />
  );
}
