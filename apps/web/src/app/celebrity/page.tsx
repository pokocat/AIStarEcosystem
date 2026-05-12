import type { Metadata } from "next";
import { Megaphone, Star, Video, ShoppingBag } from "lucide-react";
import { ProductLanding } from "@/components/landing/ProductLanding";

export const metadata: Metadata = {
  title: "AI 明星带货 — AI Star Eco",
  description: "基于真人明星形象授权的 AI 复刻 IP 带货平台：直播带货、短视频带货、内容切片带货全链路。",
};

export default function CelebrityLandingPage() {
  return (
    <ProductLanding
      product="celebrity"
      label="AI 明星带货"
      tagline="基于真人明星授权的 AI 复刻 IP，跑通直播 × 短视频 × 切片带货"
      description="经授权的明星形象由 AI 复刻为可控的带货 IP：从直播间脚本、短视频生成到内容切片分发，覆盖品牌方与 MCN 的全链路营销动作，让明星价值在合规边界内被持续放大。"
      icon={Megaphone}
      accentGradient="from-amber-500 via-orange-500 to-pink-500"
      accentText="text-amber-300"
      features={[
        {
          icon: Star,
          title: "明星授权与复刻",
          body: "授权管理、形象复刻、肖像合规审计，让真人明星的 AI 表达边界清晰。",
        },
        {
          icon: Video,
          title: "短视频与切片",
          body: "模板生成、分镜配音、视频中心与多平台发布一体化，工业级出片节奏。",
        },
        {
          icon: ShoppingBag,
          title: "带货与变现",
          body: "商品库、数据看板、漏斗复盘 + 钱包结算，把 IP 价值真正转化为 GMV。",
        },
      ]}
    />
  );
}
