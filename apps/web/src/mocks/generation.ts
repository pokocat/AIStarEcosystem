// ─────────────────────────────────────────────────────────────────────────────
// mocks/generation.ts — 虚拟 LLM 生成样本。
// STAGE_SCRIPT 提供阶段化的"流式"文本骨架，组件按 typewriter 节拍逐字吐出。
// MOCK_DRAFTS 提供候选产物，运行时随机抽一条作为 draft。
// 模板里的 {{prompt}} / {{artist}} 会在组件层被替换为运行时值。
// ─────────────────────────────────────────────────────────────────────────────

import type { StreamStage, GeneratedMusicDraft } from "@/types/generation";

export const STAGE_SEQUENCE: StreamStage[] = [
  "analyzing",
  "composing",
  "lyrics",
  "arranging",
  "mastering",
];

export const STAGE_SCRIPT: Record<StreamStage, string[]> = {
  analyzing: [
    "🧠 正在解析创作意图…",
    "· 主题关键词：{{prompt}}",
    "· 目标画像：18-28 岁 · 夜晚情绪共振",
    "· 参考坐标：City Pop × Synthwave × 电子声场",
    "✓ 方向已锁定，进入作曲阶段",
  ],
  composing: [
    "🎼 构建旋律与结构…",
    "· 曲式：Intro → Verse×2 → Pre-Chorus → Chorus×2 → Bridge → Chorus Outro",
    "· 调式：A 小调 · 128 BPM",
    "· 副歌记忆点：大二度推进 + 四度跳进",
    "✓ 旋律骨架完成，开始配词",
  ],
  lyrics: [
    "✍️ 撰写中文歌词…",
    "[Verse 1]",
    "霓虹在雨里模糊 像心跳的余温",
    "你说你想飞去城市的尽头",
    "",
    "[Chorus]",
    "再陪我走一条街 走到光都用完",
    "我们把影子留给夜晚当门牌",
    "✓ 首段歌词生成，进入编曲",
  ],
  arranging: [
    "🎛️ 合成乐器轨…",
    "· 主声：{{artist}} 专属声库 v3",
    "· 配器：808 鼓 · 合成 bass · 琶音器 · pad · glock",
    "· 空间感：大厅混响 1.2s · 立体声宽度 90%",
    "✓ 编曲就绪，进入母带",
  ],
  mastering: [
    "🔊 母带动态整合…",
    "· 限幅器：-0.3 dBTP",
    "· 响度：-9.5 LUFS（流媒体友好）",
    "✓ 母带完成，下一步可试听 / 采纳 / 再来一版",
  ],
};

/**
 * 产物候选池。组件在 mastering 收尾时随机抽一条作为最终 draft。
 * 真实后端会基于 prompt + 声库 + 模型版本生成独立内容，这里仅做形态占位。
 */
export const MOCK_DRAFTS: GeneratedMusicDraft[] = [
  {
    title: "霓虹余温",
    genre: "Synthwave",
    duration: 218,
    lyrics: [
      "[Verse 1]",
      "霓虹在雨里模糊 像心跳的余温",
      "你说你想飞去城市的尽头",
      "",
      "[Chorus]",
      "再陪我走一条街 走到光都用完",
      "我们把影子留给夜晚当门牌",
    ].join("\n"),
    coverPrompt: "cyberpunk neon alley in rain, wide panoramic, teal and magenta palette, cinematic lighting",
    bpm: 128,
    key: "A minor",
    modelVersion: "suno-v3",
    thinkDepth: "standard",
    creditsEstimate: 80,
  },
  {
    title: "午夜潮汐",
    genre: "Electronic",
    duration: 196,
    lyrics: [
      "[Verse 1]",
      "手机屏幕的光 照着半张脸",
      "潮汐没退过 你也没说再见",
      "",
      "[Chorus]",
      "别让这一夜变 别让这句话远",
      "我们把清晨折叠进梦的边缘",
    ].join("\n"),
    coverPrompt: "midnight beach under aurora, low contrast dark teal, lonely silhouette, synthwave aesthetic",
    bpm: 124,
    key: "F# minor",
    modelVersion: "suno-v3",
    thinkDepth: "standard",
    creditsEstimate: 80,
  },
  {
    title: "镜像花园",
    genre: "Pop",
    duration: 243,
    lyrics: [
      "[Verse 1]",
      "我们在镜子里种一片花",
      "风吹过 颜色才浮出水面",
      "",
      "[Chorus]",
      "如果故事需要一个名字",
      "就把今天写成永远的春天",
    ].join("\n"),
    coverPrompt: "surreal mirror garden with blooming flowers, pastel dreamy palette, soft bokeh",
    bpm: 96,
    key: "C major",
    modelVersion: "suno-v3-deep",
    thinkDepth: "deep",
    creditsEstimate: 230,
  },
  {
    title: "星轨信号",
    genre: "EDM",
    duration: 210,
    lyrics: [
      "[Verse 1]",
      "卫星把我藏在雷达的缝隙",
      "心跳是剩下唯一的信号",
      "",
      "[Chorus]",
      "飞过银河也不关手机",
      "我们在轨道上对齐",
    ].join("\n"),
    coverPrompt: "space orbit with neon stars, dark cosmic background, vibrant purple and pink highlights",
    bpm: 132,
    key: "E minor",
    modelVersion: "suno-v3",
    thinkDepth: "fast",
    creditsEstimate: 60,
  },
];
