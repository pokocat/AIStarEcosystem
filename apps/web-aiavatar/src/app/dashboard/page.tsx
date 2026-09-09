"use client";
// 个人主页（v0.191）—— 原来挂在根目录 `/` 的那张门户页。
//
// 根目录现在是公开落地页（components/landing/ip-landing.tsx），所以登录之后
// 的「主页」搬到这里：总览 + 待办 + 快捷创作 + 最近更新 + 官方精选。
// 移动端底部 tab 栏的「首页」与桌面顶栏的「主页」都指向本页。
import { HubHome } from "@/components/hub/home";

export default function DashboardPage() {
  return <HubHome />;
}
