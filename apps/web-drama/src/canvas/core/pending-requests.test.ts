import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetPendingForTest, PENDING_MAX_ITEMS, readPending, removePending, upsertPending, type PendingRequest } from "./pending-requests";

// 未确认请求表的存取（Codex 复审 N1 / N2 / N4）。用一个可控的假 localStorage：能正常读写、也能让写入失败。

function fakeStorage() {
  const m = new Map<string, string>();
  const ctl = { failWrites: false };
  const storage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (ctl.failWrites) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k: string) => {
      if (ctl.failWrites) throw new Error("QuotaExceededError");
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  return { storage, map: m, ctl };
}

const item = (id: string, over: Partial<PendingRequest> = {}): PendingRequest => ({
  clientRequestId: id,
  kind: "image",
  body: {},
  slot: `look:${id}`,
  sig: id,
  targets: [`look:${id}`],
  docVersion: "v0",
  createdAt: Date.now(),
  ...over,
});

describe("pending-requests", () => {
  let original: PropertyDescriptor | undefined;
  let fake: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    __resetPendingForTest();
    original = Object.getOwnPropertyDescriptor(window, "localStorage");
    fake = fakeStorage();
    Object.defineProperty(window, "localStorage", { value: fake.storage, configurable: true });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it("N2：写入失败（读正常）→ 这张画布进内存模式，之后不再被 storage 里的旧值盖掉", () => {
    upsertPending("c1", item("A"));
    expect(readPending("c1").map((e) => e.clientRequestId)).toEqual(["A"]);
    fake.ctl.failWrites = true;
    upsertPending("c1", item("B"));
    expect(readPending("c1").map((e) => e.clientRequestId)).toEqual(["A", "B"]);
    removePending("c1", "A");
    expect(readPending("c1").map((e) => e.clientRequestId)).toEqual(["B"]);
    expect(JSON.parse(fake.map.get("drama-canvas-pending:c1")!).length).toBe(1); // storage 里还是旧的 A，不再读它
  });

  it("N4：storage 能用时它是唯一真值：别的标签页删掉之后，本页不会从内存复活", () => {
    upsertPending("c1", item("K"));
    fake.map.delete("drama-canvas-pending:c1"); // 另一个标签页接回后删了
    expect(readPending("c1")).toEqual([]);
  });

  it("N1：不按年龄删（再老的也留着，由接回流程下结论）", () => {
    const day = 24 * 3600 * 1000;
    upsertPending("c1", item("old", { createdAt: Date.now() - 30 * day }));
    upsertPending("c1", item("accepted", { createdAt: Date.now() - 30 * day, runIds: ["r1"] }));
    expect(readPending("c1").map((e) => e.clientRequestId).sort()).toEqual(["accepted", "old"]);
  });

  it("每张画布最多 200 项：超出只淘汰最老的、已有运行 id 的；没确认的一项都不淘汰", () => {
    for (let i = 0; i < PENDING_MAX_ITEMS; i++) {
      upsertPending("c1", item(`acc${i}`, { createdAt: 1000 + i, runIds: [`r${i}`] }));
    }
    upsertPending("c1", item("unconfirmed-new", { createdAt: 5000 }));
    const ids = readPending("c1").map((e) => e.clientRequestId);
    expect(ids).toHaveLength(PENDING_MAX_ITEMS);
    expect(ids).not.toContain("acc0"); // 最老的、有运行 id 的被淘汰
    expect(ids).toContain("unconfirmed-new");

    // 全是没确认的：宁可超出上限，也不淘汰
    __resetPendingForTest();
    fake.map.clear();
    for (let i = 0; i <= PENDING_MAX_ITEMS; i++) upsertPending("c2", item(`u${i}`, { createdAt: 1000 + i }));
    expect(readPending("c2")).toHaveLength(PENDING_MAX_ITEMS + 1);
  });

  it("storage 正常时读写都同步内存快照；之后 getItem 抛错切进内存模式，已登记的键还在", () => {
    upsertPending("c1", item("K"));
    const getItem = fake.storage.getItem;
    fake.storage.getItem = () => {
      throw new Error("SecurityError");
    };
    try {
      expect(readPending("c1").map((e) => e.clientRequestId)).toEqual(["K"]);
    } finally {
      fake.storage.getItem = getItem;
    }
  });
});
