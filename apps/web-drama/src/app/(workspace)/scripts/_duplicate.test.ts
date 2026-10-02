import { describe, expect, it, vi } from "vitest";
import type { Script } from "@ai-star-eco/types/script";
import { saveThenDuplicate } from "./_duplicate";

// 「复制成新脚本」的行为契约（v0.197 第三轮，评审 MK1 + 复核）：
//   · 有没保存的改动先保存、保存没成功就不复制；副本用的永远是点下去那一刻编辑器里的正文；
//   · 同一把锁下同一时刻只复制一份；副本建好、调用方要跳走时锁不放；
//   · 复制期间正文又变了 → editedSince，调用方不能直接跳走。
const COPY = { id: "ds_copy" } as Script;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function base(over: Partial<Parameters<typeof saveThenDuplicate>[0]> = {}) {
  return {
    lock: { current: false },
    dirty: false,
    content: "原文",
    currentContent: () => "原文",
    save: vi.fn(async () => true),
    clone: vi.fn(async () => COPY),
    ...over,
  };
}

describe("saveThenDuplicate", () => {
  it("有改动：先保存，再用眼前的正文复制", async () => {
    const calls: string[] = [];
    const save = vi.fn(async () => {
      calls.push("save");
      return true;
    });
    const clone = vi.fn(async (text: string) => {
      calls.push(`clone:${text}`);
      return COPY;
    });

    const out = await saveThenDuplicate(
      base({ dirty: true, content: "改过的正文", currentContent: () => "改过的正文", save, clone }),
    );

    expect(out).toEqual({ kind: "copied", copy: COPY, editedSince: false });
    expect(calls).toEqual(["save", "clone:改过的正文"]);
  });

  it("有改动但保存失败：不复制，锁放开（改好了还能再点）", async () => {
    const opts = base({ dirty: true, save: vi.fn(async () => false) });

    const out = await saveThenDuplicate(opts);

    expect(out.kind).toBe("save-failed");
    expect(opts.clone).not.toHaveBeenCalled();
    expect(opts.lock.current).toBe(false);
  });

  it("没改动：不保存，直接用眼前的正文复制", async () => {
    const opts = base();

    await saveThenDuplicate(opts);

    expect(opts.save).not.toHaveBeenCalled();
    expect(opts.clone).toHaveBeenCalledWith("原文");
  });

  it("复制本身失败：把错误交回调用方，不吞掉，锁放开", async () => {
    const err = new Error("HTTP 500");
    const opts = base({
      clone: vi.fn(async () => {
        throw err;
      }),
    });
    const out = await saveThenDuplicate(opts);
    expect(out).toEqual({ kind: "copy-failed", error: err });
    expect(opts.lock.current).toBe(false);
  });

  it("同一时刻点两次（弹窗重新挂载后又点了一次）：只复制一份，第二次什么都不做", async () => {
    const pending = deferred<Script>();
    const lock = { current: false };
    const save = vi.fn(async () => true);
    const clone = vi.fn(() => pending.promise);

    const first = saveThenDuplicate(base({ lock, dirty: true, save, clone }));
    // 第一次还在保存 / 复制：第二次拿不到锁
    const second = await saveThenDuplicate(base({ lock, dirty: false, save, clone }));
    expect(second).toEqual({ kind: "busy" });

    pending.resolve(COPY);
    expect((await first).kind).toBe("copied");
    expect(save).toHaveBeenCalledTimes(1);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it("副本建好、调用方要跳走时锁不放：跳转完成前再点也不会多一份", async () => {
    const lock = { current: false };
    const clone = vi.fn(async () => COPY);

    expect((await saveThenDuplicate(base({ lock, clone }))).kind).toBe("copied");
    expect(lock.current).toBe(true);
    expect((await saveThenDuplicate(base({ lock, clone }))).kind).toBe("busy");
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it("复制期间正文又变了：editedSince，锁放开（调用方留在原页）", async () => {
    let editor = "原文";
    const opts = base({
      currentContent: () => editor,
      clone: vi.fn(async () => {
        editor = "原文，又加了一句";
        return COPY;
      }),
    });

    const out = await saveThenDuplicate(opts);

    expect(out).toEqual({ kind: "copied", copy: COPY, editedSince: true });
    expect(opts.clone).toHaveBeenCalledWith("原文"); // 副本仍是点下去那一刻的正文
    expect(opts.lock.current).toBe(false);
  });
});
