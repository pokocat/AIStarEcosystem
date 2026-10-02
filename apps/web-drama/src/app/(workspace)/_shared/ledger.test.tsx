import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { LedgerEntry } from "@ai-star-eco/types/wallet";
import { appendUnique, isHoldSettlement, scanLedger } from "./ledger";
import { HOLD_SETTLEMENT_LABEL, LEDGER_TYPE_LABEL, LedgerList } from "./LedgerList";

// §8.0.1 ⑩：断行为不断文案。行的种类按 data-kind 取，不按「余额不变」这类字。

afterEach(() => cleanup());

let n = 0;
function entry(type: LedgerEntry["type"], amount: number, ref?: { type: string; id: string }): LedgerEntry {
  n += 1;
  return {
    id: `le-${n}`,
    walletId: "w",
    userId: "u",
    type,
    amount,
    balanceAfter: 1000,
    description: `${type} ${n}`,
    referenceType: ref?.type,
    referenceId: ref?.id,
    createdAt: "2026-09-28T01:00:00Z",
  };
}

describe("isHoldSettlement · 结算判定不依赖窗口里有没有对应的冻结", () => {
  it("带引用的扣除是冻结的结算（CreditService.commitHold 写的）", () => {
    expect(isHoldSettlement(entry("spend", -80, { type: "DRAMA_AI", id: "r-1" }))).toBe(true);
    expect(isHoldSettlement(entry("spend", -1600, { type: "drama_shot_batch", id: "b-1" }))).toBe(true);
  });

  it("商店买断（store_*）是直接扣余额，不是结算", () => {
    expect(isHoldSettlement(entry("spend", -300, { type: "store_skin", id: "sk-1" }))).toBe(false);
  });

  it("没有引用的扣除不可能来自 commitHold（hold 要求引用非空）", () => {
    expect(isHoldSettlement(entry("spend", -10))).toBe(false);
    expect(isHoldSettlement({ type: "spend", referenceType: "DRAMA_AI", referenceId: "  " })).toBe(false);
  });

  it("其他类型一律不是结算", () => {
    for (const t of ["freeze", "unfreeze", "adjust", "withdraw", "income", "recharge"] as const) {
      expect(isHoldSettlement(entry(t, -10, { type: "DRAMA_AI", id: "r" }))).toBe(false);
    }
  });
});

describe("LedgerList · 结算行不画成再扣一次", () => {
  it("对应的冻结不在这一页里，结算行仍然按结算显示、不出负数", () => {
    // 冻结早就翻出了最近 50 条：这一页里只有结算那条
    const settle = entry("spend", -1600, { type: "drama_shot_batch", id: "b-old" });
    const direct = entry("spend", -300, { type: "store_skin", id: "sk-1" });
    const { container } = render(<LedgerList entries={[settle, direct]} />);
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".acct-ledger-row"));
    expect(rows.map((r) => r.dataset.kind)).toEqual(["settlement", "debit"]);
    const settleAmount = rows[0].querySelector(".acct-ledger-amount")!.textContent ?? "";
    expect(settleAmount).not.toMatch(/[-−]\s*1,?600/);
  });

  it("金额带单位（≤1024 表头藏起来时也看得出是积分）", () => {
    const { container } = render(<LedgerList entries={[entry("income", 500)]} />);
    expect(container.querySelector(".acct-ledger-row .acct-ledger-amount .acct-ledger-unit")).not.toBeNull();
  });
});

describe("LedgerList · 类型列只说积分怎么动，不说事情成没成", () => {
  const typeCells = (entries: LedgerEntry[]) => {
    const { container } = render(<LedgerList entries={entries} />);
    return Array.from(container.querySelectorAll<HTMLElement>(".acct-ledger-row .acct-ledger-type")).map((c) => c.textContent);
  };

  it("出片成功后退差额和生成失败退回，类型列是同一个叫法（成败由说明列交代）", () => {
    const partial = { ...entry("unfreeze", 120, { type: "music_gen", id: "m-1" }), description: "音乐创作时长差额退回" };
    const failed = { ...entry("unfreeze", 800, { type: "drama_shot_video", id: "v-1" }), description: "第 4 镜视频（生成失败）" };
    const [a, b] = typeCells([partial, failed]);
    expect(a).toBe(b);
  });

  it("发布上线的结算与生成的结算，类型列是同一个叫法", () => {
    const publish = { ...entry("spend", -50, { type: "publish_job_upload", id: "pj-1" }), description: "发布上线 · douyin · 盛夏来信" };
    const gen = entry("spend", -1600, { type: "drama_shot_batch", id: "b-1" });
    const [a, b] = typeCells([publish, gen]);
    expect(a).toBe(b);
  });

  // §8.0.1 ⑩ 的例外：这里被测的行为就是「文案不宣称结果」。UNFREEZE 也用于成功后退差额、
  // commitHold 也用于发布上线（账本跨产品共享），叫法里带成败 / 生成就会把别的记录标错。
  it("冻结三段的叫法里不带成败或「生成」", () => {
    for (const label of [LEDGER_TYPE_LABEL.freeze, LEDGER_TYPE_LABEL.unfreeze, HOLD_SETTLEMENT_LABEL]) {
      expect(label).not.toMatch(/成功|失败|完成|生成/);
    }
  });
});

describe("scanLedger · 翻页直到凑够或翻完", () => {
  const pages = (all: LedgerEntry[]) =>
    vi.fn(async (page: number, size: number) => all.slice(page * size, page * size + size));

  it("最近几页全是生成流水时接着往前翻，找到更早的收入", async () => {
    const all = [
      ...Array.from({ length: 250 }, () => entry("spend", -10, { type: "DRAMA_AI", id: "x" })),
      entry("income", 500),
      entry("withdraw", -200),
    ];
    const fetchPage = pages(all);
    const r = await scanLedger(fetchPage, {
      keep: (e) => e.type === "income" || e.type === "withdraw",
      pageSize: 100,
      want: 20,
      maxPages: 5,
    });
    expect(r.matched.map((e) => e.type)).toEqual(["income", "withdraw"]);
    expect(r.done).toBe(true); // 第 3 页只回 52 条 < 100：翻完了
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("凑够一屏就停，不再往前翻", async () => {
    const all = Array.from({ length: 500 }, () => entry("income", 1));
    const fetchPage = pages(all);
    const r = await scanLedger(fetchPage, { keep: () => true, pageSize: 100, want: 20, maxPages: 5 });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(r.done).toBe(false);
    expect(r.nextPage).toBe(1);
  });

  it("单次最多翻 maxPages 页；没翻完就不算「没有记录」，下次从 nextPage 接着翻", async () => {
    const all = [
      ...Array.from({ length: 800 }, () => entry("freeze", -1, { type: "DRAMA_AI", id: "y" })),
      entry("income", 9),
    ];
    const fetchPage = pages(all);
    const keep = (e: LedgerEntry) => e.type === "income";
    const first = await scanLedger(fetchPage, { keep, pageSize: 100, want: 20, maxPages: 5 });
    expect(first.matched).toHaveLength(0);
    expect(first.done).toBe(false);
    expect(first.nextPage).toBe(5);
    const more = await scanLedger(fetchPage, { keep, startPage: first.nextPage, pageSize: 100, want: 20, maxPages: 5 });
    expect(more.matched.map((e) => e.type)).toEqual(["income"]);
    expect(more.done).toBe(true);
  });

  it("两次翻页之间有新流水写入、页边界错开时，按 id 去重", () => {
    const a = entry("income", 1);
    const b = entry("withdraw", -1);
    expect(appendUnique([a, b], [b, entry("income", 2)]).map((e) => e.id)).toEqual([a.id, b.id, `le-${n}`]);
  });
});
