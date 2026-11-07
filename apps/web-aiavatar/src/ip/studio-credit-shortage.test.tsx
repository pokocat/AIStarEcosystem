// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ModelBillingTarget, ScopedCreditGrant } from "@ai-star-eco/types/model-billing";
import { grantSummaries, shortageCandidates, shortageSuggestions, shortageSummary, StudioCreditShortageDialog, verifyShortageSuggestions } from "./studio-credit-shortage";
import { isStudioCreditShortage, studioCreditShortageChoice } from "@/canvas-bridge/studio-billing-cancel";

const api = vi.hoisted(() => ({ balance: vi.fn(), myBalance: vi.fn(), grants: vi.fn(), account: vi.fn(), loadAccount: vi.fn(), known: vi.fn() }));
vi.mock("@ai-star-eco/api-client", () => ({ apiFetch: api.account, ModelBillingApi: { myGrants: api.grants } }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: api.balance } }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: { myBalance: api.myBalance } }));
vi.mock("@/canvas-bridge/studio-billing-preference", () => ({ loadStudioBillingAccount: api.loadAccount, knownStudioBilling: api.known }));
vi.mock("@/shell/antd-theme", () => ({ AntdTheme: ({ children }: any) => children }));
vi.mock("antd", () => ({
  Modal: ({ children, title, footer, onCancel }: any) => <section role="dialog" aria-label={title}>{children}{footer}<button onClick={onCancel}>关闭</button></section>,
  Button: ({ children, href, target, rel, type, size: _size, loading: _loading, ...props }: any) => href ? <a href={href} target={target} rel={rel} data-kind={type} {...props}>{children}</a> : <button data-kind={type} {...props}>{children}</button>,
  Alert: ({ title }: any) => <div role="alert">{title}</div>,
  Skeleton: () => <span>正在加载</span>,
}));

const target = (endpointId: string): ModelBillingTarget => ({ appCode: "endpoint", action: "model", endpointId, providerModel: "m", specKey: "*", unit: "call" });
const grant = (over: Partial<ScopedCreditGrant> & { endpointId: string }): ScopedCreditGrant => ({
  id: over.endpointId, walletId: "w", campaignId: "c", campaignName: "活动", targetLabels: [over.endpointId], campaignActive: true, targets: [target(over.endpointId)],
  amount: 500, available: 500, frozen: 0, spent: 0, expired: 0, expiresAt: "2099-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z", ...over });
const quote = { walletCredits: 640, scopedCredits: 0, target: { ...target("h3"), action: "video", unit: "second" as const } };
const choices = [{ endpointId: "h3", name: "MiniMax H3", cost: 640 }, { endpointId: "seed", name: "Seedream 4.5", cost: 40 }, { endpointId: "agnes", name: "Agnes", cost: 8 }, { endpointId: "dear", name: "贵模型", cost: 900 }];

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { api.loadAccount.mockReset(); api.known.mockReset(); api.account.mockReset().mockResolvedValue({}); api.balance.mockReset().mockResolvedValue({ totalBalance: 0 }); api.myBalance.mockReset(); api.grants.mockReset().mockResolvedValue({ data: [] }); });
afterEach(cleanup);

test("only suggests models that can finish this request, grant-covered first, never the current one", () => {
  const rows = shortageSuggestions(choices, [grant({ endpointId: "seed" }), grant({ endpointId: "dear", available: 100 })], "h3", 10);
  expect(rows.map(r => r.endpointId)).toEqual(["seed", "agnes"]);
  expect(rows[0]).toMatchObject({ grant: 500, cost: 40, covered: true });
  expect(rows[1]).toMatchObject({ grant: 0, cost: 8, covered: false });
  // 贵模型：赠款 100 + 余额 10 不够 900，不列。Agnes：没有赠款，但余额够。
});

test("ignores paused, expired and empty grants, and matches a family member through its older ids", () => {
  const dead = [grant({ endpointId: "seed", campaignActive: false }), grant({ endpointId: "seed", expiresAt: "2020-01-01T00:00:00Z" }), grant({ endpointId: "seed", available: 0 })];
  expect(shortageSuggestions([{ endpointId: "seed", name: "S", cost: 40 }], dead, undefined, 0)).toEqual([]);
  expect(shortageSuggestions([{ endpointId: "family", name: "S", legacyEndpointIds: ["seed-2k"] }], [grant({ endpointId: "seed-2k" })], undefined, 0)).toEqual([{ endpointId: "family", name: "S", grant: 500, covered: false }]);
  // 算不出标准价、又没有赠款：不知道够不够，不建议。
  expect(shortageSuggestions([{ endpointId: "x", name: "X", cost: null }], [], undefined, 9999)).toEqual([]);
});

test("with no grant at all only a model the balance can pay for is suggested; nothing else asks to switch", () => {
  const all = [{ endpointId: "a", name: "A", cost: 40 }, { endpointId: "b", name: "B", cost: 8 }, { endpointId: "c", name: "C", cost: null }];
  // 没有赠款、余额也不够任何模型：不建议切换，只剩充值和返回修改。
  expect(shortageSuggestions(all, [], undefined, 0)).toEqual([]);
  expect(shortageSuggestions(all, [grant({ endpointId: "a", available: 0 })], undefined, 0)).toEqual([]);
  // 赠款只在当前模型上：换别的也用不上。
  expect(shortageSuggestions(all, [grant({ endpointId: "a" })], "a", 0)).toEqual([]);
  // 余额够便宜的模型：列出来，但不算赠款抵扣。
  expect(shortageSuggestions(all, [], undefined, 10)).toEqual([{ endpointId: "b", name: "B", grant: 0, cost: 8, covered: false }]);
});

test("a model with no configured price is never suggested, with or without a grant", () => {
  const unpriced = [{ endpointId: "free", name: "没配价", cost: 0 }];
  expect(shortageSuggestions(unpriced, [], undefined, 0)).toEqual([]);
  expect(shortageSuggestions(unpriced, [grant({ endpointId: "free" })], undefined, 100)).toEqual([]);
});

test("no grant and no balance leaves only recharge and return to edit", async () => {
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: choices, canRetry: true }} onChoice={vi.fn()}/>);
  await screen.findByRole("link", { name: "充值" });
  expect(screen.queryByText("可改用的模型")).toBeNull();
  expect(screen.queryByRole("button", { name: /^改用/ })).toBeNull();
  expect(screen.getByRole("link", { name: "充值" }).dataset.kind).toBe("primary");
  expect(screen.getByRole("button", { name: "返回修改" })).toBeTruthy();
});

test("grant summary skips retired models", () => {
  expect(grantSummaries([grant({ endpointId: "a", targetLabels: ["已下线模型"] }), grant({ endpointId: "b", targetLabels: ["Seedream 4.5"], available: 300 })])).toEqual([{ label: "Seedream 4.5", available: 300 }]);
});

test("says how much is missing from the quote, or from the server's own sentence", () => {
  expect(shortageSummary({ quote }, 100)).toEqual({ text: "本次需付 640 积分，当前可用 100 积分，还差 540 积分。", enough: false });
  expect(shortageSummary({ quote: { ...quote, scopedCredits: 60 } }, 0).text).toBe("模型赠款抵扣 60 积分后，本次还需付 640 积分，当前可用 0 积分，还差 640 积分。");
  // 服务端原话里的数可能是文字任务的冻结额，不是价格：写「需要」不写「需付」。
  expect(shortageSummary({ reason: "积分余额不足，本次操作需 320，当前可用 16 · 追查号 ABCDEF234567" }, undefined).text).toBe("本次需要 320 积分，当前可用 16 积分，还差 304 积分。");
  expect(shortageSummary({ quote }, 0, 0, "MiniMax H3").text).toBe("「MiniMax H3」本次需付 640 积分，当前可用 0 积分，还差 640 积分。");
  // 服务端没说要多少：余额涨了才算可以再试，没涨还是不足。
  expect(shortageSummary({ reason: "普通积分不足" }, 1000, 0)).toEqual({ text: "当前可用 1,000 积分，可以重新生成。", enough: true, updated: true });
  expect(shortageSummary({ reason: "普通积分不足" }, 5, 5).enough).toBe(false);
  // 服务端只说「不足」没说多少：写当前余额，不转述「减少生成数量」（写脚本没有数量）。
  expect(shortageSummary({ reason: "普通积分不足，请充值或减少生成数量 · 追查号 ABCDEF234567" }, 0)).toEqual({ text: "当前可用 0 积分，不足以完成本次生成。", enough: false });
  expect(shortageSummary({ quote }, undefined).text).toBe("本次需付 640 积分，当前付款账户的积分不足。");
  expect(shortageSummary({}, undefined).text).toBe("当前付款账户的积分不足。");
});

test("recognises only generation shortages", () => {
  expect(isStudioCreditShortage({ code: "MODEL_CREDITS_INSUFFICIENT", message: "x" })).toBe(true);
  expect(isStudioCreditShortage({ code: "PAYMENT_REQUIRED", message: "积分余额不足，本次操作需 3，当前可用 1" })).toBe(true);
  // 「只用模型赠款」不足：余额再多也不放行，充值解决不了，不走这个框。
  expect(isStudioCreditShortage({ code: "SCOPED_CREDITS_INSUFFICIENT", message: "模型赠款不够，你选了只用模型赠款" })).toBe(false);
  for (const other of [{ code: "PAYMENT_REQUIRED", message: "可用企业积分不足，冻结积分不可回收" }, { code: "PAYMENT_REQUIRED", message: "余额不足，本次提现需 3，当前可用 1" }, { code: "STORAGE_QUOTA_EXCEEDED", message: "x" }, { code: "STUDIO_PLAN_BUDGET_EXCEEDED", message: "x" }, { code: "CLIP_ENGINE_BALANCE_INSUFFICIENT", message: "x" }, null, "积分余额不足"])
    expect(isStudioCreditShortage(other)).toBe(false);
  expect(studioCreditShortageChoice({ code: "OTHER", creditShortage: { kind: "close" } })).toBeUndefined();
  expect(studioCreditShortageChoice({ code: "STUDIO_BILLING_CANCELLED", creditShortage: { kind: "retry" } })).toEqual({ kind: "retry" });
});

test("switching model hands the choice back without generating anything itself", async () => {
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "seed" })] });
  const onChoice = vi.fn();
  // 服务端逐个回答：只有 Seedream 付得起。
  const verifyChoice = vi.fn(async (id: string) => (id === "seed" ? { canAfford: true, scopedCredits: 40, walletCredits: 0 } : { canAfford: false, scopedCredits: 0, walletCredits: 8 })) as never;
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: choices, canRetry: true, verifyChoice }} onChoice={onChoice}/>);
  await screen.findByText("「MiniMax H3」本次需付 640 积分，当前可用 0 积分，还差 640 积分。本次未扣积分。");
  expect(screen.getByRole("dialog", { name: "积分不足" })).toBeTruthy();
  expect(screen.getByText("模型赠款抵扣 40 积分，无需支付积分")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "改用MiniMax H3" })).toBeNull();
  // 服务端确认不用付钱：主按钮是改用，不是花钱的充值；服务端说付不起的不列。
  expect(screen.queryByRole("button", { name: "改用Agnes" })).toBeNull();
  expect(screen.getByRole("button", { name: "改用Seedream 4.5" }).dataset.kind).toBe("primary");
  expect(screen.getByRole("link", { name: "充值" }).dataset.kind).toBe("default");
  fireEvent.click(screen.getByRole("button", { name: "改用Seedream 4.5" }));
  expect(onChoice).toHaveBeenCalledWith({ kind: "switch-model", endpointId: "seed", name: "Seedream 4.5" });
});

test("a family's grants are never promised on an estimate: the server's quote for this size decides", async () => {
  // 系列模型：1K 接入点有 100 赠款，这次要出的 4K 没有。前端只看得到合计。
  const family = [{ endpointId: "family:img", name: "图片系列", legacyEndpointIds: ["img-1k", "img-4k"], cost: 60, quotePatch: { size: "3840x2160" } }];
  const rows = shortageSuggestions(family, [grant({ endpointId: "img-1k", available: 100 })], "other", 0);
  expect(rows[0].covered).toBe(true);
  const verify = vi.fn().mockResolvedValue({ canAfford: false, scopedCredits: 0, walletCredits: 60 });
  await expect(verifyShortageSuggestions(rows, verify, 0)).resolves.toEqual([]);
  expect(verify).toHaveBeenCalledWith("family:img", { size: "3840x2160" });
  // 报不出价（网络、规格不合）：留着，但不下结论，也不做主按钮。
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "img-1k", available: 100 })] });
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: family, verifyChoice: vi.fn().mockRejectedValue(new Error("网络中断")) }} onChoice={vi.fn()}/>);
  const button = await screen.findByRole("button", { name: "改用图片系列" });
  expect(button.dataset.kind).toBe("default");
  expect(screen.getByText("模型赠款 100 积分 · 标准价格 60 积分")).toBeTruthy();
  expect(screen.getByRole("link", { name: "充值" }).dataset.kind).toBe("primary");
});

test("a setting change is not quoted as if nothing changed, and a paid model says what it costs", async () => {
  const rows = [{ endpointId: "a", name: "A", grant: 0, cost: 8, covered: false }, { endpointId: "b", name: "B", grant: 100, cost: 40, covered: true, changes: "比例将改为 1:1" }];
  const verify = vi.fn().mockResolvedValue({ canAfford: true, scopedCredits: 3, walletCredits: 5 });
  const out = await verifyShortageSuggestions(rows, verify, 0);
  expect(verify).toHaveBeenCalledTimes(1);
  expect(out.find(r => r.endpointId === "a")?.quoted).toEqual({ scopedCredits: 3, walletCredits: 5 });
  expect(out.find(r => r.endpointId === "b")?.quoted).toBeUndefined();
});

test("a discount the list price cannot see still gets asked about, and truncation happens after the server answers", async () => {
  // 标准价 100、折后 50、赠款 50、余额 0：按标准价估计不够，服务端说可以全抵。
  const discounted = [{ endpointId: "d", name: "折扣模型", cost: 100 }];
  const grants = [grant({ endpointId: "d", available: 50 })];
  expect(shortageSuggestions(discounted, grants, undefined, 0)).toEqual([]);
  const free = await verifyShortageSuggestions(shortageCandidates(discounted, grants, undefined), vi.fn().mockResolvedValue({ canAfford: true, scopedCredits: 50, walletCredits: 0 }), 0);
  expect(free[0].quoted).toEqual({ scopedCredits: 50, walletCredits: 0 });
  // 前四个都付不起，不能遮掉后面付得起的。
  const many = ["a", "b", "c", "d", "e"].map(id => ({ endpointId: id, name: id, cost: 10 }));
  const out = await verifyShortageSuggestions(shortageCandidates(many, [], undefined), vi.fn(async (id: string) => ({ canAfford: id === "e", scopedCredits: 0, walletCredits: 1 })) as never, 0);
  expect(out.map(r => r.endpointId)).toEqual(["e"]);
  // 候选再多，一次也只问这么多个。
  const verify = vi.fn().mockResolvedValue({ canAfford: false, scopedCredits: 0, walletCredits: 1 });
  await verifyShortageSuggestions(shortageCandidates(Array.from({ length: 20 }, (_, i) => ({ endpointId: `m${i}`, name: `m${i}`, cost: 1 })), [], undefined), verify, 0);
  expect(verify).toHaveBeenCalledTimes(8);
});

test("a video whose prompt optimisation is charged separately is never called free, and does not take the primary button", async () => {
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "h3" })] });
  const verifyChoice = vi.fn().mockResolvedValue({ canAfford: true, scopedCredits: 40, walletCredits: 0 });
  render(<StudioCreditShortageDialog input={{ quote: { ...quote, target: { ...quote.target, endpointId: "other" } }, verifyChoice,
    modelChoices: [{ endpointId: "h3", name: "H3", cost: 40, extraCharge: "优化提示词按实际用量另计" }] }} onChoice={vi.fn()}/>);
  const button = await screen.findByRole("button", { name: "改用H3" });
  expect(screen.getByText("模型赠款抵扣 40 积分，优化提示词按实际用量另计")).toBeTruthy();
  expect(screen.queryByText(/无需支付积分/)).toBeNull();
  expect(button.dataset.kind).toBe("default");
  expect(screen.getByRole("link", { name: "充值" }).dataset.kind).toBe("primary");
});

test("overlapping refreshes collect the monthly grant once and keep the balance from before it", async () => {
  // 领之前 0，领之后 1500；focus 和 visibilitychange 紧跟着初次加载一起来。
  api.account.mockImplementation(async () => { api.balance.mockResolvedValue({ totalBalance: 1500 }); return {}; });
  render(<StudioCreditShortageDialog input={{ reason: "普通积分不足，请充值或减少生成数量", canRetry: true }} onChoice={vi.fn()}/>);
  await act(async () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  await screen.findByRole("dialog", { name: "余额已更新" });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(api.account).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("dialog", { name: "余额已更新" })).toBeTruthy();
});

test("recharge opens in a new tab; coming back with enough credits offers to carry on", async () => {
  const onChoice = vi.fn();
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: choices, canRetry: true }} onChoice={onChoice}/>);
  const recharge = await screen.findByRole("link", { name: "充值" });
  expect(recharge.getAttribute("href")).toBe("/studio#/membership");
  expect(recharge.getAttribute("target")).toBe("_blank");
  fireEvent.click(recharge);
  expect(screen.getByText(/充值完成后回到此页/)).toBeTruthy();
  api.balance.mockResolvedValue({ totalBalance: 1000 });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  fireEvent.click(await screen.findByRole("button", { name: "继续生成" }));
  expect(onChoice).toHaveBeenCalledWith({ kind: "retry" });
  expect(screen.queryByRole("link", { name: "充值" })).toBeNull();
});

test("return to edit closes without generating, and a page that cannot retry never offers it", async () => {
  api.balance.mockResolvedValue({ totalBalance: 1000 });
  const onChoice = vi.fn();
  render(<StudioCreditShortageDialog input={{ quote }} onChoice={onChoice}/>);
  await screen.findByRole("dialog", { name: "积分充足" });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("重新生成"));
  expect(screen.queryByRole("button", { name: "继续生成" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "返回" }));
  expect(onChoice).toHaveBeenCalledWith({ kind: "close" });
});

test("an enterprise payer reads the enterprise wallet and grants and is sent to enterprise credits", async () => {
  api.myBalance.mockResolvedValue({ totalBalance: 5 });
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "seed", targetLabels: ["Seedream 4.5"] })] });
  render(<StudioCreditShortageDialog input={{ quote, billing: { mode: "enterprise", enterpriseId: "e1" }, grantHint: "可在「作品设置」中改用这些模型。" }} onChoice={vi.fn()}/>);
  await screen.findByRole("dialog", { name: "企业积分不足" });
  await screen.findByText("Seedream 4.5");
  expect(api.grants).toHaveBeenCalledWith({ enterpriseId: "e1", size: 100 });
  expect(api.balance).not.toHaveBeenCalled();
  // 月度赠送只进个人账户，企业付款不用去领。
  expect(api.account).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "查看企业积分" }).getAttribute("href")).toBe("/enterprise");
  // 这个入口不能直接换模型：只列出来，说明去哪里换，没有「改用」。
  expect(screen.queryByRole("button", { name: "改用" })).toBeNull();
  expect(screen.getByText("可在「作品设置」中改用这些模型。")).toBeTruthy();
});

test("a text task never lists grants for image and video models", async () => {
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "seed", targetLabels: ["Seedream 4.5"] })] });
  render(<StudioCreditShortageDialog input={{ reason: "普通积分不足，请充值或减少生成数量" }} onChoice={vi.fn()}/>);
  await screen.findByText(/当前可用 0 积分，不足以完成本次生成/);
  expect(screen.queryByText("Seedream 4.5")).toBeNull();
  expect(screen.getByRole("link", { name: "充值" })).toBeTruthy();
});

test("a wallet that cannot be read still shows the dialog and what the server said", async () => {
  api.balance.mockRejectedValue(new Error("网络中断")); api.grants.mockRejectedValue(new Error("网络中断"));
  render(<StudioCreditShortageDialog input={{ reason: "积分余额不足，本次操作需 320，当前可用 16" }} onChoice={vi.fn()}/>);
  await screen.findByText(/本次需要 320 积分，当前可用 16 积分，还差 304 积分/);
  expect(screen.getByRole("link", { name: "充值" })).toBeTruthy();
});

test("this month's grant counts as credits arriving: the real text-task error has no amount, and the user can carry on", async () => {
  // 服务端真实形状：MODEL_CREDITS_INSUFFICIENT 不带金额。领之前余额 0，领到 1500。
  api.account.mockImplementation(async () => { api.balance.mockResolvedValue({ totalBalance: 1500 }); return {}; });
  const onChoice = vi.fn();
  render(<StudioCreditShortageDialog input={{ reason: "普通积分不足，请充值或减少生成数量", canRetry: true }} onChoice={onChoice}/>);
  await screen.findByRole("dialog", { name: "余额已更新" });
  expect(api.account).toHaveBeenCalledWith("/v1/account");
  expect(screen.getByText(/当前可用 1,500 积分，可以重新生成/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "继续生成" }));
  expect(onChoice).toHaveBeenCalledWith({ kind: "retry" });
});

test("an account that cannot be read is not guessed to be personal", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.loadAccount.mockRejectedValue(new Error("超时"));
  render(<StudioCreditShortageDialog input={{ reason: "普通积分不足，请充值或减少生成数量" }} onChoice={vi.fn()}/>);
  await screen.findByRole("link", { name: "查看企业积分" });
  expect(api.balance).not.toHaveBeenCalled();
  expect(api.account).not.toHaveBeenCalled();
  expect(screen.getByText(/当前付款账户的积分不足/)).toBeTruthy();
});

test("a payer chosen once in an enterprise is not guessed: no balance is read and both accounts are offered", async () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.loadAccount.mockResolvedValue({ userId: "u", context: { enterprise: { id: "e1" } } });
  api.known.mockReturnValue(undefined);
  api.balance.mockResolvedValue({ totalBalance: 9999 });
  render(<StudioCreditShortageDialog input={{ reason: "积分余额不足，本次操作需 320，当前可用 16", grantHint: "可在「作品设置」中改用这些模型。" }} onChoice={vi.fn()}/>);
  await screen.findByText(/本次需要 320 积分，当前可用 16 积分，还差 304 积分/);
  expect(api.balance).not.toHaveBeenCalled();
  expect(api.account).not.toHaveBeenCalled();
  expect(api.grants).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "查看企业积分" }).getAttribute("href")).toBe("/enterprise");
  expect(screen.getByRole("link", { name: "充值" })).toBeTruthy();
  expect(screen.getByText(/个人积分和企业积分分开计算/)).toBeTruthy();
});

test("without a grant the recharge stays primary, and a setting change is shown and carried on the choice", async () => {
  const onChoice = vi.fn();
  api.balance.mockResolvedValue({ totalBalance: 50 });
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: [{ endpointId: "seed", name: "Seedream 4.5", cost: 40, changes: "比例将改为 1:1" }] }} onChoice={onChoice}/>);
  const button = await screen.findByRole("button", { name: "改用Seedream 4.5" });
  expect(button.dataset.kind).toBe("default");
  expect(screen.getByRole("link", { name: "充值" }).dataset.kind).toBe("primary");
  expect(screen.getByText("比例将改为 1:1")).toBeTruthy();
  expect(screen.getByText("标准价格 40 积分")).toBeTruthy();
  fireEvent.click(button);
  expect(onChoice).toHaveBeenCalledWith({ kind: "switch-model", endpointId: "seed", name: "Seedream 4.5", changes: "比例将改为 1:1" });
});

test("recharge is not offered until the suggestions are in, so nobody pays before seeing the free path", async () => {
  let release!: (value: unknown) => void;
  api.grants.mockReturnValue(new Promise(resolve => { release = resolve; }));
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: choices }} onChoice={vi.fn()}/>);
  await act(async () => {});
  expect(screen.queryByRole("link", { name: "充值" })).toBeNull();
  await act(async () => { release({ data: [] }); });
  await screen.findByRole("link", { name: "充值" });
});

test("a task with no known price is released once credits arrive, instead of saying short forever", async () => {
  const onChoice = vi.fn();
  render(<StudioCreditShortageDialog input={{ reason: "普通积分不足，请充值或减少生成数量", canRetry: true }} onChoice={onChoice}/>);
  await screen.findByText(/当前可用 0 积分，不足以完成本次生成/);
  api.balance.mockResolvedValue({ totalBalance: 1000 });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await screen.findByRole("dialog", { name: "余额已更新" });
  fireEvent.click(screen.getByRole("button", { name: "继续生成" }));
  expect(onChoice).toHaveBeenCalledWith({ kind: "retry" });
});

test("grants that fail to load say so and can be retried, rather than quietly hiding the free path", async () => {
  api.grants.mockRejectedValueOnce(new Error("网络中断"));
  render(<StudioCreditShortageDialog input={{ quote, modelChoices: choices }} onChoice={vi.fn()}/>);
  await screen.findByText(/模型赠款加载失败/);
  api.grants.mockResolvedValue({ data: [grant({ endpointId: "seed" })] });
  fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
  await screen.findByRole("button", { name: "改用Seedream 4.5" });
  expect(screen.queryByText(/模型赠款加载失败/)).toBeNull();
});
