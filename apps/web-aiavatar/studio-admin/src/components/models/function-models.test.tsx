import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelFunctionRow } from "@ai-star-eco/types/ai-model-config";
import { FunctionModels } from "./function-models";
import { StudioModels } from "./studio-models";
import type { ModelConfigData } from "./shared";

const command = vi.fn();
vi.mock("@/lib/api", () => ({ ModelConfigApi: { command: (...args: unknown[]) => command(...args) } }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const base = { priceKey: "", priceSemantics: "explicit_zero", priceAffectedFeatures: [] as string[] };
const cast: ModelFunctionRow = {
  ...base, appCode: "drama", feature: "cast", name: "角色提取", purpose: "DRAMA_SCRIPT_DRAFT", routingKind: "shared_purpose", pricingKind: "config", billingUnit: "per_call",
  affectedFeatures: ["drama.cast", "drama.recipe"], binding: { endpointId: "a", endpointName: "模型 A" }, status: "configured",
  candidates: [
    { purpose: "DRAMA_SCRIPT_DRAFT", purposeLabel: "", endpointId: "a", endpointName: "模型 A", endpointEnabled: true, isDefault: true, sortOrder: 0, enabled: true },
    { purpose: "DRAMA_SCRIPT_DRAFT", purposeLabel: "", endpointId: "b", endpointName: "模型 B", endpointEnabled: true, isDefault: false, sortOrder: 1, enabled: true },
  ],
};
const recipe: ModelFunctionRow = { ...cast, feature: "recipe", name: "创作配方", pricingKind: "none" };
const video: ModelFunctionRow = {
  ...base, appCode: "studio", feature: "video", name: "视频生成", purpose: "VIDEO_GENERATION", routingKind: "video_group", pricingKind: "video_matrix", billingUnit: "matrix",
  affectedFeatures: ["studio.video", "drama.cast"], binding: null, status: "configured",
  candidates: [
    { purpose: "VIDEO_GENERATION", purposeLabel: "", endpointId: "h3", endpointName: "H3", endpointEnabled: true, isDefault: true, sortOrder: 0, enabled: true, creditCostOverride: 62, available: true },
    { purpose: "VIDEO_GENERATION", purposeLabel: "", endpointId: "sd", endpointName: "Seedance", endpointEnabled: true, isDefault: false, sortOrder: 1, enabled: true, available: true },
  ],
};
const endpoint = (id: string, name: string) => ({ id, name, providerType: "OPENAI_COMPATIBLE", baseUrl: "https://x.example.com", model: id, enabled: true, promptTokenPriceMicros: 0, completionTokenPriceMicros: 0, unitPriceMicros: 0, totalTokens: 0, totalBillableUnits: 0, totalBillableSeconds: 0, totalCalls: 0, createdAt: "", updatedAt: "" });

const data: ModelConfigData = {
  endpoints: [endpoint("a", "模型 A"), endpoint("b", "模型 B"), endpoint("c", "模型 C"), endpoint("h3", "H3"), endpoint("sd", "Seedance")],
  access: [], presets: [], functions: [cast, recipe, video],
  pricing: [
    { ...cast, pricing: { appCode: "drama", feature: "cast", pricingKind: "config", priceSemantics: "explicit_zero", billingUnit: "per_call", value: 6, fallback: 6 } },
    { ...recipe, pricing: { appCode: "drama", feature: "recipe", pricingKind: "none", priceSemantics: "not_billed", billingUnit: "per_call" } },
    { ...video, priceAffectedFeatures: ["studio.video"], pricing: { appCode: "studio", feature: "video", pricingKind: "video_matrix", priceSemantics: "explicit_zero", billingUnit: "matrix", value: { perSecond: { t2v: { "768p": 62, "720p": null } }, freeRefImages: 0 }, videoDimensions: { modes: [{ mode: "t2v", label: "文生视频" }], tiers: ["720p"] } } },
  ],
  scenes: [{
    appCode: "studio", scene: "image", purpose: "DAP_IMAGE", billingUnit: "per_image", status: "available",
    policy: { appCode: "studio", scene: "image", mode: "selectable", defaultEndpointId: "a", candidates: [{ endpointId: "a", creditCost: 16, billingUnit: "per_image" }] },
    candidates: [{ purpose: "DAP_IMAGE", purposeLabel: "", endpointId: "a", isDefault: true, sortOrder: 0, enabled: true }], endpoints: [endpoint("a", "模型 A"), endpoint("b", "模型 B")],
  }],
  videoGroup: { defaultEndpointId: "h3", endpointIds: ["h3", "sd"] }, directorDefault: "a",
};

describe("功能与售价", () => {
  beforeEach(() => { command.mockReset().mockResolvedValue({}); });
  afterEach(() => cleanup());

  it("列表显示默认模型和售价", () => {
    render(<FunctionModels data={data} reload={vi.fn()} />);
    const row = screen.getByText("角色提取").closest("tr") as HTMLElement;
    expect(within(row).getByText("模型 A")).toBeTruthy();
    expect(within(row).getByText("6 积分 / 次")).toBeTruthy();
    expect(within(screen.getByText("创作配方").closest("tr") as HTMLElement).getByText("不收费")).toBeTruthy();
  });

  it("改共用配置的售价前列出影响范围", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const withPriceImpact = { ...data, pricing: data.pricing.map((row) => row.feature === "cast" ? { ...row, priceAffectedFeatures: ["drama.cast", "drama.recipe"] } : row) };
    render(<FunctionModels data={withPriceImpact} reload={reload} />);
    fireEvent.click(within(screen.getByText("角色提取").closest("tr") as HTMLElement).getByRole("button", { name: "配置" }));
    fireEvent.change(await screen.findByLabelText("角色提取 的积分价"), { target: { value: "9" } });
    const section = screen.getByLabelText("角色提取 的积分价").closest("div") as HTMLElement;
    fireEvent.click(within(section).getByRole("button", { name: "保存" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/创作配方/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认修改" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("functionConfigPriceSave", { appCode: "drama", feature: "cast", creditPrice: 9 }));
  });

  it("视频价格表按原样保存所有格子，包括现在模型不支持的清晰度", async () => {
    render(<FunctionModels data={data} reload={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(within(screen.getByText("视频生成").closest("tr") as HTMLElement).getByRole("button", { name: "配置" }));
    fireEvent.change(await screen.findByLabelText("文生视频 720p 每秒积分"), { target: { value: "40" } });
    fireEvent.click(screen.getAllByRole("button", { name: "保存" }).at(-1) as HTMLElement);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认修改" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("videoPricesSave", { value: { perSecond: { t2v: { "768p": 62, "720p": 40 } }, freeRefImages: 0 } }));
  });
});

describe("IP Studio 模型", () => {
  beforeEach(() => { command.mockReset().mockResolvedValue({}); });
  afterEach(() => cleanup());

  it("新加的模型先准备候选再保存场景配置", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const uncandidate = { ...data, scenes: data.scenes.map((scene) => ({ ...scene, candidates: scene.candidates })) };
    render(<StudioModels data={uncandidate} reload={reload} />);
    const price = screen.getByLabelText("模型 A 的积分价");
    fireEvent.change(price, { target: { value: "20" } });
    const card = price.closest("[data-slot=card]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "保存" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("「模型 A」的价格从 16 改为 20 积分 / 张")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认保存" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("scenePolicySave", { value: expect.objectContaining({ defaultEndpointId: "a", candidates: [{ endpointId: "a", creditCost: 20, billingUnit: "per_image" }] }) }));
    expect(command).not.toHaveBeenCalledWith("sceneCandidatePrepare", expect.anything());
  });

  it("新加的模型价格留空，不默认成免费，填了才能保存", async () => {
    render(<StudioModels data={data} reload={vi.fn().mockResolvedValue(undefined)} />);
    const known = screen.getByLabelText("模型 A 的积分价");
    fireEvent.change(known, { target: { value: "" } });
    const card = known.closest("[data-slot=card]") as HTMLElement;
    expect((within(card).getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card).getByText(/请填写「模型 A」的积分价/)).toBeTruthy();
    fireEvent.change(known, { target: { value: "0" } });
    expect((within(card).getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("改视频每秒价前列出影响范围，并带上确认的功能", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<StudioModels data={data} reload={reload} />);
    const price = screen.getByLabelText("H3 的每秒积分");
    fireEvent.change(price, { target: { value: "70" } });
    const card = price.closest("[data-slot=card]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "保存" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认保存" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("functionCandidatePriceSave", { appCode: "studio", feature: "video", endpointId: "h3", creditCostOverride: 70, acknowledgedAffectedFeatures: ["studio.video", "drama.cast"] }));
    expect(command).not.toHaveBeenCalledWith("studioVideoGroupSave", expect.anything());
  });

  it("换默认视频模型时保留分组里的其他模型", async () => {
    render(<StudioModels data={data} reload={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole("radio", { name: "把 Seedance 设为默认" }));
    const card = screen.getByRole("radio", { name: "把 Seedance 设为默认" }).closest("[data-slot=card]") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "保存" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "确认保存" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("studioVideoGroupSave", { value: { defaultEndpointId: "sd", endpointIds: ["h3", "sd"] } }));
  });
});
