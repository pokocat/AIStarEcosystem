// 模板元信息 — 设计真源 v4 screens-home-v3.jsx `TPL_META` / `tplBeats`:
// 封面 / 一句话描述 / 估时大纲,统一预览组件用。
import type { Template } from "./types";
import type { PreviewBeat } from "./home-ideas";

export interface TplMeta {
  desc: string;
  cover: { from: string; to: string };
}

export const TPL_META: Record<string, TplMeta> = {
  t1: { desc: "白领目击命案,却发现局是为她设的 —— 每集留扣,步步反转", cover: { from: "#f97316", to: "#e11d48" } },
  t2: { desc: "限时解谜强压迫,逐人淘汰直到反派揭面", cover: { from: "#475569", to: "#1e293b" } },
  t3: { desc: "双时间线交叉,碎片闪回拼出三年前的真相", cover: { from: "#6366f1", to: "#a78bfa" } },
  t4: { desc: "冷宫赐死的贵妃重生开局,连环打脸到终极翻盘", cover: { from: "#db2777", to: "#9333ea" } },
  t5: { desc: "强制联姻到联手对敌,甜虐平衡的女性向爽剧", cover: { from: "#e879f9", to: "#f472b6" } },
  t6: { desc: "闪婚开局,老公马甲一集掉一个的高糖下饭剧", cover: { from: "#f472b6", to: "#fb7185" } },
  t7: { desc: "契约开局假戏真做,甜虐交替双向奔赴", cover: { from: "#fb7185", to: "#fbbf24" } },
  t8: { desc: "从痛点到产品高光,一支稳的企业品牌片", cover: { from: "#f59e0b", to: "#ef4444" } },
  t9: { desc: "真实切入、情绪推进、呼吁收束的公益短片", cover: { from: "#10b981", to: "#22d3ee" } },
  t10: { desc: "第一人称口播,低谷到逆袭的个人自传短片", cover: { from: "#f59e0b", to: "#fb7185" } },
  t11: { desc: "痛点提问到催单的单条种草口播", cover: { from: "#f97316", to: "#e11d48" } },
};

export function getTplMeta(tp: Template): TplMeta {
  return TPL_META[tp.id] ?? { desc: tp.pace, cover: { from: "#94a3b8", to: "#cbd5e1" } };
}

/** 把模板拆成估时大纲(钩子期 / 推进期 / 高潮期 / 收束期) */
export function tplBeats(tp: Template): PreviewBeat[] {
  const e = tp.eps;
  if (e <= 1) {
    return [
      { range: "开场", beat: "钩子期 · " + (tp.hooks[0] ?? "强开场"), est: "前 3 秒" },
      { range: "中段", beat: "推进期 · " + (tp.hooks[1] ?? "矛盾升级"), est: "约 20-40 秒" },
      { range: "收尾", beat: "收束期 · " + (tp.hooks[2] ?? "情绪兑现"), est: "约 10 秒" },
    ];
  }
  const cut = (a: number, b: number) => `第 ${a}-${b} 集`;
  return [
    { range: cut(1, 3), beat: "钩子期 · " + tp.hooks[0], est: "约 75 秒/集" },
    { range: cut(4, Math.round(e * 0.35)), beat: "推进期 · 矛盾升级", est: "约 75 秒/集" },
    { range: cut(Math.round(e * 0.35) + 1, Math.round(e * 0.8)), beat: "高潮期 · " + tp.hooks[1], est: "约 75 秒/集" },
    { range: cut(Math.round(e * 0.8) + 1, e), beat: "收束期 · " + tp.hooks[2], est: "约 80 秒/集" },
  ];
}
