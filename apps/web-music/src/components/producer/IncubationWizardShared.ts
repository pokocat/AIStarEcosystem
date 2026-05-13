// ─────────────────────────────────────────────────────────────────────────────
// IncubationWizardShared.ts — 孵化向导 v1 / v2 共享的数据与逻辑
// ─────────────────────────────────────────────────────────────────────────────
// 存放内容：
//   - WizardState（顶层字段 + 全部 incubationParams 键）
//   - 默认值、枚举、FALLBACK_* 静态清单（与后端 DemoCatalogSeeder seed 对齐）
//   - getTypeSpecificGate（按 ArtistType 门控 Step 4 显示哪组字段）
//   - buildIncubationParams（把 state 压成 JSON 时过滤空值 / 空数组）
//   - randomize 辅助
//
// 使用：
//   - IncubationWizardV2.tsx（正式版，Genesis Chamber 布局）
//   - IncubationWizard.legacy.tsx（v1 step 形式，已下线，仅作备份保留）
// ─────────────────────────────────────────────────────────────────────────────

import {
  type ArtistType,
  type TalentProfile,
} from "@ai-star-eco/types/artist";
import { ARTIST_TYPE_CONFIG } from "@/constants/artist-config";

// ── 类型 ────────────────────────────────────────────────────────────────────
export interface WizardState {
  // 顶层 Artist 字段
  name: string;
  type: ArtistType;
  bio: string;
  talents: TalentProfile;
  // 以下所有字段都会进 incubationParams JSON
  faceStyle: string;
  fashionStyle: string;
  age: number;
  height: number;
  generation: string;
  signatureColor: string;
  sweetness: number;
  energy: number;
  mystery: number;
  confidence: number;
  extraPersona: number;
  mbti: string;
  personaTags: string[];
  speakingStyle: string;
  vocalRange: string;
  voiceTone: string;
  musicGenres: string[];
  creatorMode: string;
  danceStyles: string[];
  hostingStyle: string;
  actingGenres: string;
  targetAudience: string;
  fanColor: string;
  fandomName: string;
  brandRestrictions: string[];
  backstory: string;
  groupAffiliation: string;
}

export type WizardTemplate = { id: string; type: ArtistType; zh: string; en: string; color: string };
export type LabeledI18n = { id: string; zh: string; en: string };
export type FandomColor = LabeledI18n & { color: string };

export interface TypeSpecificGate {
  music: boolean;
  dance: boolean;
  hosting: boolean;
  acting: boolean;
}

export function getTypeSpecificGate(type: ArtistType): TypeSpecificGate {
  switch (type) {
    case "singer":      return { music: true,  dance: false, hosting: false, acting: false };
    case "idol":        return { music: true,  dance: true,  hosting: false, acting: false };
    case "all_rounder": return { music: true,  dance: true,  hosting: false, acting: true  };
    case "dancer":      return { music: false, dance: true,  hosting: false, acting: false };
    case "host":        return { music: false, dance: false, hosting: true,  acting: false };
    case "entertainer": return { music: false, dance: false, hosting: true,  acting: false };
    case "actor":       return { music: false, dance: false, hosting: false, acting: true  };
    default:            return { music: false, dance: false, hosting: false, acting: false };
  }
}

// ── 常量 ────────────────────────────────────────────────────────────────────
export const GENERATIONS = ["95后", "00后", "05后", "10后"] as const;
export const CREATOR_MODES = ["singer_only", "lyric", "full"] as const;

export const INITIAL_STATE: WizardState = {
  name: "", type: "singer", bio: "",
  talents: { ...ARTIST_TYPE_CONFIG.singer.initialTalents },
  faceStyle: "sweet", fashionStyle: "modern", age: 20, height: 168,
  generation: "00后", signatureColor: "",
  sweetness: 50, energy: 60, mystery: 40, confidence: 70, extraPersona: 50,
  mbti: "", personaTags: [], speakingStyle: "",
  vocalRange: "", voiceTone: "", musicGenres: [], creatorMode: "singer_only",
  danceStyles: [], hostingStyle: "", actingGenres: "",
  targetAudience: "", fanColor: "", fandomName: "", brandRestrictions: [],
  backstory: "", groupAffiliation: "",
};

// ── FALLBACK 选项清单（与 DemoCatalogSeeder seed 对齐） ──────────────────────
export const FALLBACK_TEMPLATES: WizardTemplate[] = [
  { id: "cute", type: "idol", zh: "甜美偶像", en: "Cute Idol", color: "border-pink-500/30 hover:border-pink-400/60" },
  { id: "cool", type: "singer", zh: "酷炫歌手", en: "Cool Singer", color: "border-cyan-500/30 hover:border-cyan-400/60" },
  { id: "elegant", type: "actor", zh: "优雅演员", en: "Elegant Actor", color: "border-purple-500/30 hover:border-purple-400/60" },
  { id: "energetic", type: "entertainer", zh: "活力综艺", en: "Energetic Host", color: "border-amber-500/30 hover:border-amber-400/60" },
  { id: "mysterious", type: "dancer", zh: "神秘舞者", en: "Mysterious Dancer", color: "border-green-500/30 hover:border-green-400/60" },
  { id: "custom", type: "singer", zh: "自定义", en: "Custom", color: "border-white/10 hover:border-white/30" },
];

export const FALLBACK_FACE_STYLES: LabeledI18n[] = [
  { id: "sweet", zh: "甜美", en: "Sweet" },
  { id: "cool", zh: "酷帅", en: "Cool" },
  { id: "elegant", zh: "优雅", en: "Elegant" },
  { id: "cute", zh: "可爱", en: "Cute" },
  { id: "sharp", zh: "凌厉", en: "Sharp" },
  { id: "soft", zh: "温柔", en: "Soft" },
];

export const FALLBACK_FASHION_STYLES: LabeledI18n[] = [
  { id: "modern", zh: "现代潮流", en: "Modern" },
  { id: "retro", zh: "复古", en: "Retro" },
  { id: "cyberpunk", zh: "赛博朋克", en: "Cyberpunk" },
  { id: "casual", zh: "休闲", en: "Casual" },
  { id: "formal", zh: "正式", en: "Formal" },
  { id: "sporty", zh: "运动", en: "Sporty" },
];

export const FALLBACK_MBTI_TYPES: LabeledI18n[] = [
  { id: "INFP", zh: "调停者", en: "Mediator" },
  { id: "ENFP", zh: "竞选者", en: "Campaigner" },
  { id: "INFJ", zh: "提倡者", en: "Advocate" },
  { id: "ENFJ", zh: "主人公", en: "Protagonist" },
  { id: "INTJ", zh: "建筑师", en: "Architect" },
  { id: "ENTP", zh: "辩论家", en: "Debater" },
  { id: "ISFP", zh: "探险家", en: "Adventurer" },
  { id: "ESFP", zh: "表演者", en: "Entertainer" },
  { id: "ISTP", zh: "鉴赏家", en: "Virtuoso" },
  { id: "ESTP", zh: "企业家", en: "Entrepreneur" },
];

export const FALLBACK_PERSONA_TAGS: LabeledI18n[] = [
  { id: "healing", zh: "治愈系", en: "Healing" },
  { id: "contrast", zh: "反差萌", en: "Contrast" },
  { id: "scholar", zh: "学霸", en: "Scholar" },
  { id: "foodie", zh: "吃货", en: "Foodie" },
  { id: "cold", zh: "高冷", en: "Aloof" },
  { id: "warm", zh: "邻家", en: "Warm" },
  { id: "naive", zh: "天然呆", en: "Airheaded" },
  { id: "dark", zh: "暗黑系", en: "Dark" },
  { id: "royal", zh: "王者", en: "Regal" },
  { id: "geek", zh: "极客", en: "Geek" },
];

export const FALLBACK_VOCAL_RANGES: LabeledI18n[] = [
  { id: "soprano", zh: "女高音", en: "Soprano" },
  { id: "mezzo", zh: "女中音", en: "Mezzo-Soprano" },
  { id: "alto", zh: "女低音", en: "Alto" },
  { id: "tenor", zh: "男高音", en: "Tenor" },
  { id: "baritone", zh: "男中音", en: "Baritone" },
  { id: "bass", zh: "男低音", en: "Bass" },
];

export const FALLBACK_MUSIC_GENRES: LabeledI18n[] = [
  { id: "pop", zh: "流行", en: "Pop" },
  { id: "rnb", zh: "R&B", en: "R&B" },
  { id: "electronic", zh: "电子", en: "Electronic" },
  { id: "rock", zh: "摇滚", en: "Rock" },
  { id: "hiphop", zh: "嘻哈说唱", en: "Hip-Hop" },
  { id: "cnstyle", zh: "国风", en: "Chinese Style" },
  { id: "ballad", zh: "抒情慢歌", en: "Ballad" },
  { id: "citypop", zh: "City-Pop", en: "City-Pop" },
];

export const FALLBACK_DANCE_STYLES: LabeledI18n[] = [
  { id: "kpop", zh: "K-Pop 编舞", en: "K-Pop" },
  { id: "urban", zh: "Urban", en: "Urban" },
  { id: "jazz", zh: "Jazz Funk", en: "Jazz Funk" },
  { id: "breaking", zh: "Breaking", en: "Breaking" },
  { id: "classical", zh: "中国古典舞", en: "Chinese Classical" },
  { id: "ballet", zh: "芭蕾", en: "Ballet" },
  { id: "contemporary", zh: "现代舞", en: "Contemporary" },
];

export const FALLBACK_FANDOM_COLORS: FandomColor[] = [
  { id: "rose", zh: "玫瑰粉", en: "Rose", color: "#f472b6" },
  { id: "sky", zh: "天空蓝", en: "Sky", color: "#38bdf8" },
  { id: "mint", zh: "薄荷绿", en: "Mint", color: "#10b981" },
  { id: "lavender", zh: "薰衣草紫", en: "Lavender", color: "#a855f7" },
  { id: "sunshine", zh: "阳光黄", en: "Sunshine", color: "#fbbf24" },
  { id: "coral", zh: "珊瑚橙", en: "Coral", color: "#fb923c" },
  { id: "pearl", zh: "珍珠白", en: "Pearl", color: "#f8fafc" },
  { id: "obsidian", zh: "曜石黑", en: "Obsidian", color: "#0f172a" },
];

export const FALLBACK_BRAND_RESTRICTIONS: LabeledI18n[] = [
  { id: "alcohol", zh: "烟酒类", en: "Alcohol & Tobacco" },
  { id: "gambling", zh: "博彩赌博", en: "Gambling" },
  { id: "crypto", zh: "加密货币", en: "Cryptocurrency" },
  { id: "medical", zh: "医疗保健", en: "Medical" },
  { id: "weightloss", zh: "减肥塑身", en: "Weight Loss" },
  { id: "loan", zh: "网贷金融", en: "Online Lending" },
  { id: "games", zh: "重度游戏", en: "Hardcore Games" },
];

// ── 预制样本库（随机生成按钮用） ─────────────────────────────────────────────
export const RANDOM_PRESETS: Record<ArtistType, { name: string; bio: string }[]> = {
  singer: [
    { name: "星澪 Xingli", bio: "出身于数据星海的电子声线歌手，擅长氛围电子、未来 R&B；代表作《霓虹心跳》《星海回声》。嗓音兼具少年感和金属质感。" },
    { name: "夜语 Yeyu", bio: "深夜系创作女伶，融合爵士和合成流行。擅长在慢歌中制造情绪钩子，被乐评称为\"耳机里的告白\"。" },
    { name: "苏陌 Su Mo", bio: "来自虚拟成都的独立唱作人，偏爱复古蒸汽波；自弹自唱＋AI 编曲，擅长温柔治愈向都市民谣。" },
  ],
  actor: [
    { name: "江予安 Jiang Yu'an", bio: "虚拟影视新生代，气质沉静、镜头感极强。偏爱悬疑文艺片，被算法标记为\"下一位被摄影机宠爱的数字演员\"。" },
    { name: "白见瑟 Bai Jianse", bio: "古装造型担当，五官立体、身段从容；擅长演绎权谋戏与悲情女主，定妆照登上多次站内热搜。" },
    { name: "陆决 Lu Jue", bio: "数字硬汉系男主，体态挺拔、眼神克制。擅长刑侦、军旅、科幻动作题材，动作捕捉表现稳定。" },
  ],
  entertainer: [
    { name: "叮当 Dingdang", bio: "综艺气氛担当，反应飞快、金句密集。擅长即兴游戏和户外真人秀，主持节奏稳中带皮。" },
    { name: "米可 Miko", bio: "萌系综艺 AI，天然呆＋高情商，擅长团综和观察类节目。弹幕盛赞\"被她逗笑的概率是 92%\"。" },
    { name: "阿栗 A Li", bio: "脱口秀风格综艺咖，冷幽默、善吐槽、能带节目。擅长即兴辩论和段子类 Vlog。" },
  ],
  dancer: [
    { name: "霓九 Ni Jiu", bio: "K-Pop 风格编舞天才，四肢线条利落，擅长 Urban / Jazz Funk / Girls Hip-Hop；舞台爆发力满分。" },
    { name: "流云 Liuyun", bio: "中国风古典舞者，水袖、扇舞、长剑均游刃有余；擅长在写意场景中塑造意境感。" },
    { name: "疾光 Jiguang", bio: "街舞 Breaking 新锐，Power Move 流畅；曾于虚拟舞者大赛拿下全国亚军。" },
  ],
  host: [
    { name: "林慢 Lin Man", bio: "文艺访谈主持人，温柔不冷场、擅长深度对话；声线稳、共情强，是深夜节目的黄金搭子。" },
    { name: "郑野 Zheng Ye", bio: "新闻资讯主持人，播报节奏干净利落；擅长解读财经与科技事件，逻辑感强。" },
    { name: "可乐 Kele", bio: "直播带货 AI 主持，口条快、互动爆棚；能同时串场、讲解、控场，是品牌直播的稳定产出者。" },
  ],
  all_rounder: [
    { name: "苏九歌 Su Jiuge", bio: "唱跳演三栖全能 AI，音色辨识度高，舞台控场稳定；粉丝称\"数字化时代的流量模板\"。" },
    { name: "陈诺宁 Chen Nuoning", bio: "多栖偶像型，唱歌＋影视＋综艺三线开花；团体出身，单飞后代言数量稳步增长。" },
    { name: "言夕 Yan Xi", bio: "风格多变的全能 AI，能驾驭古风、电子、日系 City-Pop；擅长舞台剧和短剧跨界。" },
  ],
  idol: [
    { name: "小月芽 Xiaoyueya", bio: "甜系养成偶像，招牌微笑＋元气舞台。粉丝社群活跃度极高，月饼头＋JK 造型是标志性形象。" },
    { name: "陆昭昭 Lu Zhaozhao", bio: "日系学生偶像路线，声线偏软、表情管理满分；擅长应援向单曲与粉丝互动直播。" },
    { name: "云希 Yunxi", bio: "韩系酷飒女团风，舞台张力强、Vocal 稳；擅长 Girl Crush 概念曲和团综互动。" },
  ],
};

// ── 辅助函数 ────────────────────────────────────────────────────────────────
export const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * 把向导 state 压成 incubationParams JSON：
 *  - 顶层 Artist 字段（name/type/bio/talents）不进来
 *  - 空字符串 / undefined / null / 空数组 一律过滤，避免污染 JSON 与 LLM prompt
 */
export function buildIncubationParams(state: WizardState): Record<string, unknown> {
  const gate = getTypeSpecificGate(state.type);
  const p: Record<string, unknown> = {
    faceStyle: state.faceStyle,
    fashionStyle: state.fashionStyle,
    age: state.age,
    height: state.height,
    sweetness: state.sweetness,
    energy: state.energy,
    mystery: state.mystery,
    confidence: state.confidence,
    extraPersona: state.extraPersona,
  };
  const put = (key: string, v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === "string" && v.trim() === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    p[key] = v;
  };
  put("generation", state.generation);
  put("signatureColor", state.signatureColor);
  put("mbti", state.mbti);
  put("personaTags", state.personaTags);
  put("speakingStyle", state.speakingStyle.trim());
  if (gate.music) {
    put("vocalRange", state.vocalRange);
    put("voiceTone", state.voiceTone.trim());
    put("musicGenres", state.musicGenres);
    put("creatorMode", state.creatorMode);
  }
  if (gate.dance) put("danceStyles", state.danceStyles);
  if (gate.hosting) put("hostingStyle", state.hostingStyle.trim());
  if (gate.acting) put("actingGenres", state.actingGenres.trim());
  put("targetAudience", state.targetAudience.trim());
  put("fanColor", state.fanColor);
  put("fandomName", state.fandomName.trim());
  put("brandRestrictions", state.brandRestrictions);
  put("backstory", state.backstory.trim());
  put("groupAffiliation", state.groupAffiliation.trim());
  return p;
}

/**
 * 随机生成一整套 WizardState。
 * 需要注入当前远程可能已热更的选项列表，保证随机值与 UI 可见选项一致。
 */
export function randomizeState(
  current: WizardState,
  options: {
    mbti: LabeledI18n[];
    personaTags: LabeledI18n[];
    vocalRanges: LabeledI18n[];
    musicGenres: LabeledI18n[];
    danceStyles: LabeledI18n[];
    fandomColors: FandomColor[];
  },
): WizardState {
  const types: ArtistType[] = ["singer", "actor", "entertainer", "dancer", "host", "all_rounder", "idol"];
  const rType = pickRandom(types);
  const pool = RANDOM_PRESETS[rType];
  const preset = pickRandom(pool);
  const g = getTypeSpecificGate(rType);
  const rTags = [...options.personaTags].sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.id);
  const rGenres = g.music ? [...options.musicGenres].sort(() => 0.5 - Math.random()).slice(0, 2).map(x => x.id) : [];
  const rDance = g.dance ? [...options.danceStyles].sort(() => 0.5 - Math.random()).slice(0, 2).map(x => x.id) : [];
  return {
    ...current,
    name: preset.name,
    type: rType,
    bio: preset.bio,
    generation: pickRandom(GENERATIONS),
    signatureColor: pickRandom(options.fandomColors).id,
    sweetness: Math.floor(Math.random() * 100),
    energy: Math.floor(Math.random() * 100),
    mystery: Math.floor(Math.random() * 100),
    confidence: Math.floor(Math.random() * 100),
    extraPersona: Math.floor(Math.random() * 100),
    mbti: pickRandom(options.mbti).id,
    personaTags: rTags,
    speakingStyle: "",
    vocalRange: g.music ? pickRandom(options.vocalRanges).id : "",
    voiceTone: "",
    musicGenres: rGenres,
    creatorMode: g.music ? pickRandom(CREATOR_MODES) : "singer_only",
    danceStyles: rDance,
    hostingStyle: "",
    actingGenres: "",
    targetAudience: "",
    fanColor: pickRandom(options.fandomColors).id,
    fandomName: "",
    brandRestrictions: [],
    backstory: "",
    groupAffiliation: "",
    talents: { ...ARTIST_TYPE_CONFIG[rType].initialTalents },
    age: 16 + Math.floor(Math.random() * 14),
    height: 155 + Math.floor(Math.random() * 30),
  };
}
