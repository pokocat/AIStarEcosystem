// 素材运营纯函数 helper —— 变量抽取 / 变体抽样 / 变体计划 / 后台任务构造。
// 移植自原型 derive_variables.jsx + video_gen_modal.jsx，可平滑替换为 LLM endpoint。

import { PALETTE, VARIANT_AXES, VARIANT_AXIS_ORDER } from "@/constants/material-ops-ui";
import type {
  MaterialProduct,
  MaterialVideo,
  ScriptAsset,
  ScriptBlock,
  ScriptVariable,
  VariantConfig,
  VariantSample,
  VideoGenJobRequest,
  VideoModelOption,
} from "./types";

const VAR_TONES = [PALETTE.rose, PALETTE.teal, PALETTE.amber, PALETTE.violet, PALETTE.violetDeep, PALETTE.peach];

/**
 * 单条视频按所选模型的真实报价（billingUnit=per_second 按秒展开，与后端 hold 金额同源）。
 * model 为 null（模型列表未加载成功）或 durationSec<=0（时长未就绪，后端会 400）→ 返回 null，
 * 调用方必须禁用提交，**不回落写死单价、不虚构 1 秒报价**。
 */
export function creditsPerVideo(model: VideoModelOption | null, durationSec: number): number | null {
  if (!model || durationSec <= 0) return null;
  const rate = Math.max(0, model.creditCost);
  return model.billingUnit === "per_second" ? rate * durationSec : rate;
}

/**
 * 脚本分镜总时长（秒）= Σblocks.dur，生成链路的**唯一**时长真值：
 * 报价、时长闸、prompt 正文、提交载荷全部消费同一个值，禁止各处 `|| 30` 各回退各的。
 */
export function scriptTotalDur(script: ScriptAsset): number {
  return (script.blocks ?? []).reduce((s, b) => s + (b.dur || 0), 0);
}

/** 时长是否落在所选模型有效区间内；不合法时返回用户可执行的提示文案，合法返回 null。 */
export function durationGateMessage(model: VideoModelOption | null, durationSec: number): string | null {
  if (durationSec <= 0) return "脚本总时长为 0 秒，请先在编辑器里为分镜设置时长。";
  if (!model) return null;
  const min = model.effectiveMinDurationSec ?? null;
  const max = model.effectiveMaxDurationSec ?? null;
  if (min != null && durationSec < min) return `${model.name} 单条时长至少 ${min} 秒，当前脚本共 ${durationSec} 秒，请回编辑器增加口播与分镜时长。`;
  if (max != null && durationSec > max) return `${model.name} 单条时长最长 ${max} 秒，当前脚本共 ${durationSec} 秒，请回编辑器压缩口播与分镜时长，或换用其他模型。`;
  return null;
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

export const VARIANT_AXIS_KEYS = VARIANT_AXIS_ORDER;

// ─────────────────────────────────────────────────────────────────────────────
// 真实视频生成：把脚本 + 商品 + 6 轴画面维度拼成发给视频大模型的提示词，并构造提交载荷。
// ─────────────────────────────────────────────────────────────────────────────

/** 6 轴 config id → 人类可读 label（找不到回退 id 本身）。 */
function axisLabel(axisKey: keyof VariantConfig, optId: string): string {
  const axis = VARIANT_AXES[axisKey as keyof typeof VARIANT_AXES];
  const opt = axis?.options.find((o) => o.id === optId);
  return opt ? `${opt.label}${opt.sub ? `（${opt.sub}）` : ""}` : optId;
}

/** 商品是否为「未关联/占位」商品（免商品脚本 resolveProductForScript 会给中性占位）。 */
export function isPlaceholderProduct(product: MaterialProduct | null | undefined): boolean {
  return !product || product.id === "unknown" || product.name === "未关联商品" || product.name === "未找到商品";
}

/**
 * 把脚本 + 商品（或免商品脚本的主题简介）+ 画面维度拼成发给视频大模型的中文提示词。
 * blocks 传 sample.blocks（派生已替换变量）或 script.blocks（基线）。
 * 注意：正文时长与提交载荷的 duration_sec 必须同源（都 = Σblocks.dur），禁止两套真值。
 */
export function buildVideoPrompt(opts: {
  script: ScriptAsset;
  product: MaterialProduct | null;
  blocks: ScriptBlock[];
  config: VariantConfig;
}): string {
  const { script, product, blocks, config } = opts;
  const totalDur = blocks.reduce((s, b) => s + (b.dur || 0), 0);
  const hasProduct = !isPlaceholderProduct(product);
  const shotLines = blocks
    .map((b, i) => {
      const subtitle = b.genVoice === false ? "（本镜无口播/字幕，纯画面）" : `字幕/口播「${b.text || "—"}」`;
      return `  镜${i + 1} · ${b.label} · ${b.dur}s：${subtitle}${b.shot ? `｜画面：${b.shot}` : ""}`;
    })
    .join("\n");

  let subjectLines: string[];
  if (hasProduct && product) {
    const price = product.priceCents ? `¥${(product.priceCents / 100).toFixed(0)}` : "未知价格";
    const points = (product.sellingPointList?.length ? product.sellingPointList : (product.sellingPoints ?? "").split(/[/、,，]/))
      .map((s) => s.trim())
      .filter(Boolean);
    subjectLines = [
      `【商品】${product.name}（${product.category} · ${price}${product.commissionRate != null ? ` · 佣金 ${product.commissionRate}%` : ""}）`,
      points.length ? `【卖点】${points.join(" / ")}` : ``,
    ];
  } else {
    // 免商品脚本：用 creative_brief 充当主题段（无 brief 时只按分镜脚本生成）。
    subjectLines = [script.creative_brief?.trim() ? `【主题】${script.creative_brief.trim()}` : ``];
  }

  return [
    `请生成一条 ${totalDur}s、比例 9:16 的带货短视频，风格真实自然、电影感、商用级，画面清晰稳定、无水印。`,
    ``,
    ...subjectLines,
    ``,
    `【画面维度】人物：${axisLabel("character", config.character)}；场景：${axisLabel("scene", config.scene)}；天气：${axisLabel("weather", config.weather)}；光线：${axisLabel("lighting", config.lighting)}；角色关系：${config.role_relation}；配音：${axisLabel("voice", config.voice)}。`,
    ``,
    `【分镜脚本】（共 ${blocks.length} 镜 · ${totalDur}s）`,
    shotLines,
    ``,
    `要求：钩子前置 3 秒抓人；口播自然口语化；${hasProduct ? "产品出场真实可信；" : ""}结尾引导评论/下单。`,
  ]
    .filter((l) => l !== ``)
    .join("\n");
}

/**
 * 构造视频生成提交载荷。
 *   · baseline：samples 为空 → 1 条任务（script.blocks 原文）。
 *   · variant ：每个 sample 一条任务（sample.blocks 已替换变量），parent 指向 baseline。
 */
export function buildJobRequests(opts: {
  script: ScriptAsset;
  product: MaterialProduct | null;
  config: VariantConfig;
  samples?: VariantSample[];
  baseline?: MaterialVideo | null;
}): VideoGenJobRequest[] {
  const { script, product, config, samples, baseline } = opts;
  // 与报价/时长闸同源（scriptTotalDur）：不做 ||30 回退——0 秒脚本在弹窗层已被禁用提交，
  // 后端也会 400 VIDEO_DURATION_REQUIRED（防直调）。
  const totalDur = scriptTotalDur(script);
  const aspect = "9:16";
  const common = {
    script_id: script.id,
    product_id: script.product_id,
    variant_config: config,
    duration_sec: totalDur,
    aspect_ratio: aspect,
  };
  if (!samples || samples.length === 0) {
    return [
      {
        ...common,
        name: "基线视频",
        kind: "baseline",
        parent_video_id: null,
        prompt: buildVideoPrompt({ script, product, blocks: script.blocks, config }),
      },
    ];
  }
  return samples.map((s) => ({
    ...common,
    name: s._label,
    kind: "variant",
    parent_video_id: baseline?.id ?? null,
    prompt: buildVideoPrompt({ script, product, blocks: s.blocks, config }),
  }));
}
