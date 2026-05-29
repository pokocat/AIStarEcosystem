// ─────────────────────────────────────────────────────────────────────────────
// 素材运营演示数据 —— 移植自「素材运营平台」原型 data.js，对齐复用类型，
// 颜色改用 creator 调色板 hex，商品/脚本/视频用 product_id 显式互链。
// 组件默认渲染直接 import 这些数组；用户动作走 api/material-ops.ts（mock + localStorage）。
// ─────────────────────────────────────────────────────────────────────────────

import { PALETTE } from "@/constants/material-ops-ui";
import type { Product } from "@ai-star-eco/types/product";
import type {
  MaterialProduct,
  MaterialVideo,
  ScriptAsset,
  ViralHit,
} from "@/components/material-ops/types";

const today = "2026-05-26";

// ── 商品（复用 Product；emoji/accentColor/audience 等为展示扩展） ─────────────
export const MATERIAL_PRODUCTS: MaterialProduct[] = [
  {
    id: "p1",
    name: "德绒高领打底衫",
    category: "服饰",
    link: "",
    images: [],
    sellingPoints: "德绒发热不臃肿 / 高领修脸不挑身材 / 160 微胖姐妹友好 / 69 元价格带",
    sellingPointList: ["德绒发热不臃肿", "高领修脸不挑身材", "160 微胖姐妹友好", "69 元价格带"],
    usageCount: 56,
    source: "manual",
    priceCents: 6900,
    commissionRate: 28,
    stock: 8420,
    emoji: "👚",
    accentColor: PALETTE.violet,
    audience: ["女性 25-40", "微胖姐妹", "通勤打工人"],
    suggestedAngles: ["身材共鸣", "价格反差", "上身展示"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "p2",
    name: "低糖速食燕麦",
    category: "食品饮料",
    link: "",
    images: [],
    sellingPoints: "0 蔗糖添加 / 5 分钟即食 / 高纤维饱腹强 / 低 GI 不容易饿",
    sellingPointList: ["0 蔗糖添加", "5 分钟即食", "高纤维饱腹强", "低 GI 不容易饿"],
    usageCount: 96,
    source: "manual",
    priceCents: 3900,
    commissionRate: 32,
    stock: 12030,
    emoji: "🥣",
    accentColor: PALETTE.teal,
    audience: ["打工人", "减脂女性", "早餐困难户"],
    suggestedAngles: ["打工人共鸣", "减脂场景", "5min 教程"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "p3",
    name: "玻尿酸保湿精华",
    category: "美妆",
    link: "",
    images: [],
    sellingPoints: "多重玻尿酸 / 保湿 12h / 敏感肌可用 / 90 天对比",
    sellingPointList: ["多重玻尿酸", "保湿 12h", "敏感肌可用", "90 天对比"],
    usageCount: 142,
    source: "manual",
    priceCents: 15900,
    commissionRate: 40,
    stock: 2240,
    emoji: "💧",
    accentColor: PALETTE.rose,
    audience: ["女性 25-35", "敏感肌人群", "抗老入门"],
    suggestedAngles: ["母女反差", "90 天对比", "成分讲解"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "p4",
    name: "颈椎按摩仪 Pro",
    category: "数码 3C",
    link: "",
    images: [],
    sellingPoints: "热敷 + 按摩双模 / 20 分钟自动关 / 可充电便携 / 送礼自用都合适",
    sellingPointList: ["热敷 + 按摩双模", "20 分钟自动关", "可充电便携", "送礼自用都合适"],
    usageCount: 312,
    source: "manual",
    priceCents: 22900,
    commissionRate: 25,
    stock: 1860,
    emoji: "🪑",
    accentColor: PALETTE.amber,
    audience: ["女性 30-50", "久坐打工人", "送父母送老婆"],
    suggestedAngles: ["蓝领情感", "送礼故事", "伴侣视角"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "p5",
    name: "迷你筋膜枪",
    category: "运动",
    link: "",
    images: [],
    sellingPoints: "口袋大小可携带 / 4 档力度可调 / 健身办公双用 / 低噪音",
    sellingPointList: ["口袋大小可携带", "4 档力度可调", "健身办公双用", "低噪音"],
    usageCount: 24,
    source: "manual",
    priceCents: 18900,
    commissionRate: 30,
    stock: 940,
    emoji: "🏋",
    accentColor: PALETTE.violetDeep,
    audience: ["健身爱好者", "办公族", "运动初学者"],
    suggestedAngles: ["办公室自救", "健身房测评", "反差小巧"],
    createdAt: today,
    updatedAt: today,
  },
  {
    id: "p6",
    name: "冻干益生菌",
    category: "其他",
    link: "",
    images: [],
    sellingPoints: "8 株活菌冻干 / 常温保存 / 低温运输 / 6 岁可服",
    sellingPointList: ["8 株活菌冻干", "常温保存", "低温运输", "6 岁可服"],
    usageCount: 18,
    source: "manual",
    priceCents: 9900,
    commissionRate: 35,
    stock: 5410,
    emoji: "🦠",
    accentColor: PALETTE.teal,
    audience: ["宝妈", "便秘人群", "免疫力关注者"],
    suggestedAngles: ["宝妈群推荐", "体感对比", "冻干工艺"],
    createdAt: today,
    updatedAt: today,
  },
];

export function getProduct(id?: string): MaterialProduct | undefined {
  if (!id) return undefined;
  return MATERIAL_PRODUCTS.find((p) => p.id === id);
}

// 类目 → 展示元数据（emoji / 主题色），给商品库里非素材运营的商品补默认展示。
const CATEGORY_ENRICH: Record<string, { emoji: string; accentColor: string }> = {
  美妆: { emoji: "💄", accentColor: PALETTE.rose },
  食品饮料: { emoji: "🥣", accentColor: PALETTE.teal },
  "数码 3C": { emoji: "📱", accentColor: PALETTE.violet },
  服饰: { emoji: "👕", accentColor: PALETTE.violetDeep },
  日用百货: { emoji: "🧺", accentColor: PALETTE.amber },
  母婴: { emoji: "🍼", accentColor: PALETTE.peach },
  运动: { emoji: "🏋", accentColor: PALETTE.violetDeep },
  其他: { emoji: "📦", accentColor: PALETTE.teal },
};

/**
 * 任意系统商品（Product）→ 展示用 MaterialProduct。
 * 素材运营自带的 6 个用其完整富数据；商品库里的其它商品按类目补 emoji/色，
 * 卖点串拆成 chip 列表。供新建脚本商品选择器 / 脚本列表展示复用。
 */
export function toMaterialProduct(p: Product): MaterialProduct {
  const rich = MATERIAL_PRODUCTS.find((m) => m.id === p.id);
  if (rich) return rich;
  const meta = CATEGORY_ENRICH[p.category] ?? CATEGORY_ENRICH["其他"];
  const points = (p.sellingPoints ?? "")
    .split(/[/、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    ...p,
    emoji: meta.emoji,
    accentColor: meta.accentColor,
    sellingPointList: points,
    audience: [],
    suggestedAngles: [],
  };
}

// ── 脚本资产（9 条；blocks≈Scene；product_id 显式互链） ────────────────────────
export const SCRIPT_ASSETS: ScriptAsset[] = [
  {
    id: "asset-2604", kind: "viral_clone", name: "蓝领情感 · 送礼老婆", tier: "S",
    category: "小家电", hook_type: "情感", audience: ["女性 30-50", "送礼场景"],
    platforms: ["douyin", "wechat"], duration_sec: 41, product_id: "p4",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "修了 30 年车，第一次给老婆买这个", shot: "油污大手特写 · 镜头怼脸" },
      { kind: "emotion", label: "故事铺垫", dur: 9, text: "修车场景 · 收摊回家 · 老婆揉脖子", shot: "跟拍 · 自然光" },
      { kind: "product", label: "产品揭示", dur: 13, text: "从口袋拿出按摩仪 · 老婆惊讶反应", shot: "产品怼镜 30 帧" },
      { kind: "effect", label: "使用过程", dur: 10, text: "使用 + 老婆“舒服死了” + 笑场", shot: "双人对坐 · 自然光" },
      { kind: "cta", label: "行动召唤", dur: 6, text: "“老婆说有需要的姐妹评论区扣 1”", shot: "CTA + 字幕飘屏" },
    ],
    metrics: { uses_count: 312, ctr_pct: 9.2, diversity_pct: 58, completion_pct: 76, best_video: { script_id: "video-2604-001", plays: "812w", likes: "32w", gmv: "¥184,200" }, last_used_at: "2026-05-26T14:36:00Z" },
    source: { type: "viral", ref_id: "v3", original_url: "https://v.douyin.com/iY7xRk8R", cloned_from: null, author: "@老李修车" },
    tags: ["情感", "蓝领", "送礼", "颈椎"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2598", kind: "my_script", name: "母女反差 · 抗老精华", tier: "S",
    category: "美妆", hook_type: "反差", audience: ["女性 25-35"],
    platforms: ["douyin", "xhs"], duration_sec: 28, product_id: "p3",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "我妈用了这瓶精华，被亲戚以为是我姐", shot: "镜头怼脸 · “你猜我妈多大”" },
      { kind: "scene", label: "人物展示", dur: 5, text: "母亲皮肤特写 · 字幕“52 岁”", shot: "特写 · 自然光" },
      { kind: "product", label: "产品引入", dur: 10, text: "从化妆台拿起精华瓶 · 镜头怼瓶身 30 帧", shot: "产品特写 · 30 帧静帧" },
      { kind: "effect", label: "效果展示", dur: 7, text: "使用前后对比 · 三周时间轴", shot: "对比镜 + 字幕标注" },
      { kind: "cta", label: "行动召唤", dur: 3, text: "“链接放购物车了” + 字幕飘屏", shot: "CTA + 商品弹窗" },
    ],
    metrics: { uses_count: 142, ctr_pct: 8.7, diversity_pct: 68, completion_pct: 72, best_video: { script_id: "video-2598-001", plays: "162w", likes: "6.4w", gmv: "¥98,400" }, last_used_at: "2026-05-24T16:20:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2401", author: "陈彬彬" },
    tags: ["反差", "母女", "抗老"], cover_color: PALETTE.rose, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2591", kind: "template", name: "打工人 vlog · 5min 早餐", tier: "A",
    category: "食品", hook_type: "提问", audience: ["打工人", "减脂女性"],
    platforms: ["xhs", "douyin"], duration_sec: 32, product_id: "p2",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "为什么我吃完早餐 11 点就饿？", shot: "空桌特写 + 提问" },
      { kind: "scene", label: "场景搭建", dur: 7, text: "厨房 vlog 视角 · 烧水 · 倒燕麦", shot: "厨房自然光跟拍" },
      { kind: "product", label: "产品融入", dur: 12, text: "产品袋特写 4 次 · 强调“低糖”标签", shot: "产品特写循环" },
      { kind: "effect", label: "使用展示", dur: 8, text: "撕开倒入 · 加奶搅拌 · 第一口", shot: "近景慢镜" },
      { kind: "cta", label: "CTA", dur: 2, text: "“评论区扣早 + 链接放小黄车”", shot: "CTA + 字幕" },
    ],
    metrics: { uses_count: 96, ctr_pct: 7.1, diversity_pct: 71, completion_pct: 68, best_video: { script_id: "video-2412", plays: "24w", likes: "8.8w", gmv: "¥21,400" }, last_used_at: "2026-05-22T09:00:00Z" },
    source: { type: "viral", ref_id: "v2", original_url: "https://www.xiaohongshu.com/...", cloned_from: null, author: "@早餐打工人" },
    tags: ["打工人", "早餐", "低糖", "减脂"], cover_color: PALETTE.teal, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2585", kind: "viral_clone", name: "微胖姐妹 · 22s 打底测评", tier: "A",
    category: "服饰", hook_type: "身份", audience: ["微胖姐妹", "通勤打工人"],
    platforms: ["xhs"], duration_sec: 22, product_id: "p1",
    blocks: [
      { kind: "hook", label: "身材钩子", dur: 3, text: "160 微胖姐妹，这件打底救我一命", shot: "镜头从下往上 + 字幕“160/68”" },
      { kind: "scene", label: "痛点", dur: 5, text: "展示其他打底显胖 · 翻白眼", shot: "换装快剪 + 反应" },
      { kind: "product", label: "产品上身", dur: 8, text: "穿上德绒打底 · 转圈展示 · 弹幕“绝”", shot: "试衣镜 · 360 度" },
      { kind: "cta", label: "价格 + CTA", dur: 6, text: "“69 块钱姐妹冲” + 链接动画", shot: "CTA + 价格弹窗" },
    ],
    metrics: { uses_count: 56, ctr_pct: 7.8, diversity_pct: 74, completion_pct: 64, best_video: { script_id: "video-2585-001", plays: "14w", likes: "4.2w", gmv: "¥12,600" }, last_used_at: "2026-05-20T11:30:00Z" },
    source: { type: "viral", ref_id: "v4", original_url: "https://v.douyin.com/iA8sLm2X", cloned_from: null, author: "@穿搭小欧" },
    tags: ["微胖", "穿搭", "打底", "69 元"], cover_color: PALETTE.violet, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2480", kind: "template", name: "直播切片 · 抢购场", tier: "B",
    category: "通用", hook_type: "紧迫", audience: ["老铁", "中老年"],
    platforms: ["douyin", "kuaishou"], duration_sec: 30, product_id: "p4",
    blocks: [
      { kind: "hook", label: "主播喊麦", dur: 3, text: "“今天 229 抢 50 台！”", shot: "直播机位 · 怼镜" },
      { kind: "product", label: "产品演示", dur: 10, text: "助理拆封演示 · 主播口播卖点 4 条", shot: "双机位 · 商品台" },
      { kind: "effect", label: "现场体验", dur: 8, text: "观众试用 · 弹幕实时反馈“信她”", shot: "观众席 + 弹幕同框" },
      { kind: "scene", label: "紧迫氛围", dur: 6, text: "“还剩 12 单！姐妹快冲！”", shot: "倒计时数字 + 红色字幕" },
      { kind: "cta", label: "CTA", dur: 3, text: "小黄车自取 · “抢完拉黑下一波”", shot: "CTA + 库存归零" },
    ],
    metrics: { uses_count: 41, ctr_pct: 6.5, diversity_pct: 48, completion_pct: 58, best_video: { script_id: "video-2462", plays: "6.2w", likes: "1.4w", gmv: "¥18,400" }, last_used_at: "2026-05-15T22:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["直播", "抢购", "紧迫"], cover_color: PALETTE.violetDeep, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2477", kind: "my_script", name: "父女视角 · 送礼故事", tier: "A",
    category: "小家电", hook_type: "情感", audience: ["宝妈群体", "送礼场景"],
    platforms: ["douyin", "wechat"], duration_sec: 40, product_id: "p4",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "我爸 50 岁，第一次悄悄给我妈下单了这个", shot: "手机屏幕特写 · 购物车" },
      { kind: "emotion", label: "情感铺垫", dur: 8, text: "闺女躲门后偷拍 · 爸爸的手指划过价格", shot: "门缝偷拍视角" },
      { kind: "product", label: "产品揭示", dur: 11, text: "快递到家 · 妈妈拆出按摩仪愣住", shot: "拆箱节奏 + 妈妈反应" },
      { kind: "effect", label: "效果体验", dur: 10, text: "妈妈戴上 · 爸爸偷笑 · 闺女字幕“破防了”", shot: "三人同框 · 暖光" },
      { kind: "cta", label: "行动召唤", dur: 8, text: "“链接放评论 · 一定要给爸看一眼”", shot: "CTA + 商品弹窗" },
    ],
    metrics: { uses_count: 24, ctr_pct: 7.4, diversity_pct: 79, completion_pct: 71, best_video: { script_id: "video-2461", plays: "8w", likes: "2.1w", gmv: "¥7,200" }, last_used_at: "2026-05-18T14:00:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2604", author: "陈彬彬" },
    tags: ["父女", "反差", "送礼"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
  {
    id: "asset-2412", kind: "template", name: "校园短剧 · 单集", tier: "B",
    category: "通用", hook_type: "剧情", audience: ["学生党", "95 后"],
    platforms: ["douyin"], duration_sec: 60, product_id: "p1",
    blocks: [
      { kind: "hook", label: "冲突钩子", dur: 4, text: "“同桌偷看我抽屉，发现了一个秘密”", shot: "抽屉特写 + 同桌反应" },
      { kind: "scene", label: "场景铺垫", dur: 15, text: "教室场景 · 上课偷传纸条", shot: "校园 vlog 视角" },
      { kind: "product", label: "产品出现", dur: 18, text: "产品作为道具自然融入剧情", shot: "道具特写 + 情节" },
      { kind: "effect", label: "剧情高潮", dur: 18, text: "反转 + 同桌反应", shot: "面部特写 + 慢镜" },
      { kind: "cta", label: "CTA", dur: 5, text: "“下集预告 + 求关注”", shot: "字幕 + 关注按钮" },
    ],
    metrics: { uses_count: 18, ctr_pct: 5.4, diversity_pct: 82, completion_pct: 81, best_video: { script_id: "video-2334", plays: "2.4w", likes: "8k", gmv: "¥1,800" }, last_used_at: "2026-04-28T10:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["短剧", "校园", "剧情"], cover_color: PALETTE.teal, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2401", kind: "template", name: "人物反差 · 30s 种草", tier: "S",
    category: "美妆", hook_type: "反差", audience: ["女性 25-40"],
    platforms: ["douyin", "xhs"], duration_sec: 30, product_id: "p3",
    blocks: [
      { kind: "hook", label: "反差钩子", dur: 3, text: "“年龄/身份反差 · 引发好奇”", shot: "人物怼镜特写" },
      { kind: "scene", label: "人物展示", dur: 6, text: "场景化人物背景", shot: "场景介绍镜头" },
      { kind: "product", label: "产品引入", dur: 10, text: "产品作为关键道具", shot: "产品 30 帧静帧" },
      { kind: "effect", label: "效果对比", dur: 8, text: "使用前后对比", shot: "对比镜 + 字幕" },
      { kind: "cta", label: "CTA", dur: 3, text: "“链接 + 行动召唤”", shot: "CTA 字幕" },
    ],
    metrics: { uses_count: 184, ctr_pct: 8.4, diversity_pct: 62, completion_pct: 70, best_video: { script_id: "video-2398", plays: "482w", likes: "18w", gmv: "¥124,800" }, last_used_at: "2026-05-26T08:00:00Z" },
    source: { type: "system", ref_id: null, original_url: null, cloned_from: null, author: "系统内置" },
    tags: ["反差", "种草", "通用"], cover_color: PALETTE.rose, created_by: "system", workspace_id: "mcn-001",
  },
  {
    id: "asset-2398", kind: "my_script", name: "修车老李 · 颈椎按摩仪 · v1", tier: "B",
    category: "小家电", hook_type: "情感", audience: ["送礼场景"],
    platforms: ["douyin"], duration_sec: 38, product_id: "p4",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "蓝领老公给老婆买礼物，全村都馋哭了", shot: "修车铺远景" },
      { kind: "emotion", label: "情感铺垫", dur: 10, text: "工地下班顺手买", shot: "工地下班 vlog" },
      { kind: "product", label: "产品揭示", dur: 12, text: "产品特写", shot: "产品怼镜" },
      { kind: "effect", label: "使用", dur: 8, text: "老婆使用反应", shot: "反应镜" },
      { kind: "cta", label: "CTA", dur: 5, text: "“评论区扣 1”", shot: "CTA" },
    ],
    metrics: { uses_count: 12, ctr_pct: 4.6, diversity_pct: 42, completion_pct: 52, best_video: { script_id: "video-2398", plays: "6w", likes: "1.2k", gmv: "¥640" }, last_used_at: "2026-05-10T10:00:00Z" },
    source: { type: "user", ref_id: "u-bb", original_url: null, cloned_from: "asset-2604", author: "陈彬彬" },
    tags: ["情感", "蓝领"], cover_color: PALETTE.amber, created_by: "user-bb", workspace_id: "mcn-001",
  },
];

export function getScript(id?: string): ScriptAsset | undefined {
  if (!id) return undefined;
  return SCRIPT_ASSETS.find((s) => s.id === id);
}

// ── 视频资产（字段对齐 RenderOutput；product_id + script_id 互链） ──────────────
export const VIDEO_ASSETS: MaterialVideo[] = [
  {
    id: "video-2604-001", script_id: "asset-2604", product_id: "p4", kind: "baseline",
    name: "修车老李 · 基线版", status: "ready", duration_sec: 41, aspect_ratio: "9:16",
    variant_config: { character: "human-001", scene: "auto-shop", weather: "sunny", lighting: "natural", role_relation: "夫妻", voice: "voice-male-01" },
    metrics: { plays: "812w", likes: "32w", ctr_pct: 9.2, gmv: "¥184,200", completion_pct: 78, comments: 4820 },
    cover_color: PALETTE.amber, thumb_emoji: "🔧",
    created_at: "2026-05-26T14:36:00Z", generated_at: "2026-05-26T14:48:12Z", render_cost_sec: 134, model: "sora-zh-v3", parent_video_id: null,
  },
  {
    id: "video-2604-002", script_id: "asset-2604", product_id: "p4", kind: "variant",
    name: "父女视角 · 闺女偷拍 · v1", status: "ready", parent_video_id: "video-2604-001", duration_sec: 41, aspect_ratio: "9:16",
    variant_config: { character: "human-004", scene: "home-livingroom", weather: "sunny", lighting: "warm", role_relation: "父女", voice: "voice-fem-02" },
    metrics: { plays: "162w", likes: "8.4w", ctr_pct: 8.7, gmv: "¥98,400", completion_pct: 71, comments: 1240 },
    cover_color: PALETTE.rose, thumb_emoji: "👨‍👧",
    created_at: "2026-05-26T15:20:00Z", generated_at: "2026-05-26T15:32:48Z", render_cost_sec: 152, model: "sora-zh-v3",
  },
  {
    id: "video-2604-003", script_id: "asset-2604", product_id: "p4", kind: "variant",
    name: "雨夜 · 通勤场景", status: "ready", parent_video_id: "video-2604-001", duration_sec: 41, aspect_ratio: "9:16",
    variant_config: { character: "human-001", scene: "subway-station", weather: "rainy", lighting: "cool", role_relation: "夫妻", voice: "voice-male-01" },
    metrics: { plays: "48w", likes: "1.8w", ctr_pct: 6.4, gmv: "¥18,400", completion_pct: 64, comments: 380 },
    cover_color: PALETTE.violet, thumb_emoji: "🌧️",
    created_at: "2026-05-26T15:45:00Z", generated_at: "2026-05-26T15:58:30Z", render_cost_sec: 168, model: "sora-zh-v3",
  },
  {
    id: "video-2604-004", script_id: "asset-2604", product_id: "p4", kind: "variant",
    name: "中年同事场景", status: "rendering", parent_video_id: "video-2604-001", duration_sec: 41, aspect_ratio: "9:16",
    variant_config: { character: "human-002", scene: "office-meeting", weather: "sunny", lighting: "natural", role_relation: "同事", voice: "voice-male-02" },
    metrics: null, cover_color: PALETTE.violetDeep, thumb_emoji: "👔",
    created_at: "2026-05-26T10:14:00Z", generated_at: null, render_cost_sec: null, model: "sora-zh-v3",
    progress_pct: 64, eta_sec: 42, stage: "场景合成",
  },
  {
    id: "video-2585-001", script_id: "asset-2585", product_id: "p1", kind: "baseline",
    name: "微胖姐妹 · 试衣镜测试", status: "ready", duration_sec: 22, aspect_ratio: "9:16",
    variant_config: { character: "human-005", scene: "dressing-room", weather: "sunny", lighting: "soft", role_relation: "个人", voice: "voice-fem-01" },
    metrics: { plays: "14w", likes: "4.2w", ctr_pct: 7.8, gmv: "¥12,600", completion_pct: 64, comments: 480 },
    cover_color: PALETTE.violet, thumb_emoji: "👚",
    created_at: "2026-05-22T11:30:00Z", generated_at: "2026-05-22T11:42:00Z", render_cost_sec: 96, model: "sora-zh-v3", parent_video_id: null,
  },
  {
    id: "video-2598-001", script_id: "asset-2598", product_id: "p3", kind: "baseline",
    name: "母女反差 · 客厅化妆台", status: "ready", duration_sec: 28, aspect_ratio: "9:16",
    variant_config: { character: "human-006", scene: "home-dresser", weather: "sunny", lighting: "warm", role_relation: "母女", voice: "voice-fem-03" },
    metrics: { plays: "162w", likes: "6.4w", ctr_pct: 8.7, gmv: "¥98,400", completion_pct: 72, comments: 2410 },
    cover_color: PALETTE.rose, thumb_emoji: "💄",
    created_at: "2026-05-24T16:20:00Z", generated_at: "2026-05-24T16:33:00Z", render_cost_sec: 112, model: "sora-zh-v3", parent_video_id: null,
  },
];

// ── 爆款雷达 ─────────────────────────────────────────────────────────────────
export const VIRAL_HITS: ViralHit[] = [
  {
    id: "v1", platform: "douyin", plays: "4820000", likes: "180000", author: "@美妆小怪兽",
    title: "我妈用了这瓶精华，被亲戚以为是我姐", cat: "美妆", cat_color: PALETTE.rose, duration: 28, postedAt: "14h",
    hook: "我妈用了这瓶精华，被亲戚以为是我姐",
    structure: [
      { t: "0-3s", label: "冲突钩子", text: "镜头怼脸 · “你猜我妈多大?”", tag: "反差" },
      { t: "3-8s", label: "人物展示", text: "镜头切：母亲皮肤特写 · 字幕“52 岁”", tag: "人物" },
      { t: "8-18s", label: "产品引入", text: "从化妆台拿起精华瓶 · 镜头怼瓶身 30 帧", tag: "产品" },
      { t: "18-25s", label: "效果展示", text: "使用前后对比 · 三周时间轴", tag: "效果" },
      { t: "25-28s", label: "行动召唤", text: "“链接放购物车了” + 字幕飘屏", tag: "CTA" },
    ],
    tags: ["抗老", "精华", "亲情", "反差"], score: 92, risk: 0, reproduces: 184,
  },
  {
    id: "v2", platform: "xhs", plays: "1240000", likes: "88000", author: "@早餐打工人",
    title: "打工人 5min 早餐 | 不饿到 11 点的秘密", cat: "食品", cat_color: PALETTE.teal, duration: 32, postedAt: "2d",
    hook: "为什么我吃完早餐 11 点就饿？",
    structure: [
      { t: "0-3s", label: "问题钩子", text: "空桌特写 + “你是不是也这样?”", tag: "共鸣" },
      { t: "3-10s", label: "场景搭建", text: "厨房 vlog 视角 · 烧水 · 倒燕麦", tag: "场景" },
      { t: "10-22s", label: "产品融入", text: "产品袋特写 4 次 · 强调“低糖”标签", tag: "产品" },
      { t: "22-30s", label: "使用展示", text: "撕开倒入 · 加奶搅拌 · 第一口", tag: "使用" },
      { t: "30-32s", label: "CTA", text: "“评论区扣早 + 链接放小黄车”", tag: "CTA" },
    ],
    tags: ["早餐", "打工人", "低糖", "减脂"], score: 87, risk: 1, reproduces: 96,
  },
  {
    id: "v3", platform: "douyin", plays: "8120000", likes: "320000", author: "@老李修车",
    title: "修了 30 年车，第一次给老婆买这个", cat: "小家电", cat_color: PALETTE.amber, duration: 41, postedAt: "6h",
    hook: "修了 30 年车，第一次给老婆买这个",
    structure: [
      { t: "0-3s", label: "人物钩子", text: "油污大手特写 · “我老婆颈椎不好”", tag: "人物" },
      { t: "3-12s", label: "故事铺垫", text: "修车场景 · 收摊回家 · 老婆揉脖子", tag: "情感" },
      { t: "12-25s", label: "产品揭示", text: "从口袋拿出按摩仪 · 老婆惊讶反应", tag: "产品" },
      { t: "25-35s", label: "使用过程", text: "使用 + 老婆“舒服死了” + 笑场", tag: "效果" },
      { t: "35-41s", label: "CTA", text: "“老婆说有需要的姐妹评论区扣 1”", tag: "CTA" },
    ],
    tags: ["情感", "中老年", "颈椎", "送礼"], score: 95, risk: 0, reproduces: 312,
  },
  {
    id: "v4", platform: "douyin", plays: "2310000", likes: "94000", author: "@穿搭小欧",
    title: "160 微胖姐妹 这件打底救我一命", cat: "服饰", cat_color: PALETTE.violet, duration: 22, postedAt: "1d",
    hook: "160 微胖姐妹 这件打底救我一命",
    structure: [
      { t: "0-3s", label: "身材钩子", text: "镜头从下往上 · 字幕“160/68 kg”", tag: "身份" },
      { t: "3-8s", label: "痛点", text: "展示其他打底显胖 · 翻白眼", tag: "对比" },
      { t: "8-16s", label: "产品上身", text: "穿上德绒打底 · 转圈展示 · 弹幕“绝”", tag: "展示" },
      { t: "16-22s", label: "价格 + CTA", text: "“69 块钱姐妹冲” + 链接动画", tag: "CTA" },
    ],
    tags: ["微胖", "穿搭", "打底", "69 元"], score: 81, risk: 0, reproduces: 56,
  },
];

// 效果回流表格行
export const LOOP_ROWS = [
  { id: "asset-2604", title: "修车老李 · 颈椎按摩仪 · v2", plat: "douyin", plays: "812w", ctr: 9.2, gmv: "¥184,200", diff: 78, status: "爆款", toneVar: PALETTE.teal },
  { id: "asset-2598", title: "微胖姐妹打底 · v1", plat: "xhs", plays: "24w", ctr: 7.4, gmv: "¥21,400", diff: 65, status: "稳定", toneVar: PALETTE.violet },
  { id: "asset-2591", title: "低糖燕麦早餐 · 主播版", plat: "douyin", plays: "8.6w", ctr: 4.1, gmv: "¥6,800", diff: 42, status: "同质化", toneVar: PALETTE.amber },
  { id: "asset-2585", title: "玻尿酸精华 · 母亲反差", plat: "douyin", plays: "162w", ctr: 8.7, gmv: "¥98,400", diff: 81, status: "爆款", toneVar: PALETTE.teal },
  { id: "asset-2580", title: "冻干益生菌 · 妈妈群", plat: "wechat", plays: "5.2w", ctr: 3.2, gmv: "¥4,200", diff: 36, status: "同质化", toneVar: PALETTE.amber },
  { id: "asset-2576", title: "迷你筋膜枪 · 健身房", plat: "douyin", plays: "0.8w", ctr: 1.8, gmv: "¥420", diff: 22, status: "低质", toneVar: PALETTE.rose },
] as const;
