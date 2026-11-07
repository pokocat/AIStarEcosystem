import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelEndpoint } from "@ai-star-eco/types/ai-model-config";
import { ModelAccess } from "./model-access";
import type { ModelConfigData } from "./shared";

const command = vi.fn();
vi.mock("@/lib/api", () => ({ ModelConfigApi: { command: (...args: unknown[]) => command(...args) } }));

// 字段形状照线上 endpoints 命令的真实返回。
const liveImageSpec = {
  promptMaxChars: 16000, minReferenceImages: 0, maxReferenceImages: 14, referenceField: "multiple",
  outputs: [{ canvasSize: "2048x2048", aspectRatio: "1:1", providerFields: { size: "2048x2048" } }],
  wire: { submitPath: "/images/generations", modelQueryParam: "", requireExactOutputSize: true },
};

function endpoint(partial: Partial<AiModelEndpoint>): AiModelEndpoint {
  return {
    id: "m", name: "模型", providerType: "OPENAI_COMPATIBLE", baseUrl: "https://api.jusuanhub.com/v1", model: "m", enabled: true, upstreamApiKeyMasked: "sk-***",
    promptTokenPriceMicros: 0, completionTokenPriceMicros: 0, unitPriceMicros: 0, totalTokens: 0, totalBillableUnits: 0, totalBillableSeconds: 0, totalCalls: 0,
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...partial,
  };
}

const data: ModelConfigData = {
  endpoints: [
    endpoint({ id: "seedream", name: "Doubao-Seedream-4.5", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seedream", imageRequestSpec: liveImageSpec, rpmLimit: 60 }),
    endpoint({ id: "h3", name: "MiniMax H3", model: "minimax-h3", supplierBillingMode: "PER_SECOND", unitPriceMicros: 500000 }),
    endpoint({ id: "agnes", name: "Agnes 文本", baseUrl: "https://api.agnes-ai.cn/v1", model: "agnes", enabled: false }),
  ],
  access: [{ endpointId: "seedream", name: "Doubao-Seedream-4.5", policy: { categories: ["image"], scope: "selected", appCodes: ["studio"] } }],
  presets: [],
  functions: [{
    appCode: "drama", feature: "cast", name: "角色提取", purpose: "DRAMA_SCRIPT_DRAFT", routingKind: "shared_purpose", pricingKind: "config", priceKey: "", billingUnit: "per_call", priceSemantics: "",
    affectedFeatures: ["drama.cast"], priceAffectedFeatures: [], binding: { endpointId: "h3" }, status: "configured",
    candidates: [{ purpose: "DRAMA_SCRIPT_DRAFT", purposeLabel: "", endpointId: "h3", isDefault: true, sortOrder: 0, enabled: true }],
  }],
  pricing: [], scenes: [], videoGroup: null, directorDefault: null,
};

describe("模型接入页", () => {
  beforeEach(() => { command.mockReset().mockResolvedValue({}); });
  afterEach(() => cleanup());

  it("按服务商分组，选一组只看这组的模型", () => {
    render(<ModelAccess data={data} reload={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "全部模型" })).toBeTruthy();
    expect(screen.getByText("MiniMax H3")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("navigation", { name: "按服务商筛选" })).getByText("火山方舟"));
    expect(screen.getByRole("heading", { name: "火山方舟" })).toBeTruthy();
    expect(screen.queryByText("MiniMax H3")).toBeNull();
    expect(screen.getByText("Doubao-Seedream-4.5")).toBeTruthy();
  });

  it("规格里有页面不认识的字段也能显示，并且给出摘要", () => {
    render(<ModelAccess data={data} reload={vi.fn()} />);
    expect(screen.getByText("1 种尺寸 · 最多 14 张参考图")).toBeTruthy();
    expect(screen.getByText("IP Studio")).toBeTruthy();
    expect(screen.getByText("¥0.5 / 秒")).toBeTruthy();
    expect(screen.getByText("1 个功能，1 个默认")).toBeTruthy();
  });

  it("停用默认模型前说明影响，确认后才保存，并带上限额", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<ModelAccess data={{ ...data, endpoints: data.endpoints.map((item) => item.id === "h3" ? { ...item, rpmLimit: 30 } : item) }} reload={reload} />);
    fireEvent.click(screen.getByRole("switch", { name: "停用 MiniMax H3" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/角色提取/)).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "停用" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("endpointSave", { id: "h3", value: expect.objectContaining({ enabled: false, rpmLimit: 30 }) }));
    const sent = command.mock.calls[0][1] as { value: Record<string, unknown> };
    expect(sent.value).not.toHaveProperty("imageRequestSpec");
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("只改名字保存时不发规格", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<ModelAccess data={data} reload={reload} />);
    const row = screen.getByText("Doubao-Seedream-4.5").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "编辑" }));
    const name = await screen.findByDisplayValue("Doubao-Seedream-4.5");
    fireEvent.change(name, { target: { value: "火山 Seedream" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    const [action, body] = command.mock.calls[0] as [string, { id: string; value: Record<string, unknown> }];
    expect(action).toBe("endpointSave");
    expect(body.id).toBe("seedream");
    expect(body.value).toMatchObject({ name: "火山 Seedream", rpmLimit: 60 });
    expect(body.value).not.toHaveProperty("imageRequestSpec");
    expect(body.value).not.toHaveProperty("clearImageRequestSpec");
  });

  it("测试失败时写明原因", async () => {
    command.mockResolvedValue({ ok: false, error: "上游密钥未通过验证，请核对密钥" });
    render(<ModelAccess data={data} reload={vi.fn()} />);
    const row = screen.getByText("MiniMax H3").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "测试连接" }));
    expect(await screen.findByText(/连接失败：上游密钥未通过验证/)).toBeTruthy();
    expect(command).toHaveBeenCalledWith("endpointTest", { id: "h3" });
  });
});
