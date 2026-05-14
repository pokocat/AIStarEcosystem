// ─────────────────────────────────────────────────────────────────────────────
// mocks/generation.ts — drama 子产品的「脚本工坊」LLM 流式骨架。
// 历史背景：本文件由 web-music 复制而来，复用共享 type `StreamStage` /
// `GeneratedMusicDraft`（字段名仍是 lyrics / bpm / key / coverPrompt）。
// 等独立 type `DramaScriptDraft` 落地前，内容先按短剧语义改写：
//   · lyrics      ← 分场对白
//   · bpm         ← 主线分镜节奏（秒）
//   · key         ← 影调（如「冷色 · 雨夜」）
//   · coverPrompt ← 分镜参考关键词
// 模板里的 {{prompt}} / {{artist}} 会在组件层被替换为运行时值。
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamStage, GeneratedMusicDraft } from "@ai-star-eco/types/generation";

export const STAGE_SEQUENCE: StreamStage[] = [
  "analyzing",
  "composing",
  "lyrics",
  "arranging",
  "mastering",
];

export const STAGE_SCRIPT: Record<StreamStage, string[]> = {
  // 解析意图
  analyzing: [
    "🧠 正在解析创作意图…",
    "· 主题关键词：{{prompt}}",
    "· 目标受众：22-35 岁都市女性 · 通勤碎片时间",
    "· 参考坐标：都市悬疑 × 慢炖情感 × 雨夜镜头",
    "✓ 方向已锁定，进入故事大纲",
  ],
  // 故事大纲（语义复用 composing）
  composing: [
    "🎼 构建故事结构…",
    "· 主线：误会 → 重逢 → 揭谜 → 释怀",
    "· 时长：3 集 × 12 分钟（竖屏短剧节奏）",
    "· 主角弧光：从克制隐忍到主动选择",
    "✓ 故事骨架就绪，开始撰写分场对白",
  ],
  // 分场对白（语义复用 lyrics）
  lyrics: [
    "✍️ 撰写分场对白…",
    "[场景一 · 雨夜便利店]",
    "苏念：「我以为我等的是答案，原来等的是一个不会再来的人。」",
    "",
    "[场景二 · 楼道相遇]",
    "陆烬：「你站在这儿多久了？」",
    "苏念：「一辈子。」",
    "✓ 首场对白完成，进入分镜清单",
  ],
  // 镜头清单（语义复用 arranging）
  arranging: [
    "🎛️ 编排镜头与运镜…",
    "· 主演：{{artist}}（v3 形象 · 雨夜素颜）",
    "· 镜头：手持中近景 × 4 + 雨景空镜 × 2 + 慢推面部特写 × 1",
    "· 空间感：便利店内冷色 + 街景暖光对比",
    "✓ 分镜清单就绪，进入终稿封装",
  ],
  // 终稿封装（语义复用 mastering）
  mastering: [
    "🔊 终稿封装中…",
    "· 校色基调：冷蓝 + 微暖橙",
    "· 节奏审校：平均镜头时长 3.4 秒（短剧友好）",
    "✓ 终稿就绪，下一步可预览 / 采纳 / 重抽一版",
  ],
};

/**
 * 产物候选池。组件在终稿阶段随机抽一条作为 draft 返回。
 * 真实后端会基于 prompt + 演员 + 模型版本生成独立内容，这里仅做形态占位。
 * 字段名沿用 `GeneratedMusicDraft`（共享 type），语义按短剧场景重写。
 */
export const MOCK_DRAFTS: GeneratedMusicDraft[] = [
  {
    title: "暮色未央 · 雨夜便利店",
    genre: "都市悬疑",
    duration: 218,
    lyrics: [
      "[场景一 · 雨夜便利店]",
      "苏念伫立在自动门外。雨水沿伞骨滴落，便利店霓虹在水洼里碎成琥珀色。",
      "苏念（V.O.）：「我以为我等的是答案，原来等的是一个不会再来的人。」",
      "",
      "[场景二 · 推门]",
      "陆烬推开玻璃门走出来，手里两罐还冒着热气的奶茶。",
      "陆烬：「你站在这儿多久了？」",
      "苏念：「一辈子。」",
    ].join("\n"),
    coverPrompt: "rainy night convenience store, neon signage reflecting on wet pavement, two silhouettes, cinematic teal-orange grade",
    bpm: 12,
    key: "冷色 · 雨夜",
    modelVersion: "drama-v3",
    thinkDepth: "standard",
    creditsEstimate: 80,
  },
  {
    title: "盛夏来信 · 楼道光影",
    genre: "青春治愈",
    duration: 196,
    lyrics: [
      "[场景一 · 黄昏楼道]",
      "林晓抱着信纸跑上楼梯，逆光剪影。",
      "林晓（V.O.）：「夏天会过去，但写信的我不会忘记现在的你。」",
      "",
      "[场景二 · 阳台]",
      "她站在阳台上，把信折成纸船放进雨水里。",
    ].join("\n"),
    coverPrompt: "warm sunset corridor with floating dust particles, teenage girl silhouette, pastel film tone, soft bokeh",
    bpm: 14,
    key: "暖色 · 黄昏",
    modelVersion: "drama-v3",
    thinkDepth: "standard",
    creditsEstimate: 80,
  },
  {
    title: "摩天与月光 · 落地窗剪影",
    genre: "都市情感",
    duration: 243,
    lyrics: [
      "[场景一 · 顶楼办公室]",
      "陆烬背对落地窗，城市灯火在他身后铺成一条银河。",
      "陆烬：「这个项目，你来主导。」",
      "苏念：「我以为你只信自己。」",
      "陆烬：「我信能让我冷静下来的人。」",
    ].join("\n"),
    coverPrompt: "panoramic cityscape at night, glass office tower interior, silhouette against floor-to-ceiling window, deep blue with amber highlights",
    bpm: 16,
    key: "深蓝 · 夜景",
    modelVersion: "drama-v3-deep",
    thinkDepth: "deep",
    creditsEstimate: 230,
  },
  {
    title: "雾隐 · 1992 · 巷口烟火",
    genre: "年代悬疑",
    duration: 210,
    lyrics: [
      "[场景一 · 旧巷口]",
      "雾气漫过青石板，远处一盏煤油灯摇晃。",
      "Aiko（旁白）：「那年的雾，吞掉了我半个名字。」",
      "",
      "[场景二 · 门缝里的眼睛]",
      "门缓缓闭上，门缝里露出一双警惕的眼。",
    ].join("\n"),
    coverPrompt: "1990s shanghai alley at dawn, thick fog, oil lamp glow, vintage film grain, muted earth tones",
    bpm: 11,
    key: "雾灰 · 凌晨",
    modelVersion: "drama-v3",
    thinkDepth: "fast",
    creditsEstimate: 60,
  },
];
