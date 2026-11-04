// Static design export only: sample responses for read endpoints that have no mock in the normal demo mode.
import { registerMock } from "@ai-star-eco/api-client";
import { ENTERPRISE_DESIGN_SAMPLE } from "@/mocks/enterprise";
import { mockCancelRun, mockNextId, mockReadRun, mockStore } from "@/ip/mocks/ip-studio";
const CTX = { ...ENTERPRISE_DESIGN_SAMPLE, billingDefault: "personal" as const };

const AT = "2026-11-01T02:30:00Z";
const page = <T,>(data: T[]) => ({ success: true, data, pagination: { page: 0, limit: 20, total: data.length, totalPages: 1, hasNext: false, hasPrev: false } });
const IMG = (name: string) => `/generated/avatar-previews/example-${name}.jpg`;

const imageOption = (endpointId: string, name: string, creditCost: number, isDefault: boolean) => ({
  endpointId, name, model: endpointId, vendor: "demo", isDefault, creditCost, billingUnit: "per_image", imageFamily: endpointId,
  capability: { maxRefImages: 6, imageRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"], imagePromptMaxChars: 3000, imageBatchCounts: [1, 2, 4], imageSizes: null },
});
const videoOption = (endpointId: string, name: string, creditCost: number, isDefault: boolean) => ({
  endpointId, name, model: endpointId, vendor: "demo", isDefault, creditCost, billingUnit: "per_second",
  capability: { maxRefImages: 9, minDurationSec: 4, maxDurationSec: 15, videoResolutions: ["720", "1080"], videoRatios: ["9:16", "16:9", "1:1"] },
});

const limit = (mediaType: string, maxCount: number, maxBytes: number, formats: string[], minDurationSec: number | null = null, maxDurationSec: number | null = null) => ({ mediaType, maxCount, maxBytes, formats, minDurationSec, maxDurationSec });
const frame = limit("image", 1, 20 * 1048576, ["PNG", "JPEG", "WEBP"]);
const canvases = [
  { aspectRatio: "9:16", width: 720, height: 1280, outputSizeCode: null },
  { aspectRatio: "16:9", width: 1280, height: 720, outputSizeCode: null },
  { aspectRatio: "1:1", width: 768, height: 768, outputSizeCode: null },
];
const MODES = ["t2v", "i2v", "flf", "omni"];
const videoStudioModel = {
  endpointId: "video-h3", name: "H3", isDefault: true, selectableById: true, supportsPromptOptimization: true, batchCounts: [1, 2],
  contract: {
    modes: [
      { mode: "t2v", label: "文生视频", promptRequired: true, needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null },
      { mode: "i2v", label: "首帧生成", promptRequired: false, needsFirstFrame: true, needsLastFrame: false, frameImage: frame, references: null },
      { mode: "flf", label: "首尾帧", promptRequired: false, needsFirstFrame: true, needsLastFrame: true, frameImage: frame, references: null },
      { mode: "omni", label: "全能参考", promptRequired: true, needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: {
        image: limit("image", 9, 20 * 1048576, ["PNG", "JPEG", "WEBP"]), video: limit("video", 3, 128 * 1048576, ["MP4", "MOV"], 2, 15), audio: limit("audio", 3, 15 * 1048576, ["MP3", "WAV", "M4A"], 2, 15),
        maxImagesWithVideo: 4, maxTotal: 12, minVisual: 1, maxAudioTotalSec: 15 } },
    ],
    tiers: [{ tier: "768p", canvases }, { tier: "544p", canvases }],
    minSeconds: 4, maxSeconds: 15, promptMaxChars: 5000, seedMax: 2147483647,
  },
  pricing: { perSecond: Object.fromEntries(MODES.map(m => [m, { "768p": 40, "544p": 24 }])), freeRefImages: 4, extraRefImagePerSecond: 2, promptOptimizationPerCall: 0 },
};

const tokens = { inputCreditsPerK: 0.5, outputCreditsPerK: 2, maxInputTokens: 32000, maxOutputTokens: 8192, maxCost: 40 };
const members = [
  { ...CTX.member, id: "m1", displayName: "周敏", phone: "138****0001" },
  { ...CTX.member, id: "m2", userId: "u2", displayName: "李然", phone: "139****0002", role: "manager" as const },
  { ...CTX.member, id: "m3", userId: "u3", displayName: "陈一", phone: "137****0003", role: "member" as const },
];
const balances = members.map((m, i) => ({ memberId: m.id, userId: m.userId, displayName: m.displayName, phone: m.phone, role: m.role, status: m.status, walletId: `w${i}`, totalBalance: [3200, 1800, 600][i], pendingBalance: [0, 120, 0][i], rechargeBalance: [3200, 1680, 600][i], giftBalance: 0, licenseBalance: 0 }));
const ENT = "/v1/ip-studio/enterprises";

registerMock("GET", "/v1/ip-studio/models", () => ({
  image: [imageOption("image-gpt", "GPT Image", 16, true), imageOption("image-seedream", "Seedream 4.5", 12, false), imageOption("image-agnes", "Agnes Image", 8, false)],
  video: [videoOption("video-h3", "H3", 40, true), videoOption("video-seedance", "Seedance", 30, false)],
}));
registerMock("GET", "/v1/ip-studio/studio/capabilities", () => ({
  mock: false, operations: ["text", "script", "storyboard", "image", "video", "assemble", "assistant", "recreation", "check"], imageCost: 16, textCost: 4, videoCost: 40,
  imageModelMode: "selectable", textModelMode: "selectable",
  textModels: [{ endpointId: "text-default", name: "默认文字模型", isDefault: true, supportsVision: true, supportsTools: true, supportsStreaming: true, creditCost: 4, tokenPricing: tokens, dialogueTokenPricing: tokens }],
}));
registerMock("GET", "/v1/ip-studio/studio/video-models", () => [videoStudioModel]);
registerMock("GET", "/v1/ip-studio/studio/ip-assets", () => [
  { ipId: "IP-1", avatarId: "DH-2041", version: 2, storageKey: "demo/lin", name: "林小满", url: IMG("lin-xiaoman"), current: true, characterName: "林小满", path: "ai", assetRole: "main", librarySource: "mine", description: "二十多岁的生活方式博主，短发，气质松弛。" },
  { ipId: "IP-1", avatarId: "DH-2041", version: 1, storageKey: "demo/lin1", name: "林小满 · 早期造型", url: IMG("lin-xiaoman"), current: false, characterName: "林小满", path: "ai", assetRole: "history", librarySource: "mine" },
  { ipId: "IP-2", avatarId: "DH-2038", version: 1, storageKey: "demo/he", name: "何屿", url: IMG("he-yu"), current: true, characterName: "何屿", path: "ai", assetRole: "main", librarySource: "mine", description: "三十岁的播客主理人，声音低，穿着简单。" },
  { ipId: "IP-3", avatarId: "PA-01", version: 1, storageKey: "demo/chen", name: "陈怡然", url: IMG("chen-yiran"), current: true, characterName: "陈怡然", path: "ai", assetRole: "main", librarySource: "official" },
]);
registerMock("GET", "/v1/ip-studio/studio/voice-profiles", () => ({
  performers: [{ avatarId: "DH-2041", ipId: "IP-1", name: "林小满", voiceId: "V-1" }, { avatarId: "DH-2038", ipId: "IP-2", name: "何屿" }],
  profiles: [{ voiceId: "V-1", avatarId: "DH-2041", name: "林小满 · 自然声", version: 1, speaker: "Vivian", instruct: "自然明快，像朋友一样介绍。", sourceRunId: "demo" }],
}));
registerMock("GET", "/me/social-accounts", () => [
  { id: "sa1", userId: "demo", platform: "douyin", accountName: "品牌主号", status: "active", displayName: "小满的日常", platformAccountId: "xiaoman2026", avatarUrl: IMG("lin-xiaoman"), boundAt: AT, lastVerifiedAt: AT },
  { id: "sa2", userId: "demo", platform: "xiaohongshu", accountName: "种草号", status: "active", displayName: "小满爱分享", platformAccountId: "xm_share", avatarUrl: IMG("beauty-creator"), boundAt: AT, lastVerifiedAt: AT },
  { id: "sa3", userId: "demo", platform: "shipinhao", accountName: "视频号", status: "expired", displayName: "小满视频号", boundAt: AT },
]);
registerMock("GET", "/me/publish-jobs/batches", () => page([
  { projectId: "IPP-0002mock", source: "studio", displayTitle: "小柚表情包短片 ×3", totalJobs: 3, statusCounts: { live: 2, failed: 1 }, progressPct: 100, firstCreatedAt: AT, lastCreatedAt: AT, firstScheduledAt: null, lastScheduledAt: null, platforms: ["douyin", "xiaohongshu", "shipinhao"], hasInflight: false },
  { projectId: "IPP-0001mock", source: "studio", displayTitle: "新品口播 ×2", totalJobs: 2, statusCounts: { queued: 1, publishing: 1 }, progressPct: 0, firstCreatedAt: AT, lastCreatedAt: AT, firstScheduledAt: AT, lastScheduledAt: AT, platforms: ["douyin", "kuaishou"], hasInflight: true },
]));
registerMock("GET", ENT, () => [CTX]);
registerMock("GET", `${ENT}/:id`, () => CTX);
registerMock("GET", `${ENT}/:id/wallet`, () => ({ enterpriseId: CTX.enterprise.id, enterpriseName: CTX.enterprise.name, unallocated: 12000, allocated: 5600, pending: 120, spent: 8400, totalBalance: 17600 }));
registerMock("GET", `${ENT}/:id/my-balance`, () => balances[0]);
registerMock("GET", `${ENT}/:id/members`, () => page(members));
registerMock("GET", `${ENT}/:id/member-balances`, () => page(balances));
registerMock("GET", `${ENT}/:id/policy`, () => ({ enterpriseId: CTX.enterprise.id, allowedEndpointIds: [], maxActiveJobs: 5, version: 1 }));
for (const tail of ["audit", "transfers", "recharges", "invitations", "ownership-transfers", "usage", "points/transfers", "recharge-orders"]) registerMock("GET", `${ENT}/:id/${tail}`, () => page([]));

// Prices shown next to generate buttons.
const quote = (kind: "image" | "video", quantity: number, unitPrice: number) => {
  const endpointId = kind === "image" ? "image-gpt" : "video-h3", credits = quantity * unitPrice;
  const target = { appCode: "aiavatar", action: kind, endpointId, providerModel: endpointId, specKey: kind === "image" ? "1024×1536" : "H3", unit: kind === "image" ? "image" as const : "second" as const };
  const usage = { quantity, outputQuantity: 0 };
  return { target, usage, standardCredits: credits, discountCredits: 0, payableCredits: credits, scopedCredits: 0, walletCredits: credits, discountName: null, priceVersion: "demo", grantAllocations: [], freeOnly: false, canAfford: true, unavailableCode: null, unavailableReason: null,
    approval: { walletId: "demo", target, usage, priceVersion: "demo", freeOnly: false, maxWalletCredits: credits } };
};
type QuoteBody = { count?: number; durationSec?: number };
registerMock("GET", "/v1/ip-studio/studio/video-price", ({ query }) => quote("video", Number(query?.durationSec ?? 5), 40));
for (const tail of ["image-quote", "studio-image-quote", "nodes/:nodeId/image-quote"]) registerMock("POST", `/v1/ip-studio/projects/:id/${tail}`, ({ body }) => quote("image", (body as QuoteBody)?.count ?? 1, 16));
for (const tail of ["video-quote", "studio-video-quote"]) registerMock("POST", `/v1/ip-studio/projects/:id/${tail}`, ({ body }) => quote("video", ((body as QuoteBody)?.durationSec ?? 5) * ((body as QuoteBody)?.count ?? 1), 40));
registerMock("GET", "/me/model-credits", () => page([]));
registerMock("GET", "/v1/ip-studio/shared/conversations/:token", () => ({ createdAt: AT, snapshot: { title: "洗衣液短视频的创作思路", mode: "general", turns: [
  { id: "t1", role: "user", content: "帮我想一条洗衣液的短视频，要有生活感。", createdAt: AT },
  { id: "t2", role: "assistant", content: "可以从「孩子的白校服」切入：开头是一件沾了颜料的校服，妈妈叹气；中段演示浸泡和洗净；结尾孩子穿着干净校服出门。全片 15 秒，三个镜头。", createdAt: AT },
] } }));

// Generate buttons outside the assistant: a run that takes a few seconds, then shows a placeholder result.
registerMock("GET", "/v1/ip-studio/projects/:id/billing-selection", () => ({ found: false }));
registerMock("GET", "/v1/ip-studio/library/objects/:id/billing-selection", () => ({ found: false }));
registerMock("POST", "/v1/ip-studio/projects/:id/studio-runs", ({ params, body }) => {
  const req = body as { nodeId: string; operation: string; prompt?: string; count?: number; durationSec?: number; size?: string; aspectRatio?: string; maxCost?: number };
  const id = mockNextId("IPR");
  const isImage = req.operation === "image", isVideo = req.operation === "video";
  const text = `这是静态演示版的示例文字，不是模型输出。\n\n你写的要求：${req.prompt ?? ""}`;
  const run = {
    id, projectId: params.id, nodeId: req.nodeId, kind: isImage ? "generate" : isVideo ? "studio-video" : "studio-text", status: "running", stage: "queued", pct: 2, cost: req.maxCost ?? 16,
    inputs: { prompt: req.prompt, count: req.count ?? 1, size: req.size, aspectRatio: req.aspectRatio, durationSec: req.durationSec },
    output: isImage ? {} : isVideo ? { mock: true, url: "/sample-video.mp4", storageKey: "demo/sample-video.mp4", durationSec: 5, width: 720, height: 1280, mimeType: "video/mp4" } : { mock: true, text, textRevision: { content: text, summary: "示例" } },
    createdAt: new Date().toISOString(),
  };
  mockStore().runs.set(id, { run, startedAtMs: Date.now(), durationMs: isVideo ? 6000 : 3000, caption: "示例", cancelled: false } as never);
  return { ...run };
});
registerMock("GET", "/v1/ip-studio/runs/:id", ({ params }) => mockReadRun(params.id));
registerMock("POST", "/v1/ip-studio/runs/:id/cancel", ({ params }) => mockCancelRun(params.id));
