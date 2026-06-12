// 全局元数据 — 设计真源 data.js（projects / contentTypes / templates / avatarLibrary）。
import type { AvatarLibItem, ContentType, DramaProjectSummary, Template } from "./types";

export const PROJECTS: DramaProjectSummary[] = [
  { id: "p1", title: "落地窗后", type: "悬疑短剧", typeKey: "mystery", ratio: "9:16", episodes: 80, progress: 64, stage: 4, cover: { from: "#f97316", to: "#e11d48" }, mode: "guided", updated: "今天 14:32", main: true },
  { id: "p2", title: "重生后她在冷宫杀疯了", type: "宫斗", typeKey: "palace", ratio: "9:16", episodes: 98, progress: 100, stage: 6, cover: { from: "#db2777", to: "#9333ea" }, mode: "template", updated: "昨天 21:08", done: true },
  { id: "p3", title: "闪婚老公竟是隐藏首富", type: "都市甜宠", typeKey: "romance", ratio: "9:16", episodes: 76, progress: 28, stage: 2, cover: { from: "#f472b6", to: "#fb7185" }, mode: "guided", updated: "3 天前" },
  { id: "p4", title: "向阳而生 · 乡村支教纪实", type: "公益宣传片", typeKey: "public", ratio: "16:9", episodes: 1, progress: 80, stage: 5, cover: { from: "#10b981", to: "#22d3ee" }, mode: "template", updated: "上周二" },
  { id: "p5", title: "星核纪元", type: "科幻短剧", typeKey: "scifi", ratio: "9:16", episodes: 60, progress: 9, stage: 1, cover: { from: "#3b82f6", to: "#8b5cf6" }, mode: "guided", updated: "上周五" },
  { id: "p6", title: "匠心智造 · 品牌片", type: "企业宣传片", typeKey: "corporate", ratio: "16:9", episodes: 1, progress: 45, stage: 3, cover: { from: "#f59e0b", to: "#ef4444" }, mode: "template", updated: "2 周前" },
];

export const CONTENT_TYPES: ContentType[] = [
  { key: "mystery",   name: "悬疑短剧",     desc: "反转、揭秘、步步惊心",  ratio: "竖屏 9:16", pace: "强钩子·快节奏",     from: "#f97316", to: "#e11d48" },
  { key: "palace",    name: "宫斗",         desc: "权谋、复仇、爽感拉满",  ratio: "竖屏 9:16", pace: "重生开局·80集+",   from: "#db2777", to: "#9333ea" },
  { key: "romance",   name: "都市甜宠",     desc: "霸总、闪婚、甜虐交替",  ratio: "竖屏 9:16", pace: "高糖·下饭剧",       from: "#f472b6", to: "#fb7185" },
  { key: "scifi",     name: "科幻短剧",     desc: "设定、奇观、世界观",    ratio: "竖屏 9:16", pace: "强视觉·特效多",     from: "#3b82f6", to: "#8b5cf6" },
  { key: "manhua",    name: "漫剧",         desc: "二次元、风格化作画",    ratio: "竖屏 9:16", pace: "分镜感强",           from: "#06b6d4", to: "#3b82f6" },
  { key: "social",    name: "社会热点",     desc: "共鸣、话题、强代入",    ratio: "竖屏 9:16", pace: "真实感·口播多",     from: "#f59e0b", to: "#fb923c" },
  { key: "public",    name: "公益宣传片",   desc: "温暖、呼吁、有力量",    ratio: "横屏 16:9", pace: "叙事·情绪向",       from: "#10b981", to: "#22d3ee" },
  { key: "corporate", name: "企业宣传片",   desc: "品牌、产品、代言人",    ratio: "横屏 16:9", pace: "产品·口播",         from: "#f59e0b", to: "#ef4444" },
  { key: "custom",    name: "通用 / 自定义", desc: "自由搭建你的骨架",     ratio: "可选",       pace: "灵活",               from: "#94a3b8", to: "#cbd5e1", plain: true },
];

export const TEMPLATES: Record<string, Template[]> = {
  mystery: [
    { id: "t1", name: "都市悬疑·身份反转",   eps: 80, pace: "3 秒钩子 + 每集留扣", scene: "通勤碎片时间", hooks: ["开场即悬念", "中段大反转", "末集双线收束"] },
    { id: "t2", name: "密室求生·限时解谜",   eps: 60, pace: "快节奏·强压迫",       scene: "强刺激人群",   hooks: ["倒计时压迫", "逐人淘汰", "反派揭面"] },
    { id: "t3", name: "回忆杀·真相拼图",     eps: 72, pace: "双时间线交叉",         scene: "情感向受众",   hooks: ["今昔对照", "碎片闪回", "真相反转"] },
  ],
  palace: [
    { id: "t4", name: "宫斗·重生复仇·百集",  eps: 98, pace: "重生开局即爽",         scene: "走量·稳",     hooks: ["重生金手指", "步步打脸", "终极翻盘"] },
    { id: "t5", name: "宫斗·先婚后爱",       eps: 80, pace: "甜虐平衡",             scene: "女性向",       hooks: ["强制联姻", "日久生情", "联手对敌"] },
  ],
  romance: [
    { id: "t6", name: "甜宠·闪婚霸总",       eps: 76, pace: "高糖快节奏",           scene: "下饭剧",       hooks: ["闪婚开局", "马甲掉落", "高甜收官"] },
    { id: "t7", name: "甜宠·契约恋人",       eps: 68, pace: "甜虐交替",             scene: "女性向",       hooks: ["契约开局", "假戏真做", "双向奔赴"] },
  ],
  corporate: [
    { id: "t8", name: "企业品牌片 · 60 秒",  eps: 1,  pace: "产品+口播·一镜到底感", scene: "官网/招商",     hooks: ["痛点开场", "产品高光", "代言人口播"] },
  ],
  public: [
    { id: "t9", name: "公益短片 · 情绪向",   eps: 1,  pace: "叙事+留白· 90 秒",     scene: "传播/募捐",     hooks: ["真实切入", "情绪推进", "呼吁收束"] },
  ],
  social: [
    { id: "t10", name: "个人自传 · 励志逆袭", eps: 1, pace: "第一人称口播· 45 秒",   scene: "个人 IP/招募",  hooks: ["低谷开场", "转折奋斗", "高光逆袭"] },
    { id: "t11", name: "口播带货 · 单条种草", eps: 1, pace: "强钩子+转化· 30 秒",   scene: "电商/直播切片", hooks: ["痛点提问", "卖点演示", "催单引导"] },
  ],
};

export const AVATAR_LIBRARY: AvatarLibItem[] = [
  { id: "a1", name: "都市女性 A", tags: ["知性", "冷感"], from: "#a78bfa", to: "#f0abfc" },
  { id: "a2", name: "都市女性 B", tags: ["温柔", "亲和"], from: "#f9a8d4", to: "#fbcfe8" },
  { id: "a3", name: "职场精英女", tags: ["干练", "锋利"], from: "#c4b5fd", to: "#ddd6fe" },
  { id: "a4", name: "清冷男主",   tags: ["沉稳", "禁欲"], from: "#60a5fa", to: "#22d3ee" },
  { id: "a5", name: "硬汉刑警",   tags: ["正气", "硬朗"], from: "#38bdf8", to: "#818cf8" },
  { id: "a6", name: "古装贵妃",   tags: ["艳丽", "城府"], from: "#e879f9", to: "#f0abfc" },
  { id: "a7", name: "元气少女",   tags: ["活泼", "邻家"], from: "#f472b6", to: "#fda4af" },
  { id: "a8", name: "神秘女子",   tags: ["暗黑", "魅惑"], from: "#a855f7", to: "#6366f1" },
];

export const SCENE_LIB = [
  { id: "r1", name: "冷调公寓夜", from: "#64748b", to: "#1e293b" },
  { id: "r2", name: "霓虹雨夜",   from: "#7c3aed", to: "#2563eb" },
  { id: "r3", name: "暖黄室内",   from: "#f59e0b", to: "#b45309" },
  { id: "r4", name: "金属电梯",   from: "#94a3b8", to: "#475569" },
  { id: "r5", name: "落地窗景",   from: "#22d3ee", to: "#0e7490" },
  { id: "r6", name: "空镜街道",   from: "#a78bfa", to: "#6366f1" },
];
