"use client";

// metadata 由根 layout.tsx 提供；client component 不导出 metadata。
import { Clapperboard, Film, Wand2, Layers } from "lucide-react";
import { ProductLanding } from "@ai-star-eco/landing";

export default function DramaLandingPage() {
  return (
    <ProductLanding
      product="drama"
      label="AI 短剧"
      tagline="为 MCN 机构打造演员 IP 与短剧生态的一体化工坊"
      description="演员形象塑造 × 脚本工坊 × 创意脑暴 × 短剧项目 × 生态分发，把短视频时代的内容工业流搬进数字人世界，让创作团队以更轻的人力跑出更密的内容节奏。"
      icon={Clapperboard}
      accentGradient="from-orange-500 via-amber-500 to-red-500"
      accentText="text-orange-300"
      postLoginPath="/"
      features={[
        {
          icon: Film,
          title: "演员 IP 与角色",
          body: "演员形象、表演风格、人物档案统一管理，跨剧集复用角色资产。",
        },
        {
          icon: Wand2,
          title: "脚本工坊与脑暴",
          body: "AI 辅助脚本生成、分镜与桥段建议，让小团队拥有创意中台。",
        },
        {
          icon: Layers,
          title: "短剧项目与分发",
          body: "项目管理、剪辑流转、多平台投放与上线追踪，闭环短剧生意。",
        },
      ]}
    />
  );
}
