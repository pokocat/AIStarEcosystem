import { describe, expect, test } from "vitest";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { clampSceneDuration, sceneVideoDurations, sceneVideoInputs, sceneVideoSettings, type SceneVideoMaterial } from "./scene-video-plan";

const limit = (mediaType: string, maxCount: number) => ({ mediaType, maxCount, maxBytes: 1e8, formats: [], minDurationSec: null, maxDurationSec: null });
const mode = (name: string, patch: object = {}) => ({ mode: name, needsFirstFrame: false, needsLastFrame: false, frameImage: null, references: null, ...patch });
const model = (modes: object[], extra: Partial<VideoStudioModel> = {}) => ({ endpointId: "m", name: "m", isDefault: true, selectableById: true, supportsPromptOptimization: false, batchCounts: [1],
  contract: { modes, tiers: [{ tier: "720p", canvases: [] }], minSeconds: 4, maxSeconds: 15, promptMaxChars: 100, seedMax: 1 },
  pricing: { perSecond: {}, freeRefImages: 0, extraRefImagePerSecond: 0, promptOptimizationPerCall: 0 }, ...extra }) as unknown as VideoStudioModel;
const reference = mode("universal_reference_video", { references: { image: limit("image", 2), video: limit("video", 1), audio: limit("audio", 1), maxImagesWithVideo: 2, maxTotal: 4, minVisual: 1, maxAudioTotalSec: 30 } });
const firstFrame = mode("i2v", { needsFirstFrame: true });
const m = (key: string, mediaType: "image" | "audio" = "image"): SceneVideoMaterial => ({ key, mediaType, title: key, nodeId: `n-${key}` });

describe("按脚本出片时素材怎么交给模型", () => {
  test("能全能参考就把图和声音按顺序都交出去；超出上限的写明不会用上", () => {
    const plan = sceneVideoInputs(model([mode("t2v"), reference]), [m("a"), m("b"), m("c"), m("v", "audio")]);
    expect(plan.spec.mode).toBe("universal_reference_video");
    expect(plan.used.map(u => u.key)).toEqual(["a", "b", "v"]);
    expect(plan.note).toContain("最多用 2 张图");
  });
  test("只能看首帧的模型用第一张图；声音用不上也要说", () => {
    const plan = sceneVideoInputs(model([mode("t2v"), firstFrame]), [m("a"), m("v", "audio")]);
    expect(plan.spec.mode).toBe("i2v");
    expect(plan.used.map(u => u.key)).toEqual(["a"]);
    expect(plan.note).toBe("这个模型只用第一张图做开头画面，声音不会用上");
  });
  test("不看素材的模型只按脚本出，并且说清楚；没有素材时不多嘴", () => {
    expect(sceneVideoInputs(model([mode("t2v")]), [m("a")])).toMatchObject({ used: [], note: "这个模型不看参考素材，只按脚本生成" });
    expect(sceneVideoInputs(model([mode("t2v"), reference]), []).note).toBeUndefined();
  });
  test("会改写描述的模型（H3）由我们先按它的写法优化再出片", () => {
    const plain = model([mode("t2v")]), h3 = model([mode("t2v")], { supportsPromptOptimization: true });
    expect(sceneVideoSettings(plain, "720p", sceneVideoInputs(plain, [])).rewrite).toBeUndefined();
    expect(sceneVideoSettings(h3, "720p", sceneVideoInputs(h3, []))).toMatchObject({ mode: "t2v", resolutionTier: "720p", rewrite: "auto" });
  });
});

test("时长按模型范围 5 秒一档，带上两头；场景默认时长放进范围", () => {
  const contract = model([]).contract;
  expect(sceneVideoDurations(contract)).toEqual([4, 5, 10, 15]);
  expect(sceneVideoDurations({ ...contract, minSeconds: 4, maxSeconds: 4 })).toEqual([4]);
  expect(clampSceneDuration(25, contract)).toBe(15);
  expect(clampSceneDuration(2, contract)).toBe(4);
});

test("能优化描述的模型：默认先改写（另一笔按用量结算的任务）；用户选按原文时不改写，厂商自己的改写也关", () => {
  const plan = sceneVideoInputs(model([mode("t2v")], { supportsPromptOptimization: true }), []);
  const h3 = model([mode("t2v")], { supportsPromptOptimization: true });
  expect(sceneVideoSettings(h3, "720p", plan)).toMatchObject({ rewrite: "auto" });
  const original = sceneVideoSettings(h3, "720p", plan, false);
  expect(original.rewrite).toBeUndefined();
  expect(original.optimizePrompt).toBe(false);
  // 不支持优化的模型两种选择都一样，不带任何优化字段。
  const plain = sceneVideoSettings(model([mode("t2v")]), "720p", plan, false);
  expect(plain.rewrite).toBeUndefined();
  expect(plain.optimizePrompt).toBeUndefined();
});
