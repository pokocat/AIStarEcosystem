// 「保存撞上别处的编辑」这条链的接线测试（2026-10-19）。
//
// 用户反馈的形状：同一张画布开了两个窗口，一边存了，另一边从此「页面持续报错」。
// 根因两处：(1) 冲突之后顶栏只有一个不能点的徽标，用户不知道该干什么；
// (2) 冲突之后每一条经过 saveStudioDocument 的保存（助手自动保存、任务轮询回写…）
// 都再弹一次同一句错。这里守的是这两处的修法都还挂着 —— 弹窗没人挂、错误码没对上，
// 编译器都不会报错，只会在生产上安静地退回原样。

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const host = read("src/ip/canvas-host.tsx");
const errors = read("src/ip/studio-errors.tsx");
const save = read("src/canvas-bridge/studio-save.ts");
const sync = read("src/canvas-bridge/project-sync.ts");

describe("冲突弹窗挂在画布宿主上", () => {
  it("宿主渲染了弹窗，并把同步层的 resolveConflict 交给它", () => {
    expect(host).toMatch(/<CanvasConflictDialog\b/);
    expect(host).toContain("resolve={resolveConflict}");
  });
  it("冲突态下顶栏有一个真的能点的「处理冲突」按钮（不再只是一句「刷新后再改」）", () => {
    expect(host).toContain("处理冲突");
    // 徽标文案不再是「刷新后再改」（注释里提到旧文案不算）
    expect(host).not.toMatch(/conflict:\s*"[^"]*刷新后再改/);
  });
  it("别的标签页存了新版、这里悄悄换过内容之后，轻轻说一声", () => {
    expect(host).toContain("remoteRefreshes");
    expect(host).toContain("已经换成最新内容");
  });
});

describe("冲突只由弹窗说，不逐条弹通知", () => {
  it("saveStudioDocument 的冲突错误带 IP_PROJECT_STALE 错误码", () => {
    expect(save).toMatch(/code:\s*"IP_PROJECT_STALE"/);
  });
  it("通知层对 IP_PROJECT_STALE 不弹", () => {
    expect(errors).toMatch(/error\.code === "IP_PROJECT_STALE"\) return error/);
  });
  it("同步层撞 409 时不再 reportStudioError", () => {
    const putCatch = sync.slice(sync.indexOf("const stale = Boolean("), sync.indexOf("return { outcome: stale ?"));
    expect(putCatch).toContain("enterConflict()");
    expect(putCatch.indexOf("reportStudioError")).toBeGreaterThan(putCatch.indexOf("} else {"));
  });
});

describe("跨标签页通道接在保存链上", () => {
  it("存成功广播、收到别处的保存就处理", () => {
    expect(sync).toContain("announceSave(snap.id, saved.docVersion)");
    expect(sync).toMatch(/onRemoteSave\(\(save\)/);
  });
});
