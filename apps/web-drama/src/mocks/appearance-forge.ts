// ─────────────────────────────────────────────────────────────────────────────
// mocks/appearance-forge.ts — AI 形象锻造炉样本数据（中文）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ColorScheme,
  FaceSlider,
  ForgeMode,
  ForgeOptions,
  ForgeResult,
  ForgeTemplate,
  LabeledOption,
} from "@ai-star-eco/types/appearance-forge";
import type { ID } from "@ai-star-eco/types/_shared";
import {
  DEMO_FORGE_VIDEO_POOL,
  pickDemoForgeVideo,
} from "@/lib/forge-video";

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  { id: "t1", name: "都市精英", image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["都市", "职场", "现代"], style: "urban" },
  { id: "t2", name: "古装少主", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["古风", "国风", "侠义"], style: "guzhuang" },
  { id: "t3", name: "民国名媛", image: "https://images.unsplash.com/photo-1551803091-e20673f15770?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["民国", "年代", "旗袍"], style: "minguo" },
  { id: "t4", name: "校园青春", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["校园", "青春", "治愈"], style: "campus" },
  { id: "t5", name: "商业女王", image: "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["商战", "都市", "高知"], style: "corporate" },
  { id: "t6", name: "悬疑探案", image: "https://images.unsplash.com/photo-1521575107034-e0fa0b594529?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", tags: ["悬疑", "刑侦", "冷感"], style: "mystery" },
];

export const HAIR_STYLES: LabeledOption[] = [
  { id: "h1", label: "黑色直发" },
  { id: "h2", label: "自然微卷" },
  { id: "h3", label: "古装高髻" },
  { id: "h4", label: "内扣短发" },
  { id: "h5", label: "低马尾" },
  { id: "h6", label: "偏分长发" },
];

export const EYE_COLORS: LabeledOption[] = [
  { id: "e1", label: "含情脉脉", color: "#7a4a36" },
  { id: "e2", label: "凌厉冷感", color: "#1f2233" },
  { id: "e3", label: "温柔治愈", color: "#a06a4c" },
  { id: "e4", label: "古典清冷", color: "#3d4a5c" },
  { id: "e5", label: "灵动活泼", color: "#b07f3a" },
  { id: "e6", label: "沉稳坚定", color: "#2f2a26" },
];

export const STYLE_TAGS: LabeledOption[] = [
  { id: "s1", label: "含蓄克制" },
  { id: "s2", label: "端庄大气" },
  { id: "s3", label: "灵气出众" },
  { id: "s4", label: "沉郁内敛" },
  { id: "s5", label: "飒爽干练" },
  { id: "s6", label: "清冷孤傲" },
  { id: "s7", label: "明朗温柔" },
  { id: "s8", label: "古典端方" },
];

export const FACE_SLIDERS: FaceSlider[] = [
  { id: "jawline",   label: "下颌线" },
  { id: "cheekbone", label: "颧骨" },
  { id: "eyeSize",   label: "眼型大小" },
  { id: "noseWidth", label: "鼻翼宽度" },
  { id: "lipFull",   label: "唇部丰满" },
  { id: "skinTone",  label: "肤色色调" },
];

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: "cs1", name: "素雅", colors: ["#d8c9b3", "#4a3f33"] },
  { id: "cs2", name: "暖调", colors: ["#c2785a", "#e8c39a"] },
  { id: "cs3", name: "冷调", colors: ["#3e5a73", "#94a8b8"] },
  { id: "cs4", name: "国风", colors: ["#7a3431", "#c69f60"] },
];

export const PROMPT_SUGGESTIONS: string[] = [
  "都市言情",
  "古风武侠",
  "民国旗袍",
  "现代职场",
  "校园青春",
];

export { DEMO_FORGE_VIDEO_POOL, pickDemoForgeVideo };

export const FORGE_OPTIONS: ForgeOptions = {
  templates: FORGE_TEMPLATES,
  hairStyles: HAIR_STYLES,
  eyeColors: EYE_COLORS,
  styleTags: STYLE_TAGS,
  faceSliders: FACE_SLIDERS,
  colorSchemes: COLOR_SCHEMES,
  promptSuggestions: PROMPT_SUGGESTIONS,
};

/** 历史记录：默认空，由组件在本地状态中追加（锻造炉页面内的会话级历史）。 */
export const FORGE_HISTORY: ForgeResult[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK_APPEARANCES —— 按 artistId 分组的"历史形象库"。艺人详情页的 AI 形象画廊
// 只读消费此列表；锻造炉生成的新结果会被 push 到这里（mock 模式下为会话态）。
// 每位艺人 2–4 张，其中恰好 1 张 status='official' 对应 Artist.officialAppearanceId。
// ─────────────────────────────────────────────────────────────────────────────

const tplImage = (i: number) => FORGE_TEMPLATES[i % FORGE_TEMPLATES.length].image;

export const MOCK_APPEARANCES: ForgeResult[] = [
  // Artist 1（epic 主演，3 张：1 官方 + 1 上架 + 1 草稿）
  { id: "ap-1-1", artistId: "1", image: tplImage(0), prompt: "都市精英女主 · 高马尾 · 含情脉脉 · 米色针织", mode: "template_prompt", createdAt: "2025-03-12T09:10:00Z", locked: [], status: "official", usageCount: 14 },
  { id: "ap-1-2", artistId: "1", image: tplImage(2), prompt: "民国名媛宴会场 · 旗袍 · 古典清冷", mode: "template_photo", createdAt: "2025-02-20T14:30:00Z", locked: ["eyeSize"], status: "listed", usageCount: 6, marketplace: { price: 48_000, listedAt: "2025-03-01T00:00:00Z", soldCount: 2 } },
  { id: "ap-1-3", artistId: "1", image: tplImage(3), prompt: "校园青春客串 · 学生制服 · 灵动活泼", mode: "prompt_only", createdAt: "2025-01-08T11:00:00Z", locked: [], status: "draft" },

  // Artist 2（legendary 头牌，4 张：1 官方 + 2 上架 + 1 已售）
  { id: "ap-2-1", artistId: "2", image: tplImage(4), prompt: "商业女王主视觉 · 西装套裙 · 飒爽干练", mode: "template_prompt", createdAt: "2025-03-28T08:00:00Z", locked: ["cheekbone"], status: "official", usageCount: 28 },
  { id: "ap-2-2", artistId: "2", image: tplImage(0), prompt: "都市言情季播限定 · 黑色直发 · 含蓄克制", mode: "template_prompt", createdAt: "2025-03-05T10:00:00Z", locked: [], status: "listed", usageCount: 11, marketplace: { price: 128_000, listedAt: "2025-03-06T00:00:00Z", soldCount: 5 } },
  { id: "ap-2-3", artistId: "2", image: tplImage(2), prompt: "民国名媛大剧主形象 · 月华裙 · 端庄大气", mode: "template_photo", createdAt: "2025-02-14T09:00:00Z", locked: ["jawline", "eyeSize"], status: "sold", usageCount: 8, marketplace: { price: 260_000, listedAt: "2025-02-15T00:00:00Z", soldCount: 1 } },
  { id: "ap-2-4", artistId: "2", image: tplImage(5), prompt: "悬疑探案外景客串 · 风衣 · 凌厉冷感", mode: "random", createdAt: "2025-01-22T16:20:00Z", locked: [], status: "draft" },

  // Artist 3 — 顾辰（rare 男演员，2 张）
  { id: "ap-3-1", artistId: "3", image: tplImage(5), prompt: "悬疑探案主形象 · 风衣 · 沉郁内敛", mode: "template_prompt", createdAt: "2025-03-18T13:00:00Z", locked: [], status: "official", usageCount: 9 },
  { id: "ap-3-2", artistId: "3", image: tplImage(1), prompt: "古装少主侠义客串 · 长袍 · 清冷孤傲", mode: "template_photo", createdAt: "2025-02-02T12:00:00Z", locked: [], status: "draft" },

  // Artist 4（epic 主持，3 张：1 官方 + 1 上架 + 1 草稿）
  { id: "ap-4-1", artistId: "4", image: tplImage(3), prompt: "校园青春主持人 · 短发 · 明朗温柔", mode: "template_prompt", createdAt: "2025-04-02T15:00:00Z", locked: ["noseWidth"], status: "official", usageCount: 17 },
  { id: "ap-4-2", artistId: "4", image: tplImage(0), prompt: "都市精英节目录制 · 西装马甲 · 含蓄克制", mode: "template_prompt", createdAt: "2025-03-10T09:45:00Z", locked: [], status: "listed", usageCount: 4, marketplace: { price: 56_000, listedAt: "2025-03-11T00:00:00Z", soldCount: 1 } },
  { id: "ap-4-3", artistId: "4", image: tplImage(4), prompt: "商业女王跨界对谈草稿", mode: "random", createdAt: "2025-01-30T10:00:00Z", locked: [], status: "draft" },

  // Artist 5 — 林宛（rare 训练生，2 张）
  { id: "ap-5-1", artistId: "5", image: tplImage(3), prompt: "校园青春日常 · 内扣短发 · 灵动活泼", mode: "template_prompt", createdAt: "2025-03-22T11:30:00Z", locked: [], status: "official", usageCount: 5 },
  { id: "ap-5-2", artistId: "5", image: tplImage(0), prompt: "都市言情女配概念图", mode: "prompt_only", createdAt: "2025-02-18T14:00:00Z", locked: [], status: "draft" },

  // Artist 6（common 新人，1 张）
  { id: "ap-6-1", artistId: "6", image: tplImage(1), prompt: "古装少主首发形象 · 高髻 · 古典端方", mode: "template_prompt", createdAt: "2025-03-30T09:00:00Z", locked: ["cheekbone", "jawline"], status: "official", usageCount: 3 },

  // Artist 7 — 沈知夏（legendary 全能，4 张：1 官方 + 1 上架 + 1 已售 + 1 草稿）
  { id: "ap-7-1", artistId: "7", image: tplImage(4), prompt: "商业女王 · 主视觉 · 飒爽干练", mode: "template_prompt", createdAt: "2025-04-01T08:00:00Z", locked: ["eyeSize"], status: "official", usageCount: 22 },
  { id: "ap-7-2", artistId: "7", image: tplImage(5), prompt: "悬疑探案短剧主形象 · 沉郁内敛", mode: "template_photo", createdAt: "2025-03-08T10:15:00Z", locked: [], status: "listed", usageCount: 7, marketplace: { price: 180_000, listedAt: "2025-03-09T00:00:00Z", soldCount: 3 } },
  { id: "ap-7-3", artistId: "7", image: tplImage(2), prompt: "民国名媛跨界时装形象 · 旗袍 · 端庄大气", mode: "template_prompt", createdAt: "2025-02-05T12:00:00Z", locked: [], status: "sold", usageCount: 12, marketplace: { price: 320_000, listedAt: "2025-02-06T00:00:00Z", soldCount: 1 } },
  { id: "ap-7-4", artistId: "7", image: tplImage(0), prompt: "都市精英综艺客串草稿", mode: "random", createdAt: "2025-01-10T09:00:00Z", locked: [], status: "draft" },
];

// ─────────────────────────────────────────────────────────────────────────────
// generateMockAppearancesFor —— 为没有种子形象的艺人（如孵化器新建）按 artistId
// 确定性合成 3 张形象（1 official + 1 listed + 1 draft），供画廊 demo。
// 生成结果会被 api 层 push 到 MOCK_APPEARANCES，保证会话内幂等。
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_PROMPTS = [
  "首发官方形象 · 模版合成",
  "主线剧集限定 · 试妆定档",
  "实验性概念草稿",
  "跨界时装形象",
  "宣传海报主形象",
  "综艺客串造型",
];

const AUTO_MODES: ForgeMode[] = ["template_prompt", "template_photo", "prompt_only"];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generateMockAppearancesFor(artistId: ID): ForgeResult[] {
  const seed = hashSeed(String(artistId));
  const now = Date.now();
  const items: ForgeResult[] = [];
  for (let i = 0; i < 3; i++) {
    const tpl = FORGE_TEMPLATES[(seed + i * 2) % FORGE_TEMPLATES.length];
    const prompt = AUTO_PROMPTS[(seed + i) % AUTO_PROMPTS.length];
    const mode = AUTO_MODES[i % AUTO_MODES.length];
    const createdAt = new Date(now - (i + 1) * 3 * 24 * 60 * 60 * 1000).toISOString();
    const status: ForgeResult["status"] = i === 0 ? "official" : i === 1 ? "listed" : "draft";
    const usageCount = i === 0 ? 4 + (seed % 6) : i === 1 ? 1 + (seed % 3) : undefined;
    const marketplace = i === 1
      ? { price: 40_000 + (seed % 8) * 5_000, listedAt: createdAt, soldCount: seed % 3 }
      : undefined;
    items.push({
      id: `ap-auto-${artistId}-${i + 1}`,
      artistId,
      image: tpl.image,
      prompt,
      mode,
      createdAt,
      locked: [],
      status,
      usageCount,
      marketplace,
    });
  }
  return items;
}
