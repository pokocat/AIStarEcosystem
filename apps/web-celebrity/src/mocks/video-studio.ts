// ─────────────────────────────────────────────────────────────────────────────
// mocks/video-studio.ts：「视频生成」演示数据（NEXT_PUBLIC_USE_MOCK=1）。
//
// 形状与服务端 DTO 完全一致（AGENTS.md §8.0.1 ⑦）：时间是 ISO 字符串（§4.8），
// 数值是原始整数（§4.5）。模型合同照 docs/video-studio-plan.md §2（5–15 秒、每档六种画布、
// 各模式的素材限制）；价格照 §3 的形状（我们自己定、按模式 × 清晰度配），这里放一份
// 「运营配过一部分」的样子：全能参考 544p 故意留空，用来看「这个规格还没定价」的样子。
//
// 演示任务没有真实成片（videoUrl 为 null），界面会标「演示」并说明，不放一个坏掉的播放器（§8.0）。
// 这里只放数据；任务推进、上传模拟在 api/video-studio.ts 的 USE_MOCK 分支里。
// 只有 `import type`：node --test 可以直接加载本文件做合同校验。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VideoStudioJob,
  VideoStudioMediaLimit,
  VideoStudioModel,
  VideoStudioReferenceRules,
  VideoStudioTemplate,
} from "@ai-star-eco/types/video-studio";

const MIB = 1024 * 1024;

const IMAGE_FORMATS = ["PNG", "JPEG", "WEBP"];

const FRAME_IMAGE: VideoStudioMediaLimit = {
  mediaType: "image",
  maxCount: 1,
  maxBytes: 16 * MIB,
  formats: IMAGE_FORMATS,
  minDurationSec: null,
  maxDurationSec: null,
};

const REFERENCE_RULES: VideoStudioReferenceRules = {
  image: {
    mediaType: "image",
    maxCount: 9,
    maxBytes: 30 * MIB,
    formats: IMAGE_FORMATS,
    minDurationSec: null,
    maxDurationSec: null,
  },
  video: {
    mediaType: "video",
    maxCount: 1,
    maxBytes: 50 * MIB,
    formats: ["MP4"],
    minDurationSec: null,
    maxDurationSec: null,
  },
  audio: {
    mediaType: "audio",
    maxCount: 3,
    maxBytes: 15 * MIB,
    formats: ["WAV", "MP3", "FLAC", "AAC", "OGG", "M4A", "MOV"],
    minDurationSec: 2,
    maxDurationSec: 15,
  },
  maxImagesWithVideo: 8,
  maxTotal: 12,
  minVisual: 1,
  maxAudioTotalSec: 15,
};

/** 上传接口本身的单文件上限（与模式无关）：图 30 MB / 视频 50 MB / 音频 15 MB，见 plan §5.5。 */
export const MOCK_UPLOAD_MAX_BYTES = {
  image: 30 * MIB,
  video: 50 * MIB,
  audio: 15 * MIB,
} as const;

/** 上传接口对单段音频的时长要求（秒），见 plan §5.5。 */
export const MOCK_UPLOAD_AUDIO_SECONDS = { min: 2, max: 15 } as const;

export const MOCK_VIDEO_STUDIO_MODELS: VideoStudioModel[] = [
  {
    endpointId: "mock-minimax-h3",
    name: "MiniMax H3",
    isDefault: true,
    selectableById: true,
    contract: {
      modes: [
        { mode: "t2v", needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null },
        { mode: "i2v", needsFirstFrame: true, needsLastFrame: false, frameImage: FRAME_IMAGE, references: null },
        {
          mode: "first_last_frame_video",
          needsFirstFrame: true,
          needsLastFrame: true,
          frameImage: FRAME_IMAGE,
          references: null,
        },
        {
          mode: "universal_reference_video",
          needsFirstFrame: false,
          needsLastFrame: false,
          frameImage: null,
          references: REFERENCE_RULES,
        },
      ],
      tiers: [
        {
          tier: "768p",
          canvases: [
            { aspectRatio: "21:9", width: 1536, height: 672 },
            { aspectRatio: "16:9", width: 1344, height: 768 },
            { aspectRatio: "4:3", width: 1024, height: 768 },
            { aspectRatio: "1:1", width: 768, height: 768 },
            { aspectRatio: "3:4", width: 768, height: 1024 },
            { aspectRatio: "9:16", width: 768, height: 1344 },
          ],
        },
        {
          tier: "544p",
          canvases: [
            { aspectRatio: "21:9", width: 1280, height: 544 },
            { aspectRatio: "16:9", width: 960, height: 544 },
            { aspectRatio: "4:3", width: 736, height: 544 },
            { aspectRatio: "1:1", width: 544, height: 544 },
            { aspectRatio: "3:4", width: 544, height: 736 },
            { aspectRatio: "9:16", width: 544, height: 960 },
          ],
        },
      ],
      minSeconds: 5,
      maxSeconds: 15,
      promptMaxChars: 7000,
      seedMax: 2147483647,
    },
    pricing: {
      perSecond: {
        t2v: { "768p": 40, "544p": 20 },
        i2v: { "768p": 40, "544p": 20 },
        first_last_frame_video: { "768p": 45, "544p": 25 },
        universal_reference_video: { "768p": 50, "544p": null },
      },
      freeRefImages: 2,
      extraRefImagePerSecond: 10,
      promptOptimizationPerCall: 2,
    },
  },
];

/** 演示用的输入素材缩略图：一块暖色渐变（没有真实素材可放；整张卡片另有「演示」标）。 */
function swatch(from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs><rect width="160" height="160" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 演示用的音频素材：一小段静音 WAV（8 kHz / 8 bit / 单声道）。 */
function silentWav(seconds: number): string {
  const sampleRate = 8000;
  const samples = Math.round(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8 bit PCM 的静音是 128
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * 预置的几条演示任务，每种状态都有，新的在前（与 `GET …/jobs` 同序）；积分与上面的价格对得上。
 * 排队中 / 生成中那两条是静态的，方便对照各状态的界面；页面上新提交的演示任务会自己往前走。
 * vs-demo-1 用过智能优化（带原提示词），vs-demo-2 / vs-demo-5 是做同款出来的。
 */
export const MOCK_VIDEO_STUDIO_JOBS: VideoStudioJob[] = [
  {
    id: "vs-demo-5",
    mode: "universal_reference_video",
    prompt: "图1 的模特穿着图2 的风衣，在傍晚的街角慢慢转身，跟着音频1 的节奏走出画面，暖色调，手持跟拍",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    width: 768,
    height: 1344,
    seconds: 8,
    seed: null,
    modelName: "MiniMax H3",
    status: "running",
    progressPct: 42,
    stage: "AI 生成中",
    inputs: [
      { mediaType: "image", label: "图1", url: swatch("#eae3ff", "#b4a4ff") },
      { mediaType: "image", label: "图2", url: swatch("#f3efe7", "#d8cfba") },
      { mediaType: "audio", label: "音频1", url: silentWav(0.5) },
    ],
    videoUrl: null,
    thumbnailUrl: null,
    errorMessage: null,
    credits: 400,
    originalPrompt: null,
    templateId: "vs-tpl-official-2",
    createdAt: "2026-09-30T03:41:12Z",
    completedAt: null,
  },
  {
    id: "vs-demo-4",
    mode: "t2v",
    prompt: "俯拍一张木质餐桌，桌上摆着刚出炉的可颂和一杯热咖啡，蒸汽缓缓升起，自然光",
    resolutionTier: "544p",
    aspectRatio: "16:9",
    width: 960,
    height: 544,
    seconds: 5,
    seed: null,
    modelName: null,
    status: "queued",
    progressPct: 0,
    stage: "已入队",
    inputs: [],
    videoUrl: null,
    thumbnailUrl: null,
    errorMessage: null,
    credits: 100,
    originalPrompt: null,
    templateId: null,
    createdAt: "2026-09-30T03:39:57Z",
    completedAt: null,
  },
  {
    id: "vs-demo-3",
    mode: "first_last_frame_video",
    prompt: "镜头从桌面全景慢慢推到口红特写，光线从冷色过渡到暖色",
    resolutionTier: "768p",
    aspectRatio: "3:4",
    width: 768,
    height: 1024,
    seconds: 6,
    seed: 20260930,
    modelName: "MiniMax H3",
    status: "failed",
    progressPct: 100,
    stage: "生成失败",
    inputs: [
      { mediaType: "image", label: "首帧", url: swatch("#fef6e7", "#fad181") },
      { mediaType: "image", label: "尾帧", url: swatch("#fff0f4", "#ffadc1") },
    ],
    videoUrl: null,
    thumbnailUrl: null,
    errorMessage: "视频模型拒绝了这次请求：首帧和尾帧的画面比例不一致",
    credits: 270,
    originalPrompt: null,
    templateId: null,
    createdAt: "2026-09-30T02:15:08Z",
    completedAt: "2026-09-30T02:16:40Z",
  },
  {
    id: "vs-demo-2",
    mode: "i2v",
    prompt: "模特拿起香水瓶轻轻喷一下，转头看向镜头微笑，背景虚化",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    width: 768,
    height: 1344,
    seconds: 5,
    seed: null,
    modelName: "MiniMax H3",
    status: "succeeded",
    progressPct: 100,
    stage: "已完成",
    inputs: [{ mediaType: "image", label: "首帧", url: swatch("#e6f7f3", "#99dec9") }],
    videoUrl: null,
    thumbnailUrl: null,
    errorMessage: null,
    credits: 200,
    originalPrompt: null,
    templateId: "vs-tpl-official-1",
    createdAt: "2026-09-29T11:52:31Z",
    completedAt: "2026-09-29T11:55:02Z",
  },
  {
    id: "vs-demo-1",
    mode: "t2v",
    prompt: "海边日落，一位穿白色连衣裙的女生赤脚走过浅滩，裙摆被风吹起，镜头从侧面跟拍，胶片质感",
    resolutionTier: "768p",
    aspectRatio: "16:9",
    width: 1344,
    height: 768,
    seconds: 10,
    seed: 42,
    modelName: "MiniMax H3",
    status: "succeeded",
    progressPct: 100,
    stage: "已完成",
    inputs: [],
    videoUrl: null,
    thumbnailUrl: null,
    errorMessage: null,
    credits: 400,
    originalPrompt: "海边日落，白裙女生光脚走过浅滩",
    templateId: null,
    createdAt: "2026-09-29T09:03:44Z",
    completedAt: "2026-09-29T09:07:19Z",
  },
];

/**
 * 预置的模板：两个官方（运营发布、所有人可见）+ 一个自己的（仅自己可见），新的在前（与 `GET …/templates` 同序）。
 * 演示模板没有原作成片（previewVideoUrl 为 null），卡片会说明，不放打不开的播放器。
 */
export const MOCK_VIDEO_STUDIO_TEMPLATES: VideoStudioTemplate[] = [
  {
    id: "vs-tpl-mine-1",
    scope: "private",
    title: "海边日落 · 白裙跟拍",
    description: "胶片质感那版，留着换产品用",
    mode: "t2v",
    prompt: "海边日落，一位穿白色连衣裙的女生赤脚走过浅滩，裙摆被风吹起，镜头从侧面跟拍，胶片质感",
    resolutionTier: "768p",
    aspectRatio: "16:9",
    seconds: 10,
    seed: 42,
    endpointId: "mock-minimax-h3",
    modelName: "MiniMax H3",
    materials: [],
    previewVideoUrl: null,
    previewThumbnailUrl: null,
    useCount: 2,
    mine: true,
    createdAt: "2026-09-29T10:05:12Z",
  },
  {
    id: "vs-tpl-official-1",
    scope: "official",
    title: "香水试用 · 转头微笑",
    description: "首帧放模特持香水的半身照，适合美妆个护类商品",
    mode: "i2v",
    prompt: "模特拿起香水瓶轻轻喷一下，转头看向镜头微笑，背景虚化",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    seconds: 5,
    seed: null,
    endpointId: "mock-minimax-h3",
    modelName: "MiniMax H3",
    materials: [
      {
        role: "first_frame",
        mediaType: "image",
        key: "video-studio-image/mock-ops/perfume-first.png",
        label: "首帧",
        url: swatch("#e6f7f3", "#99dec9"),
      },
    ],
    previewVideoUrl: null,
    previewThumbnailUrl: null,
    useCount: 128,
    mine: false,
    createdAt: "2026-09-28T08:12:40Z",
  },
  {
    id: "vs-tpl-official-2",
    scope: "official",
    title: "街拍穿搭 · 跟着节奏走",
    description: "图1 放模特、图2 放服装，音频换成自己的背景音乐",
    mode: "universal_reference_video",
    prompt: "图1 的模特穿着图2 的风衣，在傍晚的街角慢慢转身，跟着音频1 的节奏走出画面，暖色调，手持跟拍",
    resolutionTier: "768p",
    aspectRatio: "9:16",
    seconds: 8,
    seed: 20260927,
    endpointId: "mock-minimax-h3",
    modelName: "MiniMax H3",
    materials: [
      {
        role: "reference",
        mediaType: "image",
        key: "video-studio-image/mock-ops/street-model.png",
        label: "图1",
        url: swatch("#eae3ff", "#b4a4ff"),
      },
      {
        role: "reference",
        mediaType: "image",
        key: "video-studio-image/mock-ops/street-coat.png",
        label: "图2",
        url: swatch("#f3efe7", "#d8cfba"),
      },
      {
        role: "reference",
        mediaType: "audio",
        key: "video-studio-audio/mock-ops/street-beat.wav",
        label: "音频1",
        url: silentWav(0.5),
      },
    ],
    previewVideoUrl: null,
    previewThumbnailUrl: null,
    useCount: 57,
    mine: false,
    createdAt: "2026-09-27T12:30:00Z",
  },
];
