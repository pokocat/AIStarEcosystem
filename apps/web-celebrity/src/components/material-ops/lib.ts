// 素材运营纯函数 helper —— 变量抽取 / 变体抽样 / 变体计划 / 后台任务构造。
// 移植自原型 derive_variables.jsx + video_gen_modal.jsx，可平滑替换为 LLM endpoint。

import { PALETTE, VARIANT_AXES, VARIANT_AXIS_ORDER } from "@/constants/material-ops-ui";
import type {
  AsyncRenderTask,
  MaterialVideo,
  ScriptAsset,
  ScriptBlock,
  ScriptVariable,
  VariantConfig,
  VariantSample,
} from "./types";

const VAR_TONES = [PALETTE.rose, PALETTE.teal, PALETTE.amber, PALETTE.violet, PALETTE.violetDeep, PALETTE.peach];

/** 单条视频生成的积分单价（与混剪 mixcut.credit-per-variant 默认值对齐）。 */
export const CREDIT_PER_VIDEO = 30;

/** 估算一批视频生成消耗的积分。 */
export function estimateVideoCredits(count: number): number {
  return Math.max(0, count) * CREDIT_PER_VIDEO;
}

/** AI 从脚本里抽取可替换变量（mock：正则 + 类目启发式）。 */
export function extractVariablesFromScript(script: ScriptAsset): ScriptVariable[] {
  const out: ScriptVariable[] = [];
  const blocks = script.blocks ?? [];

  // 人物身份：修了 X 年 / 干了 X / 做了 X / 开了 X
  const personPhrases: { shot: number; phrase: string }[] = [];
  blocks.forEach((b, idx) => {
    const m = (b.text || "").match(/(修了\s?\d+\s?年[车工程])|(干了?\s?\d+\s?年[一-鿿]{0,2})|(做了\s?\d+\s?年[一-鿿]{0,2})|(开了\s?\d+\s?年[一-鿿]{0,2})/);
    if (m) personPhrases.push({ shot: idx, phrase: m[0] });
  });
  if (personPhrases.length > 0) {
    out.push({
      id: "person",
      name: "人物身份",
      toneVar: VAR_TONES[0],
      appearances: personPhrases,
      values: [personPhrases[0].phrase, "干了 20 年工地", "开了 15 年货车", "做了 30 年木工"],
      suggestions: ["开了 10 年滴滴", "当了 25 年护士", "送了 8 年外卖", "做了 30 年保洁"],
    });
  }

  // 亲属关系
  const relPhrases: { shot: number; phrase: string }[] = [];
  const relRegex = /(老婆|妈妈|老公|女儿|儿子|闺女|爸爸|老爸|父亲|母亲)/g;
  blocks.forEach((b, idx) => {
    let m: RegExpExecArray | null;
    relRegex.lastIndex = 0;
    while ((m = relRegex.exec(b.text || ""))) relPhrases.push({ shot: idx, phrase: m[0] });
  });
  if (relPhrases.length > 0) {
    const seen = relPhrases[0].phrase;
    out.push({
      id: "relation",
      name: "亲属关系",
      toneVar: VAR_TONES[1],
      appearances: relPhrases.slice(0, 4),
      values: [seen, ...(seen === "老婆" ? ["妈妈", "闺女"] : ["老婆", "闺女"])],
      suggestions: ["老爸", "丈母娘", "岳父", "婆婆", "姐妹"],
    });
  }

  // 场景
  let scenePhrase: { shot: number; phrase: string } | null = null;
  blocks.forEach((b, idx) => {
    const m = (b.text || "").match(/(修车铺|修车场|地铁|公园|厨房|工地|健身房|沙发|客厅|工棚|办公室)/);
    if (m && !scenePhrase) scenePhrase = { shot: idx, phrase: m[0] };
  });
  if (scenePhrase) {
    out.push({
      id: "scene",
      name: "场景",
      toneVar: VAR_TONES[2],
      appearances: [scenePhrase],
      values: [(scenePhrase as { phrase: string }).phrase, "小卖部门口", "夜市排档", "电梯口"],
      suggestions: ["公园长椅", "社区广场", "早餐店", "工地工棚", "小区门口"],
    });
  }

  // 反应台词
  const emoPhrases: { shot: number; phrase: string }[] = [];
  const emoRegex = /(舒服死了|破防了|笑场|愣住|惊讶|哭了|开心)/g;
  blocks.forEach((b, idx) => {
    let m: RegExpExecArray | null;
    emoRegex.lastIndex = 0;
    while ((m = emoRegex.exec(b.text || ""))) emoPhrases.push({ shot: idx, phrase: m[0] });
  });
  if (emoPhrases.length > 0) {
    out.push({
      id: "emotion",
      name: "反应台词",
      toneVar: VAR_TONES[3],
      appearances: emoPhrases.slice(0, 3),
      values: [emoPhrases[0].phrase, "舒服得直哼哼", "感动到说不出话", "笑出眼泪"],
      suggestions: ["激动得发抖", "吓得手机掉了", "惊讶到合不拢嘴", "感动得抱住"],
    });
  }

  // 常驻：商品出场方式
  out.push({
    id: "reveal",
    name: "商品出场",
    toneVar: VAR_TONES[4],
    appearances: [{ shot: 2, phrase: "从口袋拿出" }],
    values: ["从口袋拿出", "快递到家拆封", "从抽屉里掏出", "在化妆台上摆出来"],
    suggestions: ["偷偷塞到桌上", "当生日礼物送出", "从超市袋子里拿出", "邻居送过来"],
  });

  // 常驻：CTA 引导
  out.push({
    id: "cta",
    name: "CTA 引导",
    toneVar: VAR_TONES[5],
    appearances: [{ shot: 4, phrase: "评论区扣 1" }],
    values: ["评论区扣 1", "点击购物车", "直播间领券", "关注后私信"],
    suggestions: ["小黄车自取", "主页置顶", "私信暗号 88", "截图找小妹"],
  });

  return out;
}

/** 按变量交叉抽样 N 条变体；第 0 条永远是原稿。 */
export function sampleVariants(script: ScriptAsset, variables: ScriptVariable[], count: number): VariantSample[] {
  const samples: VariantSample[] = [];
  for (let i = 0; i < count; i++) {
    const subs: Record<string, string> = {};
    variables.forEach((v, vi) => {
      const idx = i === 0 ? 0 : (i + vi) % v.values.length;
      subs[v.id] = v.values[idx];
    });
    const labelParts = variables.filter((v) => subs[v.id] !== v.values[0]).map((v) => subs[v.id]);
    const _label = i === 0 ? "原始版" : labelParts.slice(0, 2).join(" · ") || `变体 ${i + 1}`;
    const blocks = (script.blocks ?? []).map((b) => {
      let text = b.text || "";
      const original = text;
      variables.forEach((v) => {
        const chosen = subs[v.id];
        const originalVal = v.values[0];
        if (chosen !== originalVal && originalVal) text = text.split(originalVal).join(chosen);
      });
      return { ...b, text, originalText: original } as ScriptBlock & { originalText: string };
    });
    samples.push({ idx: i, _label, subs, blocks });
  }
  return samples;
}

export function totalCombinations(variables: ScriptVariable[]): number {
  return variables.reduce((p, v) => p * Math.max(v.values.length, 1), 1);
}

/** 基线/轴变体的计划（baseline = 单条；variant = 按勾选轴交叉抽样命名）。 */
export function buildAxisPlans(
  isVariant: boolean,
  config: VariantConfig,
  variantAxes: string[],
  variantCount: number,
): (VariantConfig & { _name: string })[] {
  if (!isVariant) return [{ ...config, _name: "基线版" }];
  return Array.from({ length: variantCount }, (_, i) => {
    const next: VariantConfig = { ...config };
    const nameParts: string[] = [];
    variantAxes.forEach((axisId) => {
      const key = axisId as keyof VariantConfig;
      const axis = VARIANT_AXES[axisId as keyof typeof VARIANT_AXES];
      const candidates = axis.options.filter((o) => o.id !== config[key]);
      const picked = candidates[i % candidates.length] || axis.options[i % axis.options.length];
      next[key] = picked.id;
      nameParts.push(picked.label);
    });
    return { ...next, _name: nameParts.join(" · ") || `变体 ${i + 1}` };
  });
}

/** 把变量抽样转成命名计划（用变量替换 label）。 */
export function samplesToNames(samples: VariantSample[]): string[] {
  return samples.map((s) => s._label);
}

/** 生成完成时构造 MaterialVideo（弹窗内完成路径）。 */
export function buildVideoAsset(
  name: string,
  variantConfig: VariantConfig,
  idx: number,
  script: ScriptAsset,
  baseline: MaterialVideo | null,
  isVariant: boolean,
): MaterialVideo {
  const now = new Date().toISOString();
  const palette = [PALETTE.violet, PALETTE.rose, PALETTE.teal, PALETTE.amber, PALETTE.violetDeep, PALETTE.peach];
  return {
    id: `video-${script.id.replace("asset-", "")}-${String(Date.now()).slice(-4)}-${idx}`,
    script_id: script.id,
    product_id: script.product_id,
    kind: isVariant ? "variant" : "baseline",
    name: name || (isVariant ? `变体 ${idx + 1}` : "基线版"),
    status: "ready",
    parent_video_id: isVariant ? baseline?.id ?? null : null,
    duration_sec: (script.blocks ?? []).reduce((s, b) => s + (b.dur || 0), 0) || 30,
    aspect_ratio: "9:16",
    variant_config: variantConfig,
    metrics: null,
    cover_color: palette[idx % palette.length],
    thumb_emoji: VARIANT_AXES.character.options.find((o) => o.id === variantConfig.character)?.emoji || "🎬",
    created_at: now,
    generated_at: now,
    render_cost_sec: 90 + idx * 8,
    model: "sora-zh-v3",
  };
}

/** 构造后台异步渲染任务。 */
export function buildAsyncTasks(
  names: string[],
  configs: VariantConfig[],
  script: ScriptAsset,
  baseline: MaterialVideo | null,
  isVariant: boolean,
): AsyncRenderTask[] {
  const startedAt = Date.now();
  return names.map((name, i) => ({
    id: `task-${startedAt}-${i}`,
    script_id: script.id,
    product_id: script.product_id,
    parent_video_id: isVariant ? baseline?.id ?? null : null,
    kind: isVariant ? "variant" : "baseline",
    name,
    status: "pending",
    submitted_at: new Date(startedAt + i * 100).toISOString(),
    eta_sec: 90 + Math.floor(Math.random() * 60),
    progress_pct: 0,
    stage: "已入队",
    variant_config: configs[i] ?? configs[0],
  }));
}

export const VARIANT_AXIS_KEYS = VARIANT_AXIS_ORDER;
