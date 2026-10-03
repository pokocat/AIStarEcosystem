"use client";

// 「开始制作短视频」的扣费确认 —— 全站唯一一份（v0.197）。
//
// 一条短视频有四个入口会扣同一笔 prices.shortEntry：/shorts/new「开始制作」、粘贴脚本拆完后
// 「开始制作」、首页聊天页选「单条短视频」、模板（首页预览 / 模板广场）的「做同款」。
// 之前各写各的：标题有「开始制作短视频」「开始制作这条短视频」两种，按钮有「开始制作」
// 「确认，开始制作」「确认生成」三种，模板广场干脆不问就扣。现在四处都调这里。
//
// 每个入口只自己写前半句（这一下会建出什么），后半句计费说明和按钮都是这里的。
// 阈值语义与 CreditButton 一致：低于 confirmThreshold 视为小额免打扰，直接放行。
import { dramaConfirm } from "@/components/drama-ui";
import type { DramaCreditConfig } from "@/api/drama-config";

export const SHORT_START_CONFIRM = {
  title: "开始制作这条短视频",
  /** 各入口前半句之后接的计费说明。 */
  billingNote: "之后每一镜出首帧、生成视频另外扣积分。",
  confirmLabel: "开始制作",
} as const;

/** 各入口的前半句。写在这里是为了四处读起来是同一种口气；入口有特殊信息（如镜数）可以自己拼。 */
export const SHORT_START_LEAD = {
  fromIdea: "建一条短视频草稿，进去后 AI 先写口播脚本和分镜。",
  fromOutline: "按这份故事大纲建一条短视频草稿，进去后 AI 先写口播脚本和分镜。",
  // 模板只带风格、不带主题：进去后要先说这条讲什么，AI 才照模板写（v0.197 评审：原来写
  // 「进去后 AI 先写」，实际页面在等用户开口）。
  fromTemplate: "照这个模板建一条短视频草稿，进去后说说这条讲什么，AI 照模板写口播脚本和分镜。",
} as const;

/**
 * 用户确认（或金额低于免打扰阈值）返回 true。
 * @param lead 前半句：这一下会建出什么。用 SHORT_START_LEAD 里的，或自己拼（如「用这份分镜建一条……（6 镜，约 40 秒）」）。
 */
export async function confirmShortStart(cfg: DramaCreditConfig, lead: string): Promise<boolean> {
  const cost = cfg.prices.shortEntry;
  if (cost < cfg.confirmThreshold) return true;
  return dramaConfirm({
    cost,
    title: SHORT_START_CONFIRM.title,
    body: `${lead}${SHORT_START_CONFIRM.billingNote}`,
    confirmLabel: SHORT_START_CONFIRM.confirmLabel,
  });
}
