import { describe, expect, it } from "vitest";
import type { AiModelEndpoint } from "@ai-star-eco/types/ai-model-config";
import {
  draftOf, imageSpecSummary, modelKind, modelUses, planCosts, planEndpointCreate, planEndpointUpdate, blankDraft, providerGroups,
  sameJson, scenePolicyChanges, supplierChanged, toggleEnabled, videoSpecSummary,
} from "./model-config";

// 线上 Doubao-Seedream-4.5 的规格片段：wire.requireExactOutputSize、modelQueryParam:"" 都是编辑器不认识的字段。
const liveImageSpec = {
  promptMaxChars: 16000, minReferenceImages: 0, maxReferenceImages: 14, referenceField: "multiple",
  outputs: [{ canvasSize: "2048x2048", aspectRatio: "1:1", providerFields: { size: "2048x2048", watermark: false } }],
  wire: { submitPath: "/images/generations", modelQueryParam: "", requireExactOutputSize: true, outputHosts: ["example.volces.com"] },
};
const liveVideoSpec = {
  adapter: "seedance", submitPath: "/contents/generations/tasks", modelsPath: "",
  contract: { modes: [{ mode: "t2v", frameImage: null }], tiers: [{ tier: "720p" }], minSeconds: 4, maxSeconds: 15, futureField: { nested: null } },
  someFieldThisPageHasNeverHeardOf: { keep: [1, null, ""] },
};

function endpoint(partial: Partial<AiModelEndpoint> = {}): AiModelEndpoint {
  return {
    id: "m1", name: "模型", providerType: "OPENAI_COMPATIBLE", baseUrl: "https://api.example.com/v1", model: "m", enabled: true,
    promptTokenPriceMicros: 0, completionTokenPriceMicros: 0, unitPriceMicros: 0,
    totalTokens: 0, totalBillableUnits: 0, totalBillableSeconds: 0, totalCalls: 0,
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...partial,
  };
}

describe("保存时发什么", () => {
  it("什么都没改就不发", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec, videoRequestSpec: liveVideoSpec, rpmLimit: 60, concurrencyLimit: 3 });
    expect(planEndpointUpdate(original, draftOf(original), null)).toEqual({ value: null, problems: [] });
  });

  it("只改名字时不带规格，服务端的规格不可能被动到", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec, videoRequestSpec: liveVideoSpec });
    const { value } = planEndpointUpdate(original, { ...draftOf(original), name: "新名字" }, null);
    expect(value?.name).toBe("新名字");
    expect(value).not.toHaveProperty("imageRequestSpec");
    expect(value).not.toHaveProperty("videoRequestSpec");
    expect(value).not.toHaveProperty("clearImageRequestSpec");
  });

  it("改规格时，编辑器不认识的字段原样带回", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec, videoRequestSpec: liveVideoSpec });
    const draft = draftOf(original);
    const edited = JSON.parse(draft.videoSpecText);
    edited.contract.maxSeconds = 30;
    const { value } = planEndpointUpdate(original, { ...draft, videoSpecText: JSON.stringify(edited) }, null);
    expect(value?.videoRequestSpec).toEqual({ ...liveVideoSpec, contract: { ...liveVideoSpec.contract, maxSeconds: 30 } });
    expect(value).not.toHaveProperty("imageRequestSpec");
  });

  it("只是重新排版规格 JSON 不算改动", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec });
    expect(planEndpointUpdate(original, { ...draftOf(original), imageSpecText: JSON.stringify(liveImageSpec) }, null).value).toBeNull();
  });

  it("每次保存都带上五个限额，否则服务端会清空", () => {
    const original = endpoint({ rpmLimit: 60, tpmLimit: 1000, dailyTokenQuota: 5000, dailyCostQuotaMicros: 9_000_000, alertFailureRatePct: 20 });
    const limits = { rpmLimit: 60, tpmLimit: 1000, dailyTokenQuota: 5000, dailyCostQuotaMicros: 9_000_000, alertFailureRatePct: 20 };
    expect(toggleEnabled(original, false)).toEqual({ enabled: false, ...limits });
    expect(planEndpointUpdate(original, { ...draftOf(original), name: "新名字" }, null).value).toMatchObject(limits);
  });

  it("清空限额时不发这个字段，由服务端清空", () => {
    const original = endpoint({ rpmLimit: 60 });
    const { value } = planEndpointUpdate(original, { ...draftOf(original), rpmLimit: "" }, null);
    expect(value).not.toBeNull();
    expect(value?.rpmLimit).toBeUndefined();
  });

  it("清空并发和输出上限时发 0：服务端约定没传是不改", () => {
    const original = endpoint({ concurrencyLimit: 3, chatMaxOutputTokens: 4096 });
    const { value } = planEndpointUpdate(original, { ...draftOf(original), concurrencyLimit: "", chatMaxOutputTokens: "" }, null);
    expect(value).toMatchObject({ concurrencyLimit: 0, chatMaxOutputTokens: 0 });
  });

  it("换了地址而模型有规格：必须选保留还是清除", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec });
    const draft = { ...draftOf(original), baseUrl: "https://other.example.com/v1" };
    expect(supplierChanged(original, draft)).toBe(true);
    const undecided = planEndpointUpdate(original, draft, null);
    expect(undecided.value).toBeNull();
    expect(undecided.problems[0].tab).toBe("basic");
    expect(planEndpointUpdate(original, draft, "keep").value?.imageRequestSpec).toEqual(liveImageSpec);
    expect(planEndpointUpdate(original, draft, "clear").value).not.toHaveProperty("imageRequestSpec");
  });

  it("清空规格文本才算清除规格", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec });
    expect(planEndpointUpdate(original, { ...draftOf(original), imageSpecText: "  " }, null).value).toMatchObject({ clearImageRequestSpec: true });
  });

  it("规格不是合法 JSON 就不保存", () => {
    const original = endpoint({ imageRequestSpec: liveImageSpec });
    const { value, problems } = planEndpointUpdate(original, { ...draftOf(original), imageSpecText: "{不是 JSON" }, null);
    expect(value).toBeNull();
    expect(problems[0].tab).toBe("capability");
  });

  it("密钥留空不改，填了才发", () => {
    const original = endpoint();
    expect(planEndpointUpdate(original, { ...draftOf(original), name: "x" }, null).value).not.toHaveProperty("apiKey");
    expect(planEndpointUpdate(original, { ...draftOf(original), apiKey: " sk-new " }, null).value?.apiKey).toBe("sk-new");
  });

  it("没改过的能力开关不发，避免把「未声明」写成「已声明」", () => {
    const original = endpoint();
    const { value } = planEndpointUpdate(original, { ...draftOf(original), name: "x" }, null);
    for (const key of ["chatSupportsTemperature", "chatSupportsTopP", "chatSupportsResponseFormat", "chatSupportsTools", "chatSupportsStreaming"])
      expect(value).not.toHaveProperty(key);
  });
});

describe("新增模型", () => {
  it("默认停用，密钥必填", () => {
    expect(blankDraft().enabled).toBe(false);
    const { value, problems } = planEndpointCreate({ ...blankDraft(), name: "新模型", baseUrl: "https://a.example.com" });
    expect(value).toBeNull();
    expect(problems.map((item) => item.tab)).toEqual(["basic"]);
  });

  it("带规格时原样提交", () => {
    const { value } = planEndpointCreate({ ...blankDraft(), name: "新模型", baseUrl: "https://a.example.com", apiKey: "k", imageSpecText: JSON.stringify(liveImageSpec) });
    expect(value?.imageRequestSpec).toEqual(liveImageSpec);
    expect(value?.enabled).toBe(false);
  });
});

describe("供应商成本", () => {
  it("没改不发；改了三项一起发，单位是微元", () => {
    const original = endpoint({ supplierBillingMode: "PER_SECOND", unitPriceMicros: 501975 });
    const draft = draftOf(original);
    expect(draft.unitPriceYuan).toBe("0.501975");
    expect(planCosts(original, draft).value).toBeNull();
    expect(planCosts(original, { ...draft, unitPriceYuan: "0.6" }).value).toEqual({
      supplierBillingMode: "PER_SECOND", promptTokenPriceMicros: 0, completionTokenPriceMicros: 0, unitPriceMicros: 600000,
    });
  });
});

describe("服务商分组", () => {
  it("同一主机算一组，端口不同也算", () => {
    const groups = providerGroups([
      endpoint({ id: "a", baseUrl: "https://api.jusuanhub.com/v1" }),
      endpoint({ id: "b", baseUrl: "https://api.jusuanhub.com:10443/v1", enabled: false }),
      endpoint({ id: "c", baseUrl: "https://api.unknown-vendor.com/v1" }),
    ]);
    expect(groups[0]).toMatchObject({ host: "api.jusuanhub.com", name: "聚算", total: 2, enabled: 1 });
    expect(groups[1].name).toBe("api.unknown-vendor.com");
  });

  it("地址写错也不会让页面出错", () => {
    expect(providerGroups([endpoint({ baseUrl: "not a url" })])[0].name).toBe("地址无效");
  });
});

describe("类型和摘要", () => {
  it("运营标过的类型优先，没标才看规格，不猜模型名", () => {
    expect(modelKind(endpoint({ videoRequestSpec: liveVideoSpec }), { categories: ["text"], scope: "all", appCodes: [] })).toBe("text");
    expect(modelKind(endpoint({ videoRequestSpec: liveVideoSpec }), { categories: ["unclassified"], scope: "all", appCodes: [] })).toBe("video");
    expect(modelKind(endpoint({ model: "gpt-image-2" }))).toBe("unclassified");
  });

  it("规格缺字段时少显示一项，不报错", () => {
    expect(imageSpecSummary(liveImageSpec)).toEqual(["1 种尺寸", "最多 14 张参考图"]);
    expect(videoSpecSummary(liveVideoSpec)).toEqual(["1 种模式", "4–15 秒", "720p"]);
    expect(videoSpecSummary({ adapter: "x", contract: "坏数据" })).toEqual([]);
    expect(imageSpecSummary({ outputs: "坏数据" })).toEqual([]);
  });
});

describe("模型用在哪", () => {
  it("共享功能看候选，IP Studio 剧本和图片看场景配置", () => {
    const uses = modelUses([
      { appCode: "drama", feature: "cast", name: "角色提取", routingKind: "shared_purpose", candidates: [{ endpointId: "a", enabled: true, isDefault: true }, { endpointId: "off", enabled: false, isDefault: false }] },
      { appCode: "studio", feature: "image", name: "图片生成", routingKind: "scene_policy", candidates: [{ endpointId: "ignored", enabled: true, isDefault: true }] },
    ] as never, [{ scene: "image", policy: { defaultEndpointId: "b", candidates: [{ endpointId: "b" }, { endpointId: "c" }] } }] as never);
    expect(uses.get("a")?.[0]).toMatchObject({ key: "drama.cast", isDefault: true });
    expect(uses.get("b")?.[0].isDefault).toBe(true);
    expect(uses.get("c")?.[0].isDefault).toBe(false);
    expect(uses.has("off")).toBe(false);
    expect(uses.has("ignored")).toBe(false);
  });
});

describe("sameJson", () => {
  it("键顺序不算差别，值和数组顺序算", () => {
    expect(sameJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameJson({ a: null }, {})).toBe(false);
  });
});

describe("保存前的改动清单", () => {
  const name = (id: string) => id.toUpperCase();
  it("列出默认模型、价格、增减", () => {
    const before = { mode: "selectable", defaultEndpointId: "a", candidates: [{ endpointId: "a", creditCost: 16 }, { endpointId: "b", creditCost: 8 }] };
    const after = { mode: "selectable", defaultEndpointId: "c", candidates: [{ endpointId: "a", creditCost: 20 }, { endpointId: "c", creditCost: 0 }] };
    expect(scenePolicyChanges(before, after, name, "张")).toEqual([
      "默认模型改为「C」",
      "「A」的价格从 16 改为 20 积分 / 张",
      "添加「C」，0 积分 / 张",
      "从列表移除「B」，模型本身不删除",
    ]);
  });
});
