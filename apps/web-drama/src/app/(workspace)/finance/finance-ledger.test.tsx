import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { LedgerEntry } from "@ai-star-eco/types/wallet";

// §8.0.1 ⑥ / ⑩：钉住「收入与提现」真的在翻页找记录，断行为不断文案（按 data-* 取）。
// 之前只取最近 100 条再在前端筛：生成流水一多，收入被挤出窗口，页面还说「没有记录」。

const getMyLedger = vi.fn();
vi.mock("@ai-star-eco/api-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  AccountApi: {
    getMyLedger: (...a: unknown[]) => getMyLedger(...a),
    listRechargePackages: () => Promise.resolve([]),
    getMyWallet: () => Promise.resolve(null),
  },
}));
vi.mock("@/api", () => ({ StorageApi: { getStorageUsage: () => new Promise(() => {}) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import FinancePage from "./page";

let n = 0;
function entry(type: LedgerEntry["type"], amount: number): LedgerEntry {
  n += 1;
  return {
    id: `le-${n}`,
    walletId: "w",
    userId: "u",
    type,
    amount,
    balanceAfter: 1000,
    description: `${type} ${n}`,
    referenceType: type === "income" || type === "withdraw" ? undefined : "DRAMA_AI",
    referenceId: type === "income" || type === "withdraw" ? undefined : `r-${n}`,
    createdAt: "2026-09-28T01:00:00Z",
  };
}
function serve(all: LedgerEntry[]) {
  getMyLedger.mockImplementation(async (page: number, size: number) => all.slice(page * size, page * size + size));
}
async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

beforeEach(() => getMyLedger.mockReset());
afterEach(() => cleanup());

describe("收入与提现 · 翻页找记录", () => {
  it("最近一页全是生成流水：接着往前翻，显示更早的收入，不出「没有记录」", async () => {
    serve([
      ...Array.from({ length: 150 }, () => entry("freeze", -10)),
      entry("income", 500),
    ]);
    const { container } = render(<FinancePage />);
    await flush();
    expect(getMyLedger.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".acct-ledger-row")).toHaveLength(1);
    expect(container.querySelector("[data-finance-empty]")).toBeNull();
  });

  it("翻了上限还没翻完：不说「没有记录」，给「加载更多」，点了接着翻", async () => {
    serve([
      ...Array.from({ length: 700 }, () => entry("spend", -10)),
      entry("withdraw", -200),
    ]);
    const { container } = render(<FinancePage />);
    await flush();
    expect(container.querySelector("[data-finance-empty]")).toBeNull();
    expect(container.querySelector("[data-finance-partial]")).not.toBeNull();
    const more = container.querySelector<HTMLButtonElement>("[data-finance-more]");
    expect(more).not.toBeNull();
    await act(async () => {
      more!.click();
    });
    await flush();
    expect(container.querySelectorAll(".acct-ledger-row")).toHaveLength(1);
    expect(container.querySelector("[data-finance-more]")).toBeNull(); // 翻完了
  });

  it("真的翻完了也没有：才显示「没有记录」", async () => {
    serve(Array.from({ length: 30 }, () => entry("spend", -10)));
    const { container } = render(<FinancePage />);
    await flush();
    expect(container.querySelector("[data-finance-empty]")).not.toBeNull();
    expect(container.querySelector("[data-finance-more]")).toBeNull();
  });
});
