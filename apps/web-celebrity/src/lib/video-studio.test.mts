// 「视频生成」纯逻辑的单测：报价（plan §3 二版：按模式 × 清晰度配、可以没定价）、参考素材编号、
// 提交前预检（含做同款的模板素材）、生成 / 智能优化的请求体、规格联动、存模板与做同款的辅助函数。
// 合同 fixture 照服务端 DTO 与 docs/video-studio-plan.md §2 手写，不照被测代码写（AGENTS.md §8.0.1 ⑦）。

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type {
  VideoStudioContract,
  VideoStudioMediaType,
  VideoStudioModel,
  VideoStudioPricing,
  VideoStudioTemplate,
  VideoStudioTemplateMaterial,
} from "@ai-star-eco/types/video-studio";
import {
  aspectForTier,
  buildJobRequest,
  buildOptimizationRequest,
  clampSeconds,
  countPromptChars,
  isMostlyEnglish,
  defaultSelection,
  formatFileSize,
  formatSizeLimit,
  isValidClientRequestId,
  limitHint,
  materialFacts,
  materialFromTemplate,
  materialFromUpload,
  mediaAccept,
  newClientRequestId,
  optimizationPrice,
  parseSeedInput,
  perSecondPrice,
  planTemplateApply,
  preflight,
  quote,
  reconcileSelection,
  referenceLabels,
  validateTemplateDraft,
  type VideoStudioMediaFacts,
  type VideoStudioPreflightInput,
} from "./video-studio.ts";
import {
  VIDEO_STUDIO_MODE_LABEL,
  VIDEO_STUDIO_STATUS_LABEL,
  VIDEO_STUDIO_TEMPLATE_SCOPE_LABEL,
  canvasLabel,
  jobCreditsText,
  jobSpecText,
  jobStatusText,
  templateDefaultTitle,
} from "../constants/video-studio-ui.ts";
import { MOCK_VIDEO_STUDIO_JOBS, MOCK_VIDEO_STUDIO_MODELS, MOCK_VIDEO_STUDIO_TEMPLATES } from "../mocks/video-studio.ts";

const MIB = 1024 * 1024;

// ── fixtures（按 plan §2 / §3 手写） ─────────────────────────────────────────

/** 四种模式同价 768p 40 / 544p 20，前 6 张参考图不加价、之后每张每秒 +10，智能优化不收费。 */
const RATE_40: VideoStudioPricing = {
  perSecond: {
    t2v: { "768p": 40, "544p": 20 },
    i2v: { "768p": 40, "544p": 20 },
    first_last_frame_video: { "768p": 40, "544p": 20 },
    universal_reference_video: { "768p": 40, "544p": 20 },
  },
  freeRefImages: 6,
  extraRefImagePerSecond: 10,
  promptOptimizationPerCall: 0,
};

function pricing(overrides: Partial<VideoStudioPricing> = {}): VideoStudioPricing {
  return { ...RATE_40, perSecond: { ...RATE_40.perSecond }, ...overrides };
}

const frameImage = {
  mediaType: "image" as const,
  maxCount: 1,
  maxBytes: 16 * MIB,
  formats: ["PNG", "JPEG", "WEBP"],
  minDurationSec: null,
  maxDurationSec: null,
};

function contract(overrides: Partial<VideoStudioContract> = {}): VideoStudioContract {
  return {
    modes: [
      { mode: "t2v", needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null },
      { mode: "i2v", needsFirstFrame: true, needsLastFrame: false, frameImage, references: null },
      { mode: "first_last_frame_video", needsFirstFrame: true, needsLastFrame: true, frameImage, references: null },
      {
        mode: "universal_reference_video",
        needsFirstFrame: false,
        needsLastFrame: false,
        frameImage: null,
        references: {
          image: { mediaType: "image", maxCount: 9, maxBytes: 30 * MIB, formats: ["PNG", "JPEG", "WEBP"], minDurationSec: null, maxDurationSec: null },
          video: { mediaType: "video", maxCount: 1, maxBytes: 50 * MIB, formats: ["MP4"], minDurationSec: null, maxDurationSec: null },
          audio: { mediaType: "audio", maxCount: 3, maxBytes: 15 * MIB, formats: ["WAV", "MP3"], minDurationSec: 2, maxDurationSec: 15 },
          maxImagesWithVideo: 8,
          maxTotal: 12,
          minVisual: 1,
          maxAudioTotalSec: 15,
        },
      },
    ],
    tiers: [
      {
        tier: "768p",
        canvases: [
          { aspectRatio: "16:9", width: 1344, height: 768 },
          { aspectRatio: "9:16", width: 768, height: 1344 },
        ],
      },
      {
        tier: "544p",
        canvases: [
          { aspectRatio: "16:9", width: 960, height: 544 },
          { aspectRatio: "9:16", width: 544, height: 960 },
          { aspectRatio: "1:1", width: 544, height: 544 },
        ],
      },
    ],
    minSeconds: 5,
    maxSeconds: 15,
    promptMaxChars: 7000,
    seedMax: 2147483647,
    ...overrides,
  };
}

let keySeq = 0;
function media(mediaType: VideoStudioMediaType, extra: Partial<VideoStudioMediaFacts> = {}): VideoStudioMediaFacts {
  keySeq += 1;
  return {
    mediaType,
    key: `video-studio-${mediaType}/u1/${keySeq}`,
    bytes: 1 * MIB,
    durationSec: mediaType === "image" ? null : 5,
    ...extra,
  };
}

function input(overrides: Partial<VideoStudioPreflightInput> = {}): VideoStudioPreflightInput {
  return {
    mode: "t2v",
    prompt: "海边日落",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    seconds: 5,
    seed: null,
    firstFrame: null,
    lastFrame: null,
    references: [],
    ...overrides,
  };
}

const messages = (c: VideoStudioContract, i: VideoStudioPreflightInput) => preflight(c, i).map((p) => p.message);

// ── 报价 ─────────────────────────────────────────────────────────────────────

describe("quote（plan §3：我们自己定、按模式 × 清晰度配）", () => {
  test("768p 40 积分/秒 × 5 秒 = 200；544p 20 × 5 = 100", () => {
    const q = quote(RATE_40, "768p", 5, "t2v", 0);
    assert.equal(q?.total, 200);
    assert.equal(q?.perSecond, 40);
    assert.equal(q?.seconds, 5);
    assert.equal(quote(RATE_40, "544p", 5, "i2v", 0)?.total, 100);
  });

  test("全能参考 8 张图、前 6 张不加价：(40 + 2 × 10) × 5 = 300", () => {
    const q = quote(RATE_40, "768p", 5, "universal_reference_video", 8);
    assert.equal(q?.total, 300);
    assert.equal(q?.extraImages, 2);
    assert.equal(q?.perSecond, 60);
    assert.equal(q?.basePerSecond, 40);
    assert.equal(q?.extraPerImagePerSecond, 10);
    assert.equal(q?.freeRefImages, 6);
  });

  test("免费张数以内不加价", () => {
    assert.equal(quote(RATE_40, "768p", 5, "universal_reference_video", 6)?.total, 200);
    assert.equal(quote(RATE_40, "768p", 5, "universal_reference_video", 0)?.total, 200);
  });

  test("一张都不免费时每张图都加价", () => {
    const p = pricing({ freeRefImages: 0 });
    assert.equal(quote(p, "768p", 5, "universal_reference_video", 3)?.total, (40 + 3 * 10) * 5);
  });

  test("加价只算全能参考：其他模式带着图片张数也不加", () => {
    assert.equal(quote(RATE_40, "768p", 5, "i2v", 9)?.total, 200);
    assert.equal(quote(RATE_40, "768p", 5, "first_last_frame_video", 9)?.extraImages, 0);
  });

  test("每个模式各有各的价", () => {
    const p = pricing();
    p.perSecond.first_last_frame_video = { "768p": 45, "544p": 25 };
    assert.equal(quote(p, "768p", 6, "first_last_frame_video", 0)?.total, 270);
    assert.equal(quote(p, "768p", 6, "i2v", 0)?.total, 240);
  });

  test("直接用下发的数，不在前端按厂商比例换算 544p", () => {
    const p = pricing();
    p.perSecond.t2v = { "768p": 45, "544p": 30 };
    assert.equal(quote(p, "544p", 7, "t2v", 0)?.total, 210);
  });

  test("15 秒上限", () => {
    assert.equal(quote(RATE_40, "768p", 15, "t2v", 0)?.total, 600);
  });

  test("没定价的格子（null / 缺这一格）→ null，不回落任何价", () => {
    const p = pricing();
    p.perSecond.universal_reference_video = { "768p": 50, "544p": null };
    assert.equal(quote(p, "544p", 5, "universal_reference_video", 0), null);
    assert.equal(quote(p, "768p", 5, "universal_reference_video", 0)?.total, 250);
    assert.equal(quote(p, "1080p", 5, "t2v", 0), null);
    assert.equal(quote(pricing({ perSecond: {} as VideoStudioPricing["perSecond"] }), "768p", 5, "t2v", 0), null);
  });

  test("秒数不是正整数 → null", () => {
    assert.equal(quote(RATE_40, "768p", 5.5, "t2v", 0), null);
    assert.equal(quote(RATE_40, "768p", 0, "t2v", 0), null);
  });

  test("perSecondPrice：按模式、清晰度取一格", () => {
    const p = pricing();
    p.perSecond.i2v = { "768p": 41, "544p": null };
    assert.equal(perSecondPrice(p, "i2v", "768p"), 41);
    assert.equal(perSecondPrice(p, "i2v", "544p"), null);
    assert.equal(perSecondPrice(p, "i2v", "1080p"), null);
  });

  test("智能优化单价：0 = 不收费；读不出来 → null（不许发起）", () => {
    assert.equal(optimizationPrice(pricing({ promptOptimizationPerCall: 0 })), 0);
    assert.equal(optimizationPrice(pricing({ promptOptimizationPerCall: 5 })), 5);
    assert.equal(optimizationPrice(pricing({ promptOptimizationPerCall: null as unknown as number })), null);
    assert.equal(optimizationPrice(pricing({ promptOptimizationPerCall: -1 })), null);
  });
});

// ── 编号 ─────────────────────────────────────────────────────────────────────

describe("referenceLabels", () => {
  test("同类按出现顺序编号", () => {
    const refs = (["image", "audio", "image", "video", "audio", "image"] as const).map((mediaType) => ({ mediaType }));
    assert.deepEqual(referenceLabels(refs), ["图1", "音频1", "图2", "视频1", "音频2", "图3"]);
  });

  test("空列表", () => {
    assert.deepEqual(referenceLabels([]), []);
  });
});

// ── 提示词字数 ───────────────────────────────────────────────────────────────

describe("countPromptChars", () => {
  test("去首尾空白，按码点数（emoji 算 1 个字）", () => {
    assert.equal(countPromptChars("  海边日落 \n"), 4);
    assert.equal(countPromptChars("🎬🎬"), 2);
    assert.equal(countPromptChars("   "), 0);
  });
});

describe("isMostlyEnglish（智能优化结果的语言）", () => {
  // 2026-10-03 线上真厂商（聚算 H3）对「清晨的海边…」的优化结果，截了开头
  const vendor =
    "integrated_multimodal_description: [Shot 1] The video opens in a cinematic live-action style with a landscape " +
    "composition, capturing a serene morning beach scene. A young woman, identified as (S1), is the central subject.\n\n" +
    "overall_soundscape: The soundscape features the gentle, rhythmic sound of ocean waves.\n\nnon_diegetic_music: N/A";

  test("厂商回的英文分镜描述算英文", () => {
    assert.equal(isMostlyEnglish(vendor), true);
  });

  test("英文描述里夹几句中文台词，仍算英文", () => {
    assert.equal(isMostlyEnglish(`${vendor}\n(S1) says: "早上好，今天的海真蓝"`), true);
  });

  test("结构字段是英文、正文是中文，不算（字段名不计数）", () => {
    const zhBody = "integrated_multimodal_description: [Shot 1] 猫在草地上奔跑\n\noverall_soundscape: 风声\n\nnon_diegetic_music: N/A";
    assert.equal(isMostlyEnglish(zhBody), false);
    assert.equal(isMostlyEnglish("integrated_multimodal_description: 猫奔跑\noverall_soundscape: 风声\nnon_diegetic_music: 无"), false);
  });

  test("中文为主、夹几个英文词，不算", () => {
    assert.equal(isMostlyEnglish("清晨的海边，镜头缓慢推近，4K 画质，cinematic lighting"), false);
    assert.equal(isMostlyEnglish("画面里白色的圆慢慢升起，像日出一样"), false);
  });

  test("空的、只有数字符号的，不算", () => {
    assert.equal(isMostlyEnglish(""), false);
    assert.equal(isMostlyEnglish("  \n "), false);
    assert.equal(isMostlyEnglish("16:9 · 5"), false);
  });
});

// ── 预检 ─────────────────────────────────────────────────────────────────────

describe("preflight：通用", () => {
  test("填全了没有问题", () => {
    assert.deepEqual(preflight(contract(), input()), []);
  });

  test("提示词为空是「未填」，点生成后才提示", () => {
    const p = preflight(contract(), input({ prompt: " \n " }));
    assert.equal(p.length, 1);
    assert.equal(p[0].kind, "missing");
    assert.equal(p[0].code, "VIDEO_STUDIO_PROMPT_REQUIRED");
    assert.equal(p[0].message, "请填写提示词");
  });

  test("提示词超长按码点算：7000 个 emoji 可以，7001 个不行", () => {
    assert.deepEqual(preflight(contract(), input({ prompt: "🎬".repeat(7000) })), []);
    const p = preflight(contract(), input({ prompt: "🎬".repeat(7001) }));
    assert.equal(p.length, 1);
    assert.equal(p[0].kind, "invalid");
    assert.equal(p[0].code, "VIDEO_STUDIO_PROMPT_TOO_LONG");
    assert.match(p[0].message, /7000/);
    assert.match(p[0].message, /7001/);
  });

  test("时长越界 / 不是整数", () => {
    for (const seconds of [4, 16, 5.5]) {
      const p = preflight(contract(), input({ seconds }));
      assert.equal(p.length, 1, String(seconds));
      assert.equal(p[0].code, "VIDEO_STUDIO_SPEC_INVALID");
      assert.equal(p[0].message, "时长要在 5 到 15 秒之间");
    }
    assert.deepEqual(preflight(contract(), input({ seconds: 15 })), []);
  });

  test("随机种子：留空随机；0 与上限可以；负数、超上限、非数字不行", () => {
    for (const seed of [null, 0, 2147483647]) assert.deepEqual(preflight(contract(), input({ seed })), [], String(seed));
    for (const seed of [-1, 2147483648, Number.NaN, 1.5]) {
      const p = preflight(contract(), input({ seed }));
      assert.equal(p.length, 1, String(seed));
      assert.equal(p[0].code, "VIDEO_STUDIO_SPEC_INVALID");
      assert.match(p[0].message, /随机种子/);
    }
  });

  test("清晰度 / 比例不在合同里", () => {
    assert.deepEqual(messages(contract(), input({ resolutionTier: "1080p" })), ["请选择清晰度"]);
    assert.deepEqual(messages(contract(), input({ aspectRatio: "1:1" })), ["请选择画面比例"]);
    assert.deepEqual(messages(contract(), input({ resolutionTier: "544p", aspectRatio: "1:1" })), []);
  });

  test("模型不支持的模式", () => {
    const c = contract({ modes: contract().modes.filter((m) => m.mode === "t2v") });
    const p = preflight(c, input({ mode: "i2v" }));
    assert.equal(p[0].code, "VIDEO_STUDIO_MODE_INVALID");
  });
});

describe("preflight：首帧 / 尾帧", () => {
  test("首帧生视频缺首帧", () => {
    const p = preflight(contract(), input({ mode: "i2v" }));
    assert.equal(p.length, 1);
    assert.equal(p[0].kind, "missing");
    assert.equal(p[0].message, "请上传首帧图");
  });

  test("首尾帧只传了首帧", () => {
    assert.deepEqual(messages(contract(), input({ mode: "first_last_frame_video", firstFrame: media("image") })), [
      "请上传尾帧图",
    ]);
  });

  test("帧图超过 16 MB（上传接口虽然放行到 30 MB）", () => {
    const p = preflight(contract(), input({ mode: "i2v", firstFrame: media("image", { bytes: 20 * MIB }) }));
    assert.equal(p.length, 1);
    assert.equal(p[0].kind, "invalid");
    assert.equal(p[0].message, "首帧图不能超过 16 MB（这张 20 MB）");
    // 只超一点点也要说清楚「超了」，不能显示成「16 MB」
    const edge = preflight(contract(), input({ mode: "i2v", firstFrame: media("image", { bytes: 16 * MIB + 1 }) }));
    assert.match(edge[0].message, /这张 16\.1 MB/);
  });

  test("文生视频不看帧图和参考素材（切模式时它们留在页面上但不提交）", () => {
    const refs = Array.from({ length: 12 }, () => media("image"));
    assert.deepEqual(
      preflight(contract(), input({ firstFrame: media("image", { bytes: 99 * MIB }), references: refs })),
      [],
    );
  });
});

describe("preflight：全能参考", () => {
  const ref = (references: VideoStudioMediaFacts[]) => input({ mode: "universal_reference_video", references });

  test("一个素材都没有 / 只有音频：至少要 1 个视觉素材（未填类）", () => {
    for (const refs of [[], [media("audio")]]) {
      const p = preflight(contract(), ref(refs));
      assert.equal(p.length, 1);
      assert.equal(p[0].kind, "missing");
      assert.equal(p[0].message, "至少放 1 张图片或 1 个视频");
    }
  });

  test("图片超过 9 张", () => {
    const refs = Array.from({ length: 10 }, () => media("image"));
    assert.deepEqual(messages(contract(), ref(refs)), ["图片最多 9 张（现在 10 张）"]);
  });

  test("带视频时图片最多 8 张", () => {
    const refs = [...Array.from({ length: 9 }, () => media("image")), media("video")];
    assert.deepEqual(messages(contract(), ref(refs)), ["带视频时图片最多 8 张（现在 9 张）"]);
    const ok = [...Array.from({ length: 8 }, () => media("image")), media("video"), media("audio"), media("audio")];
    assert.deepEqual(preflight(contract(), ref(ok)), []);
  });

  test("视频最多 1 个、音频最多 3 段", () => {
    assert.deepEqual(messages(contract(), ref([media("image"), media("video"), media("video")])), [
      "视频最多 1 个（现在 2 个）",
    ]);
    const audios = Array.from({ length: 4 }, () => media("audio", { durationSec: 2 }));
    assert.deepEqual(messages(contract(), ref([media("image"), ...audios])), ["音频最多 3 段（现在 4 段）"]);
  });

  test("总数上限", () => {
    const c = contract();
    const rules = c.modes[3].references!;
    const small = contract({ modes: [{ ...c.modes[3], references: { ...rules, maxTotal: 3 } }] });
    assert.deepEqual(messages(small, ref([media("image"), media("image"), media("image"), media("audio")])), [
      "参考素材最多 3 个（现在 4 个）",
    ]);
  });

  test("单个文件超过该类上限，报的是编号", () => {
    const refs = [media("image"), media("image", { bytes: 31 * MIB }), media("video", { bytes: 51 * MIB })];
    assert.deepEqual(messages(contract(), ref(refs)), [
      "图2 不能超过 30 MB（这个 31 MB）",
      "视频1 不能超过 50 MB（这个 51 MB）",
    ]);
  });

  test("单段音频 2–15 秒", () => {
    assert.deepEqual(messages(contract(), ref([media("image"), media("audio", { durationSec: 1.996 })])), [
      "音频1 要在 2 到 15 秒之间（现在 1.99 秒）",
    ]);
    assert.deepEqual(messages(contract(), ref([media("image"), media("audio", { durationSec: 15.2 })])), [
      "音频1 要在 2 到 15 秒之间（现在 15.2 秒）",
      "音频加起来最长 15 秒（现在 15.2 秒）",
    ]);
    // 读不到时长的不判（服务端上传时已经用 ffprobe 判过）
    assert.deepEqual(preflight(contract(), ref([media("image"), media("audio", { durationSec: null })])), []);
  });

  test("音频合计不超过 15 秒，浮点误差不误报", () => {
    const exact = [media("audio", { durationSec: 5.1 }), media("audio", { durationSec: 4.9 }), media("audio", { durationSec: 5 })];
    assert.deepEqual(preflight(contract(), ref([media("image"), ...exact])), []);
    const over = [media("audio", { durationSec: 6 }), media("audio", { durationSec: 6 }), media("audio", { durationSec: 6 })];
    assert.deepEqual(messages(contract(), ref([media("image"), ...over])), ["音频加起来最长 15 秒（现在 18 秒）"]);
  });

  test("同一个素材放了两次", () => {
    const a = media("image");
    assert.deepEqual(messages(contract(), ref([a, media("image"), { ...a }])), ["图3 和 图1 是同一个素材，删掉一个"]);
  });
});

// ── 组请求体 ─────────────────────────────────────────────────────────────────

describe("buildJobRequest", () => {
  const model = (selectableById: boolean): VideoStudioModel => ({
    endpointId: "ep-1",
    name: "MiniMax H3",
    isDefault: true,
    selectableById,
    contract: contract(),
    pricing: RATE_40,
  });
  const draft = {
    mode: "t2v" as const,
    prompt: "  海边日落 \n",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    seconds: 5,
    seed: null,
    firstFrameKey: "video-studio-image/u1/first",
    lastFrameKey: "video-studio-image/u1/last",
    references: [
      { mediaType: "image" as const, key: "video-studio-image/u1/r1" },
      { mediaType: "audio" as const, key: "video-studio-audio/u1/a1" },
    ],
  };

  test("只有 selectableById 的模型才带 endpointId", () => {
    assert.equal(buildJobRequest(model(true), draft).endpointId, "ep-1");
    assert.equal("endpointId" in buildJobRequest(model(false), draft), false);
  });

  test("文生视频不带任何素材，提示词去首尾空白", () => {
    assert.deepEqual(buildJobRequest(model(true), draft), {
      endpointId: "ep-1",
      mode: "t2v",
      prompt: "海边日落",
      resolutionTier: "768p",
      aspectRatio: "9:16",
      seconds: 5,
    });
  });

  test("首帧生视频只带首帧；首尾帧带两张；全能参考只带参考素材（按顺序）", () => {
    const i2v = buildJobRequest(model(true), { ...draft, mode: "i2v" });
    assert.equal(i2v.firstFrameKey, "video-studio-image/u1/first");
    assert.equal("lastFrameKey" in i2v, false);
    assert.equal("references" in i2v, false);

    const flf = buildJobRequest(model(true), { ...draft, mode: "first_last_frame_video" });
    assert.equal(flf.firstFrameKey, "video-studio-image/u1/first");
    assert.equal(flf.lastFrameKey, "video-studio-image/u1/last");
    assert.equal("references" in flf, false);

    const ref = buildJobRequest(model(true), { ...draft, mode: "universal_reference_video" });
    assert.equal("firstFrameKey" in ref, false);
    assert.equal("lastFrameKey" in ref, false);
    assert.deepEqual(ref.references, draft.references);
  });

  test("种子：留空不传，填了原样传", () => {
    assert.equal("seed" in buildJobRequest(model(true), draft), false);
    assert.equal(buildJobRequest(model(true), { ...draft, seed: 42 }).seed, 42);
    assert.equal(buildJobRequest(model(true), { ...draft, seed: 0 }).seed, 0);
  });

  test("做同款带 templateId、用了优化那一版带 optimizationId；为空就不带这个字段", () => {
    const withBoth = buildJobRequest(model(true), { ...draft, templateId: "tpl-1", optimizationId: "opt-1" });
    assert.equal(withBoth.templateId, "tpl-1");
    assert.equal(withBoth.optimizationId, "opt-1");
    const without = buildJobRequest(model(true), { ...draft, templateId: null, optimizationId: "" });
    assert.equal("templateId" in without, false);
    assert.equal("optimizationId" in without, false);
  });

  test("做同款切到别的模式：模板素材同样只带当前模式要的", () => {
    const req = buildJobRequest(model(true), { ...draft, mode: "i2v", templateId: "tpl-1" });
    assert.deepEqual(
      { firstFrameKey: req.firstFrameKey, lastFrameKey: req.lastFrameKey, references: req.references, templateId: req.templateId },
      { firstFrameKey: "video-studio-image/u1/first", lastFrameKey: undefined, references: undefined, templateId: "tpl-1" },
    );
  });

  describe("buildOptimizationRequest", () => {
    test("与生成同一套字段、同一套素材挑法；不带种子和 optimizationId，带 clientRequestId 与 templateId", () => {
      const req = buildOptimizationRequest(
        model(true),
        { ...draft, mode: "i2v", seed: 42, templateId: "tpl-1", optimizationId: "opt-x" },
        "req-12345678",
      );
      assert.deepEqual(req, {
        clientRequestId: "req-12345678",
        endpointId: "ep-1",
        mode: "i2v",
        prompt: "海边日落",
        resolutionTier: "768p",
        aspectRatio: "9:16",
        seconds: 5,
        firstFrameKey: "video-studio-image/u1/first",
        templateId: "tpl-1",
      });
    });

    test("全能参考只带参考素材（按顺序）；合成的默认模型不带 endpointId", () => {
      const req = buildOptimizationRequest(model(false), { ...draft, mode: "universal_reference_video" }, "req-12345678");
      assert.equal("endpointId" in req, false);
      assert.equal("firstFrameKey" in req, false);
      assert.deepEqual(req.references, draft.references);
    });

    test("文生视频什么素材都不带", () => {
      const req = buildOptimizationRequest(model(true), draft, "req-12345678");
      assert.equal("firstFrameKey" in req, false);
      assert.equal("lastFrameKey" in req, false);
      assert.equal("references" in req, false);
    });
  });

  test("clientRequestId：每次新生成的都不一样，且是 8–128 个可见 ASCII", () => {
    const a = newClientRequestId();
    const b = newClientRequestId();
    assert.notEqual(a, b);
    assert.ok(isValidClientRequestId(a), a);
    assert.ok(isValidClientRequestId("9b2f1c3e-0000-4000-8000-000000000000"));
    for (const bad of ["short", "x".repeat(129), "has space 123", "中文中文中文中文", ""]) {
      assert.equal(isValidClientRequestId(bad), false, bad);
    }
  });
});

// ── 做同款的模板素材 ─────────────────────────────────────────────────────────

let tplSeq = 0;
function tplMaterial(
  mediaType: VideoStudioMediaType,
  extra: Partial<VideoStudioTemplateMaterial> = {},
): VideoStudioTemplateMaterial {
  tplSeq += 1;
  return {
    role: "reference",
    mediaType,
    key: `video-studio-${mediaType}/ops/${tplSeq}`,
    label: "图1",
    url: `https://cdn.example.com/tpl/${tplSeq}`,
    ...extra,
  };
}

describe("preflight：做同款的模板素材", () => {
  const ref = (references: VideoStudioMediaFacts[]) => input({ mode: "universal_reference_video", references });

  test("不知道大小和时长：大小、时长不判，数量规则照判", () => {
    const facts = [tplMaterial("image"), tplMaterial("audio")].map((m) => materialFacts(materialFromTemplate(m)));
    assert.deepEqual(preflight(contract(), ref(facts)), []);
    const tooMany = Array.from({ length: 10 }, () => materialFacts(materialFromTemplate(tplMaterial("image"))));
    assert.deepEqual(messages(contract(), ref(tooMany)), ["图片最多 9 张（现在 10 张）"]);
  });

  test("首帧是模板素材也一样：不判大小", () => {
    const first = materialFacts(materialFromTemplate(tplMaterial("image", { role: "first_frame", label: "首帧" })));
    assert.equal(first.bytes, null);
    assert.deepEqual(preflight(contract(), input({ mode: "i2v", firstFrame: first })), []);
  });

  test("模板里已经删掉的素材（预览地址为 null）不能用", () => {
    const gone = materialFacts(materialFromTemplate(tplMaterial("image", { role: "first_frame", url: null })));
    assert.equal(gone.unavailable, true);
    assert.deepEqual(messages(contract(), input({ mode: "i2v", firstFrame: gone })), ["模板里的首帧图已经删掉了，请换一张"]);
    const goneRef = materialFacts(materialFromTemplate(tplMaterial("image", { url: null })));
    assert.deepEqual(messages(contract(), ref([goneRef])), ["图1 是模板里的素材，已经删掉了，换一个或者删掉它"]);
  });

  test("混着用：模板素材不判大小，自己上传的照常判", () => {
    const mixed = [materialFacts(materialFromTemplate(tplMaterial("image"))), media("image", { bytes: 31 * MIB })];
    assert.deepEqual(messages(contract(), ref(mixed)), ["图2 不能超过 30 MB（这个 31 MB）"]);
  });

  test("materialFromUpload / materialFromTemplate / materialFacts", () => {
    const up = materialFromUpload({
      key: "video-studio-audio/u1/a.mp3",
      url: "blob:x",
      mediaType: "audio",
      bytes: 2 * MIB,
      name: "节奏.mp3",
      durationSec: 6.5,
      width: null,
      height: null,
    });
    assert.equal(up.fromTemplate, false);
    assert.deepEqual(materialFacts(up), {
      mediaType: "audio",
      key: "video-studio-audio/u1/a.mp3",
      bytes: 2 * MIB,
      durationSec: 6.5,
      unavailable: false,
    });
    const tpl = materialFromTemplate(tplMaterial("video", { label: "视频1" }));
    assert.equal(tpl.fromTemplate, true);
    assert.equal(tpl.name, "视频1");
    assert.equal(tpl.bytes, null);
  });
});

// ── 存模板 / 做同款 ──────────────────────────────────────────────────────────

describe("存模板与做同款", () => {
  test("validateTemplateDraft：标题去空白后 1–40 字、说明 ≤ 200 字（按字数，不按字节）", () => {
    assert.deepEqual(validateTemplateDraft("香水试用", ""), []);
    assert.deepEqual(validateTemplateDraft("   ", ""), ["请填写标题"]);
    assert.deepEqual(validateTemplateDraft("字".repeat(41), ""), ["标题最多 40 个字，现在 41 个"]);
    assert.deepEqual(validateTemplateDraft("🎬".repeat(40), "说".repeat(200)), []);
    assert.deepEqual(validateTemplateDraft("好", "说".repeat(201)), ["说明最多 200 个字，现在 201 个"]);
  });

  test("预填标题：模式名 · 提示词前 12 个字（空白折成一个空格），本身一定合法", () => {
    assert.equal(
      templateDefaultTitle("i2v", "  模特拿起香水瓶轻轻喷一下，转头看向镜头微笑 "),
      "首帧生视频 · 模特拿起香水瓶轻轻喷一下",
    );
    assert.equal(templateDefaultTitle("t2v", "海边\n\n日落"), "文生视频 · 海边 日落");
    assert.equal(templateDefaultTitle("t2v", "   "), "文生视频");
    const longest = templateDefaultTitle("first_last_frame_video", "长".repeat(500));
    assert.deepEqual(validateTemplateDraft(longest, ""), []);
  });

  const model = (endpointId: string, isDefault = false): VideoStudioModel => ({
    endpointId,
    name: endpointId,
    isDefault,
    selectableById: true,
    contract: contract(),
    pricing: RATE_40,
  });
  const template = (overrides: Partial<VideoStudioTemplate> = {}): VideoStudioTemplate => ({
    id: "tpl-1",
    scope: "official",
    title: "街拍穿搭",
    description: null,
    mode: "universal_reference_video",
    prompt: "图1 的模特穿着图2 的风衣",
    resolutionTier: "544p",
    aspectRatio: "1:1",
    seconds: 8,
    seed: 20260927,
    endpointId: "ep-b",
    modelName: "模型 B",
    materials: [
      tplMaterial("image", { label: "图1" }),
      tplMaterial("audio", { label: "音频1" }),
      tplMaterial("image", { label: "图2" }),
    ],
    previewVideoUrl: null,
    previewThumbnailUrl: null,
    useCount: 0,
    mine: false,
    createdAt: "2026-09-27T12:30:00Z",
    ...overrides,
  });

  test("planTemplateApply：原作的模型还在就用它", () => {
    const plan = planTemplateApply(template(), [model("ep-a", true), model("ep-b")]);
    assert.equal(plan.endpointId, "ep-b");
    assert.equal(plan.modelUnavailable, false);
    assert.deepEqual(plan.selection, {
      mode: "universal_reference_video",
      resolutionTier: "544p",
      aspectRatio: "1:1",
      seconds: 8,
    });
    assert.equal(plan.prompt, "图1 的模特穿着图2 的风衣");
    assert.equal(plan.seedText, "20260927");
  });

  test("planTemplateApply：原作的模型不在了就退默认并标出来；模板没记模型也退默认但不算「不在了」", () => {
    const gone = planTemplateApply(template(), [model("ep-a", true)]);
    assert.equal(gone.endpointId, null);
    assert.equal(gone.modelUnavailable, true);
    const none = planTemplateApply(template({ endpointId: null }), [model("ep-a", true)]);
    assert.equal(none.modelUnavailable, false);
  });

  test("planTemplateApply：素材按角色分好，参考素材顺序不变；没有种子是空串", () => {
    const t = template({
      mode: "first_last_frame_video",
      seed: null,
      materials: [
        tplMaterial("image", { role: "last_frame", label: "尾帧" }),
        tplMaterial("image", { role: "first_frame", label: "首帧" }),
      ],
    });
    const plan = planTemplateApply(t, [model("ep-b")]);
    assert.equal(plan.firstFrame?.label, "首帧");
    assert.equal(plan.lastFrame?.label, "尾帧");
    assert.deepEqual(plan.references, []);
    assert.equal(plan.seedText, "");

    const refs = planTemplateApply(template(), [model("ep-b")]).references.map((m) => m.label);
    assert.deepEqual(refs, ["图1", "音频1", "图2"]);
  });
});

// ── 规格默认值与联动 ─────────────────────────────────────────────────────────

describe("规格默认值与联动", () => {
  test("默认：文生视频 · 768p · 9:16 · 5 秒", () => {
    assert.deepEqual(defaultSelection(contract()), { mode: "t2v", resolutionTier: "768p", aspectRatio: "9:16", seconds: 5 });
  });

  test("默认时长 = max(最短时长, 5)，并收进区间", () => {
    assert.equal(defaultSelection(contract({ minSeconds: 6 })).seconds, 6);
    assert.equal(defaultSelection(contract({ minSeconds: 2 })).seconds, 5);
    assert.equal(defaultSelection(contract({ minSeconds: 2, maxSeconds: 4 })).seconds, 4);
  });

  test("合同里没有偏好项就取第一个", () => {
    const c = contract({
      modes: contract().modes.filter((m) => m.mode !== "t2v"),
      tiers: [{ tier: "544p", canvases: [{ aspectRatio: "16:9", width: 960, height: 544 }] }],
    });
    assert.deepEqual(defaultSelection(c), { mode: "i2v", resolutionTier: "544p", aspectRatio: "16:9", seconds: 5 });
  });

  test("换清晰度：新档位有这个比例就保留，没有就取第一个", () => {
    assert.equal(aspectForTier(contract(), "544p", "9:16"), "9:16");
    assert.equal(aspectForTier(contract(), "768p", "1:1"), "16:9");
  });

  test("换模型：合法的保留，不合法的回到默认，秒数收进区间", () => {
    const c = contract({ minSeconds: 5, maxSeconds: 10 });
    assert.deepEqual(
      reconcileSelection(c, { mode: "universal_reference_video", resolutionTier: "544p", aspectRatio: "1:1", seconds: 15 }),
      { mode: "universal_reference_video", resolutionTier: "544p", aspectRatio: "1:1", seconds: 10 },
    );
    assert.deepEqual(
      reconcileSelection(c, { mode: "t2v", resolutionTier: "1080p", aspectRatio: "1:1", seconds: 7 }),
      { mode: "t2v", resolutionTier: "768p", aspectRatio: "9:16", seconds: 7 },
    );
    assert.deepEqual(reconcileSelection(c, null), defaultSelection(c));
  });

  test("clampSeconds", () => {
    assert.equal(clampSeconds(contract(), 3), 5);
    assert.equal(clampSeconds(contract(), 99), 15);
    assert.equal(clampSeconds(contract(), 7.4), 7);
    assert.equal(clampSeconds(contract(), Number.NaN), 5);
  });
});

// ── 小工具 ───────────────────────────────────────────────────────────────────

describe("小工具", () => {
  test("parseSeedInput", () => {
    assert.equal(parseSeedInput(""), null);
    assert.equal(parseSeedInput("  "), null);
    assert.equal(parseSeedInput(" 42 "), 42);
    assert.ok(Number.isNaN(parseSeedInput("abc") as number));
    assert.ok(Number.isNaN(parseSeedInput("-1") as number));
    assert.ok(Number.isNaN(parseSeedInput("1.5") as number));
  });

  test("大小与限制文案", () => {
    assert.equal(formatSizeLimit(16 * MIB), "16 MB");
    assert.equal(formatSizeLimit(30 * MIB), "30 MB");
    assert.equal(formatFileSize(356 * 1024), "356 KB");
    assert.equal(formatFileSize(2.44 * MIB), "2.4 MB");
    assert.equal(limitHint(frameImage), "PNG / JPEG / WEBP，不超过 16 MB");
    assert.equal(
      limitHint({ mediaType: "audio", maxCount: 3, maxBytes: 15 * MIB, formats: ["WAV", "MP3"], minDurationSec: 2, maxDurationSec: 15 }),
      "WAV / MP3，不超过 15 MB，每段 2 到 15 秒",
    );
  });

  test("文件选择框的 accept：认识的格式拼 MIME + 后缀，不认识的放宽", () => {
    assert.equal(mediaAccept(frameImage), "image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp");
    assert.equal(
      mediaAccept({ ...frameImage, mediaType: "video", formats: ["MP4", "新格式"] }),
      "video/mp4,.mp4,video/*",
    );
  });
});

// ── 界面文案 ─────────────────────────────────────────────────────────────────

describe("界面文案", () => {
  test("模式名照抄厂商", () => {
    assert.deepEqual(VIDEO_STUDIO_MODE_LABEL, {
      t2v: "文生视频",
      i2v: "首帧生视频",
      first_last_frame_video: "首尾帧生视频",
      universal_reference_video: "全能参考",
    });
  });

  test("状态与积分文案", () => {
    assert.deepEqual(VIDEO_STUDIO_STATUS_LABEL, { queued: "排队中", running: "生成中", succeeded: "已完成", failed: "失败" });
    assert.equal(jobStatusText({ status: "running", progressPct: 42 }), "生成中 42%");
    assert.equal(jobStatusText({ status: "queued", progressPct: 0 }), "排队中");
    assert.equal(jobCreditsText("running", "200"), "冻结 200 积分");
    assert.equal(jobCreditsText("queued", "200"), "冻结 200 积分");
    assert.equal(jobCreditsText("succeeded", "200"), "消耗 200 积分");
    assert.equal(jobCreditsText("failed", "200"), "已退回 200 积分");
  });

  test("规格文案", () => {
    assert.equal(canvasLabel({ aspectRatio: "9:16", width: 768, height: 1344 }), "9:16 · 768×1344");
    assert.equal(jobSpecText({ resolutionTier: "768p", aspectRatio: "9:16", seconds: 5 }), "768p · 9:16 · 5 秒");
  });
});

// ── 演示数据与服务端同形 ─────────────────────────────────────────────────────

describe("演示数据（mocks/video-studio.ts）照 plan §2 / §3 / §10", () => {
  const [h3] = MOCK_VIDEO_STUDIO_MODELS;

  test("一个默认的 MiniMax H3，四种模式", () => {
    assert.equal(MOCK_VIDEO_STUDIO_MODELS.length, 1);
    assert.equal(h3.name, "MiniMax H3");
    assert.equal(h3.isDefault, true);
    assert.deepEqual(
      h3.contract.modes.map((m) => m.mode),
      ["t2v", "i2v", "first_last_frame_video", "universal_reference_video"],
    );
  });

  test("两档清晰度共 12 种画布，像素照厂商表", () => {
    const all = h3.contract.tiers.flatMap((t) => t.canvases.map((c) => `${t.tier} ${canvasLabel(c)}`));
    assert.equal(all.length, 12);
    for (const expected of [
      "768p 21:9 · 1536×672",
      "768p 9:16 · 768×1344",
      "768p 1:1 · 768×768",
      "544p 4:3 · 736×544",
      "544p 3:4 · 544×736",
      "544p 9:16 · 544×960",
    ]) {
      assert.ok(all.includes(expected), expected);
    }
  });

  test("价格是新形状：四种模式 × 两档都有一格，留一格没定价用来看「还没定价」", () => {
    for (const m of h3.contract.modes) {
      for (const t of h3.contract.tiers) {
        assert.ok(t.tier in h3.pricing.perSecond[m.mode], `${m.mode} ${t.tier}`);
      }
    }
    assert.equal(perSecondPrice(h3.pricing, "universal_reference_video", "544p"), null);
    assert.equal(quote(h3.pricing, "544p", 5, "universal_reference_video", 1), null);
    assert.equal(optimizationPrice(h3.pricing), h3.pricing.promptOptimizationPerCall);
    const d = defaultSelection(h3.contract);
    assert.deepEqual(d, { mode: "t2v", resolutionTier: "768p", aspectRatio: "9:16", seconds: 5 });
    assert.equal(quote(h3.pricing, d.resolutionTier, d.seconds, d.mode, 0)?.total, 200);
  });

  test("各模式的素材限制", () => {
    const byMode = Object.fromEntries(h3.contract.modes.map((m) => [m.mode, m]));
    assert.equal(byMode.i2v.frameImage?.maxBytes, 16 * MIB);
    assert.equal(byMode.first_last_frame_video.needsLastFrame, true);
    const refs = byMode.universal_reference_video.references!;
    assert.deepEqual(
      [refs.image.maxCount, refs.video.maxCount, refs.audio.maxCount, refs.maxImagesWithVideo, refs.maxTotal, refs.minVisual, refs.maxAudioTotalSec],
      [9, 1, 3, 8, 12, 1, 15],
    );
    assert.deepEqual([refs.image.maxBytes, refs.video.maxBytes, refs.audio.maxBytes], [30 * MIB, 50 * MIB, 15 * MIB]);
    assert.deepEqual([refs.audio.minDurationSec, refs.audio.maxDurationSec], [2, 15]);
  });

  test("演示任务：每种状态都有、时间是 ISO、新的在前、积分与报价一致", () => {
    const statuses = new Set(MOCK_VIDEO_STUDIO_JOBS.map((j) => j.status));
    assert.deepEqual([...statuses].sort(), ["failed", "queued", "running", "succeeded"]);
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    for (const j of MOCK_VIDEO_STUDIO_JOBS) {
      assert.match(j.createdAt, iso, j.id);
      if (j.completedAt) assert.match(j.completedAt, iso, j.id);
      assert.equal(j.completedAt === null, j.status === "queued" || j.status === "running", j.id);
      const images = j.inputs.filter((i) => i.mediaType === "image" && /^图\d+$/.test(i.label)).length;
      assert.equal(j.credits, quote(h3.pricing, j.resolutionTier, j.seconds, j.mode, images)?.total, j.id);
    }
    const times = MOCK_VIDEO_STUDIO_JOBS.map((j) => Date.parse(j.createdAt));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  test("演示任务带上二版字段：原提示词 / 模板 id 是 null 或真实存在的模板", () => {
    const templateIds = new Set(MOCK_VIDEO_STUDIO_TEMPLATES.map((t) => t.id));
    for (const j of MOCK_VIDEO_STUDIO_JOBS) {
      assert.ok("originalPrompt" in j && "templateId" in j, j.id);
      if (j.templateId) assert.ok(templateIds.has(j.templateId), j.id);
    }
    assert.ok(MOCK_VIDEO_STUDIO_JOBS.some((j) => j.originalPrompt));
    assert.ok(MOCK_VIDEO_STUDIO_JOBS.some((j) => j.templateId));
  });

  test("演示模板：两个官方 + 一个自己的，新的在前，时间是 ISO，素材的角色和模式对得上", () => {
    assert.deepEqual(
      MOCK_VIDEO_STUDIO_TEMPLATES.map((t) => `${t.scope}:${t.mine}`).sort(),
      ["official:false", "official:false", "private:true"],
    );
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    const times = MOCK_VIDEO_STUDIO_TEMPLATES.map((t) => {
      assert.match(t.createdAt, iso, t.id);
      return Date.parse(t.createdAt);
    });
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    for (const t of MOCK_VIDEO_STUDIO_TEMPLATES) {
      assert.deepEqual(validateTemplateDraft(t.title, t.description ?? ""), [], t.id);
      assert.ok(VIDEO_STUDIO_TEMPLATE_SCOPE_LABEL[t.scope], t.id);
      const spec = h3.contract.modes.find((m) => m.mode === t.mode);
      assert.ok(spec, t.id);
      const roles = t.materials.map((m) => m.role);
      assert.equal(roles.includes("first_frame"), spec.needsFirstFrame, t.id);
      assert.equal(roles.includes("last_frame"), spec.needsLastFrame, t.id);
      assert.equal(roles.includes("reference"), spec.references !== null && t.materials.length > 0, t.id);
      for (const m of t.materials) assert.ok(m.key.startsWith(`video-studio-${m.mediaType}/`), m.key);
      const labels = referenceLabels(t.materials.filter((m) => m.role === "reference"));
      assert.deepEqual(t.materials.filter((m) => m.role === "reference").map((m) => m.label), labels, t.id);
    }
  });
});
