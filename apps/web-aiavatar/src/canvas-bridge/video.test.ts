// 视频提交层的回归。
//
// 真实事故（v0.176）：用户在面板上选了清晰度、比例、秒数，点发送却报
// 「请提供视频时长」。原因是画布调的是
//   createVideoGenerationTask(config, prompt, images, { signal, videos, audios })
// —— 那几项全在 **config** 里，options 里一个都没有，而这一层只读 options。
// VideoMediaOptions 全是可选字段，所以 typecheck 一声不吭。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nativeModelMock = vi.fn();
const generateVideoMock = vi.fn();
const submitStudioMock=vi.fn();
const readVideoJobMock = vi.fn();
vi.mock("./api", () => ({
  generateVideo: (...a: unknown[]) => generateVideoMock(...a),
  readVideoJob: (...a: unknown[]) => readVideoJobMock(...a),
  currentProjectId: () => "IPP-test",
}));
vi.mock("./studio-api",()=>({submitStudioRun:(...a:unknown[])=>submitStudioMock(...a)}));
vi.mock("./models", () => ({
  legacyVideoQuoteFor:()=>80,
  nativeVideoModelFor: () => nativeModelMock(),
  endpointIdFor: (v?: string) => (v ? `ep-${v}` : undefined),
  videoDurationBoundsFor: () => undefined,
}));

import { GenerationCanceled } from "./generation";
import { createVideoGenerationTask, isVideoTaskFailed, VideoTaskFailed, VideoSubmissionUnconfirmed } from "./video";

const cfg = {
  videoSeconds: "8",
  size: "720x1280",
  videoModel: "MiniMax H3",
  videoMode: "frames",
} as never;

beforeEach(() => {
  submitStudioMock.mockReset();
  nativeModelMock.mockReset();
  generateVideoMock.mockReset();
  generateVideoMock.mockResolvedValue({ id: "MVJ-1" });
  readVideoJobMock.mockReset().mockResolvedValue({ id: "mvj_1", status: "ready" });
});

describe("画布视频提交", () => {
  it("面板上选的时长 / 比例 / 模型都要送到服务端", async () => {
    await createVideoGenerationTask(cfg, "让她眨眼", [{ storageKey: "ipstudio_gen/u/a.png" }], {
      // 画布真实的调用形状：只有这三样
      signal: undefined, videos: [], audios: [],
    });
    const [, body] = generateVideoMock.mock.calls[0];
    expect(body.durationSec).toBe(8);
    expect(body.aspectRatio).toBe("9:16");   // 720x1280 → 9:16
    expect(body.model).toBe("ep-MiniMax H3");
    expect(body.refKey).toBe("ipstudio_gen/u/a.png");
  });

  // 与出图同一个缺陷（v0.179 修）：`videoModel` 是全局默认，排在 `config.model` 前面
  // 就等于「节点上选了个模型，跑的还是默认那个」，而界面按选中的那个标价。
  it("节点上选的视频模型（config.model）胜过全局默认（config.videoModel）", async () => {
    await createVideoGenerationTask({ ...cfg, model: "节点选的", videoModel: "全局默认" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0][1].model).toBe("ep-节点选的");
  });

  it("没有 model 时才回落 videoModel；两个都空就不传（服务端走默认端点）", async () => {
    await createVideoGenerationTask({ ...cfg, model: "", videoModel: "全局默认" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0][1].model).toBe("ep-全局默认");
    generateVideoMock.mockClear();
    await createVideoGenerationTask({ ...cfg, model: "", videoModel: "" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0][1].model).toBeUndefined();
  });

  it("options 显式给的值优先于 config", async () => {
    await createVideoGenerationTask(cfg, "x", [], { seconds: "5", aspectRatio: "16:9" });
    const [, body] = generateVideoMock.mock.calls[0];
    expect(body.durationSec).toBe(5);
    expect(body.aspectRatio).toBe("16:9");
  });

  it("比例是 auto 就不传 —— 交给服务端默认，不瞎猜一个塞过去", async () => {
    await createVideoGenerationTask({ ...cfg, size: "auto" } as never, "x", []);
    expect(generateVideoMock.mock.calls[0][1].aspectRatio).toBeUndefined();
  });

  it("真的没有时长时当场说清楚，不让服务端回一句「请提供视频时长」", async () => {
    await expect(
      createVideoGenerationTask({ ...cfg, videoSeconds: "" } as never, "x", []),
    ).rejects.toThrow(/时长/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });

  it("全能参考模式我们还没有 —— 明说，不悄悄按首帧跑", async () => {
    await expect(
      createVideoGenerationTask({ ...cfg, videoMode: "reference" } as never, "x", []),
    ).rejects.toThrow(/首帧/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });
});

describe("native video canvas submission",()=>{
  const native={contract:{modes:[{mode:"first_last_frame_video",needsFirstFrame:true,needsLastFrame:true},{mode:"universal_reference_video",references:{image:{maxCount:9},video:{maxCount:1},audio:{maxCount:3},maxTotal:12,maxImagesWithVideo:8,minVisual:1}}],tiers:[{tier:"544p",canvases:[{aspectRatio:"9:16"}]}],minSeconds:5,maxSeconds:15,promptMaxChars:7000,seedMax:2147483647},pricing:{perSecond:{first_last_frame_video:{"544p":40},universal_reference_video:{"544p":40}},freeRefImages:0,extraRefImagePerSecond:0}};
  it("native frame mode sends two keys, quality, seed and an approved cost",async()=>{
    nativeModelMock.mockReturnValue(native);
    await createVideoGenerationTask({...cfg,vquality:"544",videoSeed:42} as never,"transition",[{storageKey:"first"},{storageKey:"last"}]);
    const body=generateVideoMock.mock.calls[0][1];expect(body.refKey).toBeUndefined();
    expect(body.video).toEqual({mode:"first_last_frame_video",resolutionTier:"544p",seed:42,firstFrameKey:"first",lastFrameKey:"last"});expect(body.maxCost).toBe(320);
  });
  it("reference mode sends image, video and audio keys rather than dropping them",async()=>{
    nativeModelMock.mockReturnValue(native);
    await createVideoGenerationTask({...cfg,vquality:"544",videoMode:"reference"} as never,"references",[{storageKey:"image"}],{videos:[{storageKey:"video"}],audios:[{storageKey:"audio"}]});
    expect(generateVideoMock.mock.calls[0][1].video.references).toEqual([{mediaType:"image",key:"image"},{mediaType:"video",key:"video"},{mediaType:"audio",key:"audio"}]);
  });
  it("legacy models reject the second reference without submitting a partial request",async()=>{
    await expect(createVideoGenerationTask(cfg,"x",[{storageKey:"first"},{storageKey:"last"}])).rejects.toThrow(/一张/);
    expect(generateVideoMock).not.toHaveBeenCalled();
  });
});

// 轮询路径必须打在 ip-studio 域自己的接口上。
// v0.177 之前打的是 `/me/material/videos/jobs/{id}` —— 服务端从来没实现过那条路径，
// 先被开通闸判成「该接口尚未登记子产品归属」403，登记了路由也还是 404；
// 而带货线那条同名接口把 app 写死成 celebrity（v0.108 分区），拿它查画布任务只会查不到。
describe("视频任务轮询路径", () => {
  it("打的是 ip-studio 自己的接口，不是带货线那条", async () => {
    const src = readFileSync(join(__dirname, "api.ts"), "utf8");
    // 只看真正发出去的模板字面量，注释里提到旧路径不算（那是在解释为什么不能用它）
    const urls = [...src.matchAll(/apiFetch<[^>]*>\(\s*`([^`]+)`/g)].map((m) => m[1]);
    expect(urls).toContain("/v1/ip-studio/videos/${encodeURIComponent(jobId)}");
    expect(urls.some((u) => u.includes("/me/material/"))).toBe(false);
  });
});

// 名片一键建卡：body 必须给对象。共享 apiFetch 自己会序列化，
// 调用方再 JSON.stringify 一遍就是双重编码 —— 服务端 500，前端只显示
// 「服务器处理请求失败」（v0.179 线上踩过）。
describe("一键建数字名片", () => {
  it("body 传对象，不自己 stringify", async () => {
    const src = readFileSync(join(__dirname, "../ip/api/assets.ts"), "utf8");
    const call = src.slice(src.indexOf("/v1/card/from-avatar"));
    expect(call).toContain("body: { avatarId }");
    expect(call.slice(0, 200)).not.toContain("JSON.stringify");
  });
});

// 调用点靠 isVideoTaskFailed 决定要不要把节点上的 videoTaskId 抹掉 —— 那是唯一能把成片
// 接回来的凭据。所以这个判断必须站在「还没结束」那一边：抹早了，用户只能重新出一次片、
// 再付一次钱。上游是「除了取消都算失败」，那个默认方向在本仓会把一次网络抖动变成一次重复付费。
describe("哪些错误代表「这条任务已经结束了」", () => {
  it("服务端明确说失败 = 是（任务号可以丢）", () => {
    expect(isVideoTaskFailed(new VideoTaskFailed("视频生成失败，积分已退回"))).toBe(true);
  });

  it("前端等超时 = 不是（任务还在服务端跑，任务号要留着）", () => {
    expect(isVideoTaskFailed(new Error("等太久了（任务号 mvj_1）"))).toBe(false);
  });

  it("网络抖动 = 不是（轮询这一下没成功，不代表任务失败）", () => {
    expect(isVideoTaskFailed(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("用户取消 = 不是", () => {
    expect(isVideoTaskFailed(new GenerationCanceled())).toBe(false);
  });
});

// 「说成了但没有成片地址」不是终态失败：刷新再查一次说不定就有了。
describe("任务说成了却没有成片地址", () => {
  it("按「还没结束」处理，保住任务号", async () => {
    const { pollVideoGenerationTask } = await import("./video");
    const state = await pollVideoGenerationTask(undefined, { id: "mvj_1", provider: "plugin", model: "" });
    expect(state.status).toBe("failed");
    if (state.status === "failed") expect(state.ended).toBeFalsy();
  });
});

describe('idempotent native canvas video batches',()=>{
  it('saves the exact request before submitting one four-item batch with its total ceiling',async()=>{
    const sequence:string[]=[],beforeSubmit=vi.fn(async()=>{sequence.push('save');}),onRun=vi.fn();
    submitStudioMock.mockImplementation(async()=>{sequence.push('submit');return {id:'IPR-batch',status:'running',output:{}};});
    const task=await createVideoGenerationTask({...cfg,videoCount:'4'} as never,'动作',[{storageKey:'first'}],{nodeId:'node',beforeSubmit,onRun});
    expect(sequence).toEqual(['save','submit']);expect(submitStudioMock).toHaveBeenCalledTimes(1);
    const request=submitStudioMock.mock.calls[0][1];expect(request.count).toBe(4);expect(request.maxCost).toBe(320);
    expect(request.nodeId).toBe('node');expect(request.references).toEqual([{storageKey:'first',role:'frame'}]);
    expect(beforeSubmit).toHaveBeenCalledWith(request);expect(onRun).toHaveBeenCalled();expect(task.id).toBe('IPR-batch');expect(generateVideoMock).not.toHaveBeenCalled();
  });
  it('does not submit if persisting the recovery request fails',async()=>{
    await expect(createVideoGenerationTask({...cfg,videoCount:'2'} as never,'动作',[],{nodeId:'node',beforeSubmit:async()=>{throw new Error('保存冲突');}})).rejects.toThrow('保存冲突');
    expect(submitStudioMock).not.toHaveBeenCalled();
  });
  it('marks a lost submission response as unconfirmed and preserves the original request key',async()=>{
    const saved=vi.fn(async()=>{});submitStudioMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(createVideoGenerationTask({...cfg,videoCount:'2'} as never,'动作',[],{nodeId:'node',beforeSubmit:saved})).rejects.toBeInstanceOf(VideoSubmissionUnconfirmed);
    expect(saved.mock.calls[0]).toBeDefined();expect(submitStudioMock.mock.calls[0][1].clientRequestId).toBeTruthy();expect(generateVideoMock).not.toHaveBeenCalled();
  });
});
