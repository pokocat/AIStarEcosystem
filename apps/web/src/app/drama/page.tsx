import type { Metadata } from "next";
import { Clapperboard, Film, Wand2, Layers } from "lucide-react";
import { ProductLanding } from "@/components/landing/ProductLanding";

export const metadata: Metadata = {
  title: "AI 短剧 — AI Star Eco",
  description: "面向 MCN 机构的演员类 AI 数字人 IP 工作台：脚本编辑、创意生成、短剧项目、生态分发。",
};

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
